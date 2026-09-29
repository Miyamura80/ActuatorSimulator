//! Contract board: offer generation, acceptance, shipping, deadlines.

use crate::catalog::Item;
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::state::GameState;

const MAX_OFFERS: usize = 4;
const OFFER_LIFETIME_DAYS: u32 = 3;
/// Hour of day finished goods ship.
const SHIP_HOUR: u32 = 17;
/// A contract this many days past deadline is cancelled by the customer.
const FAIL_AFTER_LATE_DAYS: u32 = 10;
const BASE_UNIT_PRICE: f64 = 520.0;

const CUSTOMERS: &[&str] = &[
    "Atlas Robotics",
    "Nimbus Automation",
    "Heron Surgical",
    "Vector Cobots",
    "Kite Logistics",
    "Orchard Agritech",
    "Pioneer Motion",
    "Sable Aerospace",
    "Juniper Exoskeletons",
    "Tidewater Marine",
];

/// Fill empty slots on the board. Called at game start and daily.
pub fn generate_offers(state: &mut GameState) {
    let open = state
        .contracts
        .iter()
        .filter(|c| c.status == ContractStatus::Offered)
        .count();
    for _ in open..MAX_OFFERS {
        if !state.contracts.is_empty() && !state.rng.chance(0.55) {
            continue;
        }
        let c = make_offer(state);
        let msg = format!(
            "{} wants {} actuators at ${} each within {} days",
            c.customer, c.qty, c.unit_price, c.lead_days
        );
        let id = c.id;
        state.contracts.push(c);
        state.emit(
            Severity::Info,
            msg,
            EventKind::ContractOffered { contract: id },
        );
    }
}

fn make_offer(state: &mut GameState) -> Contract {
    let rep = state.reputation;
    let scale = 1.0 + rep / 50.0;
    let lo = (20.0 * scale) as u32;
    let hi = (60.0 * scale) as u32;
    let qty = state.rng.range(lo, hi) / 5 * 5;
    let premium = state.rng.chance(0.15 + rep / 250.0);
    let tier_mult = if premium { 1.3 } else { 1.0 };
    let price = BASE_UNIT_PRICE
        * state.rng.range_f64(0.85, 1.2)
        * tier_mult
        * state.tuning.contract_price_mult;
    // Assume roughly 18 units/day of one-shift capacity, plus slack.
    let lead =
        (qty as f64 / 18.0 + 5.0 + state.rng.range(0, 6) as f64) * state.tuning.contract_lead_mult;
    let customer = CUSTOMERS[state.rng.range(0, CUSTOMERS.len() as u32 - 1) as usize].to_string();
    Contract {
        id: ContractId(state.contracts.len() as u32),
        customer,
        qty: qty.max(10),
        unit_price: price.round() as i64,
        quality: if premium {
            QualityTier::Premium
        } else {
            QualityTier::Standard
        },
        offer_expires: state.tick + OFFER_LIFETIME_DAYS * TICKS_PER_DAY,
        lead_days: lead.round().max(3.0) as u32,
        deadline: None,
        delivered: 0,
        status: ContractStatus::Offered,
        late_penalty_rate: if premium { 0.04 } else { 0.02 },
        penalties_paid: 0,
    }
}

pub fn accept(state: &mut GameState, id: ContractId) -> Result<(), String> {
    let now = state.tick;
    let c = state.contract_mut(id).ok_or("unknown contract")?;
    if c.status != ContractStatus::Offered {
        return Err("contract is not on offer".into());
    }
    c.status = ContractStatus::Active;
    c.deadline = Some(now + c.lead_days * TICKS_PER_DAY);
    let msg = format!("Accepted {} x{} for {}", c.qty, c.unit_price, c.customer);
    state.emit(
        Severity::Info,
        msg,
        EventKind::ContractAccepted { contract: id },
    );
    Ok(())
}

pub fn decline(state: &mut GameState, id: ContractId) -> Result<(), String> {
    let c = state.contract_mut(id).ok_or("unknown contract")?;
    if c.status != ContractStatus::Offered {
        return Err("contract is not on offer".into());
    }
    c.status = ContractStatus::Expired;
    let msg = format!("Declined offer from {}", c.customer);
    state.emit(
        Severity::Info,
        msg,
        EventKind::ContractDeclined { contract: id },
    );
    Ok(())
}

