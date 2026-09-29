//! Supplier-side trouble, rolled once a day: bad lots (hidden until inspected
//! or failing downstream), price spikes, and bankruptcies.

use crate::catalog::Tier;
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::state::GameState;

/// Daily odds per supplier, before the difficulty multiplier.
const BAD_LOT_ODDS: f64 = 0.02;
const PRICE_SPIKE_ODDS: f64 = 0.008;
/// Bankruptcy odds by tier. Budget shops are the fragile ones.
const BANKRUPT_ODDS_BUDGET: f64 = 0.002;
const BANKRUPT_ODDS_OTHER: f64 = 0.0004;
/// No bankruptcies before this day, so the opening stays fair.
const BANKRUPT_GRACE_DAYS: u32 = 20;

pub fn tick(state: &mut GameState) {
    if state.hour() != 0 {
        return;
    }
    let mult = state.tuning.event_mult;
    for i in 0..state.suppliers.len() {
        if !state.suppliers[i].active {
            continue;
        }
        end_price_spike(state, i);
        if state.rng.chance(BAD_LOT_ODDS * mult) {
            // Silent: the player finds out at IQC, on the line, or in the field.
            state.suppliers[i].bad_lots_pending += 1;
        }
        if state.suppliers[i].price_spike_until.is_none()
            && state.rng.chance(PRICE_SPIKE_ODDS * mult)
        {
            start_price_spike(state, i);
        }
        let odds = match state.suppliers[i].tier {
            Tier::Budget => BANKRUPT_ODDS_BUDGET,
            _ => BANKRUPT_ODDS_OTHER,
        };
        // The last active supplier of a part never folds: the game must stay winnable.
        let item = state.suppliers[i].item;
        let alternatives = state
            .suppliers
            .iter()
            .filter(|s| s.item == item && s.active)
            .count();
        if state.day() >= BANKRUPT_GRACE_DAYS && alternatives > 1 && state.rng.chance(odds * mult) {
            bankrupt(state, i);
        }
    }
}

fn start_price_spike(state: &mut GameState, i: usize) {
    let pct = state.rng.range(25, 60);
    let days = state.rng.range(7, 20);
    let until = state.tick + days * TICKS_PER_DAY;
    let s = &mut state.suppliers[i];
    s.price_mult = 1.0 + f64::from(pct) / 100.0;
    s.price_spike_until = Some(until);
    let (id, name, item) = (s.id, s.name.clone(), s.item);
    state.emit(
        Severity::Warning,
        format!(
            "{name} raised {} prices {pct}% for about {days} days",
            item.label()
        ),
        EventKind::PriceSpike {
            supplier: id,
            percent: pct,
            days,
        },
    );
}

fn end_price_spike(state: &mut GameState, i: usize) {
    let s = &mut state.suppliers[i];
    if s.price_spike_until.is_some_and(|t| t <= state.tick) {
        s.price_spike_until = None;
        s.price_mult = 1.0;
        let (id, name) = (s.id, s.name.clone());
        state.emit(
            Severity::Info,
            format!("{name} prices are back to normal"),
            EventKind::PriceNormal { supplier: id },
        );
    }
}

/// The supplier stops trading. Open orders are lost (prepaid, no refund) and
/// any reorder policy pointing at it moves to the cheapest remaining supplier.
fn bankrupt(state: &mut GameState, i: usize) {
    state.suppliers[i].active = false;
    let (id, name, item) = {
        let s = &state.suppliers[i];
        (s.id, s.name.clone(), s.item)
    };
    let mut lost_value = 0;
    for o in state.orders.iter_mut() {
        if o.supplier == id && o.status == OrderStatus::Pending {
            o.status = OrderStatus::Lost;
            lost_value += o.qty as i64 * o.unit_price;
        }
    }
    let replacement = state
        .suppliers
        .iter()
        .filter(|s| s.item == item && s.active)
        .min_by_key(|s| s.current_price())
        .map(|s| (s.id, s.name.clone()));
    let mut msg = format!("{name} went bankrupt");
    if lost_value > 0 {
        msg.push_str(&format!(", taking ${lost_value} of prepaid orders with it"));
    }
    if let (Some(policy), Some((new_id, new_name))) =
        (state.policies.reorder.get_mut(&item), replacement.clone())
    {
        if policy.supplier == id {
            policy.supplier = new_id;
            msg.push_str(&format!(
                ". Reorders for {} moved to {new_name}",
                item.label()
            ));
        }
    }
    state.emit(
        Severity::Critical,
        msg,
        EventKind::SupplierBankrupt {
            supplier: id,
            lost_value,
        },
    );
}
