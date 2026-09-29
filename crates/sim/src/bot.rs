//! A simple autopilot. It plays "reasonably" so headless runs and balance
//! sweeps can check that the economy is winnable and failure rates sting
//! without being hopeless.

use crate::action::Action;
use crate::catalog::{Item, StationKind};
use crate::model::{ContractStatus, OrderStatus, TICKS_PER_DAY};
use crate::state::GameState;

/// Hour of day the bot makes its decisions.
const DECISION_HOUR: u32 = 1;
/// Keep this much cash after buying a machine.
const CASH_BUFFER: i64 = 120_000;

/// Estimated finished units per day at the current bottleneck.
pub fn daily_capacity(state: &GameState) -> f64 {
    let hours = f64::from(state.policies.shifts.min(3)) * 8.0;
    StationKind::ALL
        .iter()
        .map(|&k| {
            let st = state.station(k);
            st.machines.len() as f64 * k.spec().rate_per_hour * 0.9 * hours
        })
        .fold(f64::INFINITY, f64::min)
}

/// The station limiting throughput.
pub fn bottleneck(state: &GameState) -> StationKind {
    StationKind::ALL
        .iter()
        .copied()
        .min_by(|a, b| {
            let cap =
                |k: StationKind| state.station(k).machines.len() as f64 * k.spec().rate_per_hour;
            cap(*a).total_cmp(&cap(*b))
        })
        .unwrap_or(StationKind::GearCut)
}

/// Units still owed on active contracts.
pub fn backlog(state: &GameState) -> u32 {
    state
        .contracts
        .iter()
        .filter(|c| c.status == ContractStatus::Active)
        .map(|c| c.remaining())
        .sum()
}

/// Decide this tick's actions. Only acts once a day.
pub fn decide(state: &GameState) -> Vec<Action> {
    if state.hour() != DECISION_HOUR {
        return Vec::new();
    }
    let mut actions = Vec::new();
    let cap = daily_capacity(state).max(1.0);
    let mut load = backlog(state) as f64;

    let mut offers: Vec<_> = state
        .contracts
        .iter()
        .filter(|c| c.status == ContractStatus::Offered)
        .collect();
    offers.sort_by_key(|c| std::cmp::Reverse(c.unit_price));
    for c in offers {
        let days_needed = (load + c.qty as f64) / cap + 1.0;
        if days_needed <= c.lead_days as f64 * 0.9 {
            load += c.qty as f64;
            actions.push(Action::AcceptContract { contract: c.id });
        }
    }

    let days_of_work = load / cap;
    let shifts = state.policies.shifts;
    if days_of_work > 10.0 && shifts < 3 {
        actions.push(Action::SetShifts { shifts: shifts + 1 });
    } else if days_of_work < 3.0 && shifts > 1 {
        actions.push(Action::SetShifts { shifts: shifts - 1 });
    }

    // An SPC alarm means the process has shifted: stop and reset it.
    let can_maintain =
        |s: &&crate::model::Station| s.spc_alarm && s.machines.iter().any(|m| m.is_up());
    for st in state.stations.iter().filter(can_maintain) {
        actions.push(Action::Maintain { station: st.kind });
    }

    // No capital spending while any part is short: cash goes to parts first.
    let parts_ok = Item::PURCHASED.iter().all(|&item| {
        let per_unit = if item == Item::Bearing { 2.0 } else { 1.0 };
        f64::from(state.available(item)) >= cap * per_unit
    });
    let neck = bottleneck(state);
    let price = neck.spec().machine_price;
    if parts_ok && days_of_work > 8.0 && state.cash > price + CASH_BUFFER {
        actions.push(Action::BuyMachine { station: neck });
    }

    // Size reorder points to cover lead time plus two days at current capacity.
    for item in Item::PURCHASED {
        let Some(policy) = state.policies.reorder.get(&item) else {
            continue;
        };
        let Some(supplier) = state.supplier(policy.supplier) else {
            continue;
        };
        let per_unit = if item == Item::Bearing { 2.0 } else { 1.0 };
        let daily = cap * per_unit;
        let reorder_point = (daily * f64::from(supplier.lead_days + 2)) as u32;
        let order_qty = (daily * f64::from(supplier.lead_days)) as u32;
        if let Some(order) = emergency_order(state, item, daily) {
            actions.push(order);
        }
        if reorder_point.abs_diff(policy.reorder_point) > reorder_point / 5 {
            actions.push(Action::SetReorder {
                item,
                supplier: policy.supplier,
                reorder_point,
                order_qty,
                enabled: true,
            });
        }
    }
    actions
}

/// Expedite parts when stock will not last until the next promised delivery.
fn emergency_order(state: &GameState, item: Item, daily: f64) -> Option<Action> {
    let on_hand = f64::from(state.available(item));
    if on_hand >= daily * 1.5 {
        return None;
    }
    let soon = state.tick + TICKS_PER_DAY;
    let covered = state.orders.iter().any(|o| {
        o.item == item && o.status == OrderStatus::Pending && (o.expedited || o.promised <= soon)
    });
    if covered {
        return None;
    }
    let fastest = state
        .suppliers
        .iter()
        .filter(|s| s.item == item && s.active)
        .min_by_key(|s| s.lead_days)?;
    Some(Action::PlaceOrder {
        supplier: fastest.id,
        qty: (daily * 3.0) as u32,
        expedite: true,
    })
}

/// Run a full autopilot game and return the final state.
pub fn play(seed: u64, difficulty: crate::Difficulty, days: u32) -> GameState {
    let mut state = GameState::new(seed, difficulty);
    for _ in 0..days * TICKS_PER_DAY {
        if state.is_over() {
            break;
        }
        for action in decide(&state) {
            let _ = state.apply(action);
        }
        state.step();
    }
    state
}
