//! Purchase orders, supplier deliveries, auto-reorder, and incoming inspection.

use crate::catalog::{Item, IQC_COST_PER_UNIT};
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::policy::InspectionPlan;
use crate::state::GameState;

/// Hour of day auto-reorder runs.
const REORDER_HOUR: u32 = 6;

/// Place an order with a supplier. Payment is due on placement.
/// Price multiplier for expedited (air freight) orders.
pub const EXPEDITE_PRICE_MULT: f64 = 1.5;

pub fn place_order(
    state: &mut GameState,
    supplier: SupplierId,
    qty: u32,
    expedite: bool,
) -> Result<OrderId, String> {
    let Some(s) = state.supplier(supplier).cloned() else {
        return Err(format!("unknown supplier {}", supplier.0));
    };
    if !s.active {
        return Err(format!("{} is no longer trading", s.name));
    }
    let qty = qty.max(s.min_order);
    let unit_price = if expedite {
        (s.unit_price as f64 * EXPEDITE_PRICE_MULT).round() as i64
    } else {
        s.unit_price
    };
    let cost = qty as i64 * unit_price;
    let lead_days = if expedite {
        s.lead_days.div_ceil(3)
    } else {
        s.lead_days
    };
    let promised = state.tick + lead_days * TICKS_PER_DAY;
    let mut arrives = promised;
    // Air freight is far more reliable than the supplier's normal logistics.
    let reliability = if expedite {
        0.5 + s.reliability / 2.0
    } else {
        s.reliability
    };
    if !state.rng.chance(reliability) {
        arrives += state.rng.range(1, lead_days.max(2)) * TICKS_PER_DAY;
    }
    let id = OrderId(state.orders.len() as u32);
    state.orders.push(PurchaseOrder {
        id,
        supplier,
        item: s.item,
        qty,
        unit_price,
        expedited: expedite,
        placed: state.tick,
        promised,
        arrives,
        status: OrderStatus::Pending,
    });
    state.spend(cost, |l| &mut l.materials);
    state.emit(
        Severity::Info,
        format!(
            "Ordered {qty} x {} from {}{} (${cost})",
            s.item.label(),
            s.name,
            if expedite { " by air" } else { "" }
        ),
        EventKind::OrderPlaced {
            order: id,
            supplier,
            item: s.item,
            qty,
            cost,
        },
    );
    Ok(id)
}

/// Run each tick: deliveries, late notices, and the daily auto-reorder.
pub fn tick(state: &mut GameState) {
    let now = state.tick;
    let mut due = Vec::new();
    let mut late = Vec::new();
    for o in &state.orders {
        if o.status != OrderStatus::Pending {
            continue;
        }
        if o.arrives == now {
            due.push(o.id);
        } else if o.promised == now {
            late.push((o.id, o.supplier, o.item));
        }
    }
    for (order, supplier, item) in late {
        let name = state.suppliers[supplier.0 as usize].name.clone();
        state.emit(
            Severity::Warning,
            format!("{name} missed the delivery date for {}", item.label()),
            EventKind::OrderLate {
                order,
                supplier,
                item,
            },
        );
    }
    for id in due {
        receive(state, id);
    }
    if state.hour() == REORDER_HOUR {
        auto_reorder(state);
    }
}

fn receive(state: &mut GameState, id: OrderId) {
    let order = state.orders[id.0 as usize].clone();
    state.orders[id.0 as usize].status = OrderStatus::Received;
    let (defect_rate, latent_rate) = {
        let s = &state.suppliers[order.supplier.0 as usize];
        (s.defect_rate, s.latent_rate)
    };
    let defects = state.rng.binomial(order.qty, defect_rate);
    let latent = state.rng.binomial(order.qty - defects, latent_rate);
    let origin = LotOrigin::Purchased {
        supplier: order.supplier,
        order: id,
    };
    let lot = state.new_lot(order.item, order.qty, origin, LotStatus::Open);
    {
        let l = &mut state.lots[lot.0 as usize];
        l.defects = defects;
        l.latent = latent;
    }
    state.suppliers[order.supplier.0 as usize].lots_received += 1;
    let late_hours = state.tick.saturating_sub(order.promised);
    state.emit(
        Severity::Info,
        format!(
            "Received {} x {} (lot #{})",
            order.qty,
            order.item.label(),
            lot.0
        ),
        EventKind::OrderArrived {
            order: id,
            lot,
            item: order.item,
            qty: order.qty,
            late_hours,
        },
    );
    let plan = state
        .policies
        .iqc
        .get(&order.item)
        .copied()
        .unwrap_or(InspectionPlan::Skip);
    inspect_incoming(state, lot, order.supplier, order.unit_price, plan);
}