pub fn tick(state: &mut GameState) {
    if state.hour() == 0 {
        expire_offers(state);
        generate_offers(state);
    }
    if state.hour() == SHIP_HOUR && state.policies.auto_ship {
        let mut active: Vec<(Tick, ContractId)> = state
            .contracts
            .iter()
            .filter(|c| c.status == ContractStatus::Active)
            .map(|c| (c.deadline.unwrap_or(Tick::MAX), c.id))
            .collect();
        active.sort();
        for (_, id) in active {
            ship(state, id);
        }
    }
    if state.hour() == 23 {
        check_deadlines(state);
    }
}

fn expire_offers(state: &mut GameState) {
    let now = state.tick;
    let expired: Vec<ContractId> = state
        .contracts
        .iter()
        .filter(|c| c.status == ContractStatus::Offered && c.offer_expires <= now)
        .map(|c| c.id)
        .collect();
    for id in expired {
        if let Some(c) = state.contract_mut(id) {
            c.status = ContractStatus::Expired;
        }
        state.emit(
            Severity::Info,
            "An offer expired".into(),
            EventKind::ContractExpired { contract: id },
        );
    }
}

/// Ship as many finished goods as possible to an active contract.
pub fn ship(state: &mut GameState, id: ContractId) {
    let Some(c) = state.contracts.iter().find(|c| c.id == id) else {
        return;
    };
    if c.status != ContractStatus::Active {
        return;
    }
    let qty = c.remaining().min(state.available(Item::FinishedGood));
    if qty == 0 {
        return;
    }
    let drawn = state.take_units(Item::FinishedGood, qty);
    state.shipments.push(Shipment {
        contract: id,
        tick: state.tick,
        parts: drawn.parts,
    });
    let (revenue, customer) = {
        let c = state.contract_mut(id).expect("checked above");
        c.delivered += qty;
        (qty as i64 * c.unit_price, c.customer.clone())
    };
    state.earn(revenue);
    state.today.shipped += qty;
    state.emit(
        Severity::Good,
        format!("Shipped {qty} actuators to {customer} (+${revenue})"),
        EventKind::Shipped {
            contract: id,
            qty,
            revenue,
        },
    );
    complete_if_done(state, id);
}

fn complete_if_done(state: &mut GameState, id: ContractId) {
    let now = state.tick;
    let Some(c) = state.contract_mut(id) else {
        return;
    };
    if c.remaining() > 0 {
        return;
    }
    c.status = ContractStatus::Completed;
    let on_time = c.deadline.is_none_or(|d| now <= d);
    let base = 1.0 + c.qty as f64 / 100.0;
    let premium = if c.quality == QualityTier::Premium {
        1.5
    } else {
        1.0
    };
    let gain = if on_time { base * premium } else { base * 0.25 };
    let customer = c.customer.clone();
    state.reputation = (state.reputation + gain).min(100.0);
    let (sev, msg) = if on_time {
        (
            Severity::Good,
            format!("Completed {customer} contract on time (+{gain:.1} rep)"),
        )
    } else {
        (
            Severity::Info,
            format!("Completed {customer} contract late (+{gain:.1} rep)"),
        )
    };
    state.emit(
        sev,
        msg,
        EventKind::ContractCompleted {
            contract: id,
            on_time,
            reputation: gain,
        },
    );
}

/// Daily: late penalties, reputation loss, and cancellation of hopeless contracts.
fn check_deadlines(state: &mut GameState) {
    let now = state.tick;
    let late: Vec<(ContractId, u32, i64)> = state
        .contracts
        .iter()
        .filter(|c| c.status == ContractStatus::Active)
        .filter_map(|c| {
            let d = c.deadline?;
            (now > d).then(|| {
                let days_late = (now - d) / TICKS_PER_DAY + 1;
                let penalty = (c.value() as f64 * c.late_penalty_rate).round() as i64;
                (c.id, days_late, penalty)
            })
        })
        .collect();
    for (id, days_late, penalty) in late {
        if days_late > FAIL_AFTER_LATE_DAYS {
            if let Some(c) = state.contract_mut(id) {
                c.status = ContractStatus::Failed;
            }
            state.reputation = (state.reputation - 12.0).max(0.0);
            state.emit(
                Severity::Critical,
                "Customer cancelled a badly late contract (-12 rep)".into(),
                EventKind::ContractFailed { contract: id },
            );
            continue;
        }
        state.spend(penalty, |l| &mut l.penalties);
        if let Some(c) = state.contract_mut(id) {
            c.penalties_paid += penalty;
        }
        state.reputation = (state.reputation - 1.0).max(0.0);
        state.emit(
            Severity::Warning,
            format!("Contract {days_late} day(s) late: ${penalty} penalty, -1 rep"),
            EventKind::ContractLate {
                contract: id,
                penalty,
            },
        );
    }
}