/// Incoming quality control. A sample that finds more than 4% defective (and
/// more than one unit) rejects the lot; 100% inspection sorts out what it finds.
fn inspect_incoming(
    state: &mut GameState,
    lot_id: LotId,
    supplier: SupplierId,
    unit_price: i64,
    plan: InspectionPlan,
) {
    let (qty, item) = {
        let l = state.lot(lot_id);
        (l.qty, l.item)
    };
    let inspected = match plan {
        InspectionPlan::Skip => 0,
        InspectionPlan::Full => qty,
        InspectionPlan::Sample { .. } => {
            ((qty as f64 * plan.fraction()).ceil() as u32).clamp(5.min(qty), qty)
        }
    };
    if inspected == 0 {
        state.release_lot(lot_id);
        return;
    }
    state.spend(inspected as i64 * IQC_COST_PER_UNIT, |l| &mut l.inspection);
    // Inspectors catch 95% of the defective units they look at.
    let found = count_found(state, lot_id, inspected, 0.95);
    // Acceptance number: allow up to 4% of the sample (at least 1) before rejecting.
    let accept_limit = if plan == InspectionPlan::Full {
        u32::MAX
    } else {
        (inspected * 4 / 100).max(1)
    };
    if found > accept_limit {
        reject_lot(state, lot_id, supplier, unit_price, inspected, found);
        return;
    }
    {
        let l = &mut state.lots[lot_id.0 as usize];
        l.defects -= found;
        l.qty -= found;
    }
    state.today.scrapped += found;
    state.release_lot(lot_id);
    let sev = if found > 0 {
        Severity::Warning
    } else {
        Severity::Info
    };
    state.emit(
        sev,
        format!(
            "IQC passed lot #{} {} ({found} bad of {inspected} checked)",
            lot_id.0,
            item.label()
        ),
        EventKind::IqcPassed {
            lot: lot_id,
            item,
            inspected,
            found,
        },
    );
}

/// Draw `inspected` units without replacement and count caught defects.
fn count_found(state: &mut GameState, lot_id: LotId, inspected: u32, catch_rate: f64) -> u32 {
    let (mut qty, mut defects) = {
        let l = state.lot(lot_id);
        (l.qty, l.defects)
    };
    let mut found = 0;
    for _ in 0..inspected {
        if qty == 0 {
            break;
        }
        if state.rng.range(0, qty - 1) < defects {
            defects -= 1;
            if state.rng.chance(catch_rate) {
                found += 1;
            }
        }
        qty -= 1;
    }
    found
}

fn reject_lot(
    state: &mut GameState,
    lot_id: LotId,
    supplier: SupplierId,
    unit_price: i64,
    inspected: u32,
    found: u32,
) {
    let (qty, item) = {
        let l = &mut state.lots[lot_id.0 as usize];
        l.status = LotStatus::Rejected;
        (l.qty, l.item)
    };
    let refund = qty as i64 * unit_price;
    state.cash += refund;
    state.ledger.refunds += refund;
    state.today.iqc_rejects += 1;
    let s = &mut state.suppliers[supplier.0 as usize];
    s.lots_rejected += 1;
    let name = s.name.clone();
    state.emit(
        Severity::Warning,
        format!(
            "IQC rejected lot #{} {} from {name}: {found} bad in {inspected} sampled. Returned for ${refund} refund",
            lot_id.0,
            item.label()
        ),
        EventKind::IqcRejected { lot: lot_id, item, supplier, inspected, found },
    );
}

fn auto_reorder(state: &mut GameState) {
    for item in Item::PURCHASED {
        let Some(policy) = state.policies.reorder.get(&item).cloned() else {
            continue;
        };
        if !policy.enabled {
            continue;
        }
        let position = state.available(item) + state.on_order(item);
        if position < policy.reorder_point {
            let _ = place_order(state, policy.supplier, policy.order_qty, false);
        }
    }
}
