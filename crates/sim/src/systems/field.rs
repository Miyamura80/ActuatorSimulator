//! Field quality: escaped defects fail at the customer (DOA within days,
//! latent defects weeks later), each one an RMA. The player can trace a bad
//! lot forward and recall what shipped, or scrap stock that is still here.

use crate::catalog::Item;
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::state::GameState;
use crate::trace;
use std::collections::BTreeMap;

/// Replacement unit, freight, and handling per RMA.
const RMA_COST: f64 = 420.0;
/// Reputation lost per failed unit (doubled for premium customers).
const RMA_REP_LOSS: f64 = 0.3;
/// Proactive recall cost per shipped unit, and its flat reputation cost.
const RECALL_COST: f64 = 140.0;
const RECALL_REP_LOSS: f64 = 1.5;

/// Schedule failures for the defective units in a shipment.
pub fn schedule(state: &mut GameState, contract: ContractId, parts: &[ShippedPart]) {
    let now = state.tick;
    for p in parts {
        for _ in 0..p.defects {
            let due = now + state.rng.range(1, 4) * TICKS_PER_DAY + state.rng.range(0, 23);
            state.pending_failures.push(PendingFailure {
                due,
                contract,
                lot: p.lot,
                doa: true,
            });
        }
        for _ in 0..p.latent {
            let due = now + state.rng.range(10, 60) * TICKS_PER_DAY + state.rng.range(0, 23);
            state.pending_failures.push(PendingFailure {
                due,
                contract,
                lot: p.lot,
                doa: false,
            });
        }
    }
}

pub fn tick(state: &mut GameState) {
    let now = state.tick;
    if !state.pending_failures.iter().any(|f| f.due <= now) {
        return;
    }
    let (due, rest): (Vec<_>, Vec<_>) = std::mem::take(&mut state.pending_failures)
        .into_iter()
        .partition(|f| f.due <= now);
    state.pending_failures = rest;
    // One event per (contract, lot, kind) so a bad lot reads as one incident.
    let mut groups: BTreeMap<(ContractId, LotId, bool), u32> = BTreeMap::new();
    for f in due {
        *groups.entry((f.contract, f.lot, f.doa)).or_default() += 1;
    }
    for ((contract, lot, doa), units) in groups {
        rma(state, contract, lot, doa, units);
    }
}

fn rma(state: &mut GameState, contract: ContractId, lot: LotId, doa: bool, units: u32) {
    let (customer, premium) = state
        .contracts
        .iter()
        .find(|c| c.id == contract)
        .map(|c| (c.customer.clone(), c.quality == QualityTier::Premium))
        .unwrap_or_default();
    let tier = if premium { 2.0 } else { 1.0 };
    let cost = (RMA_COST * tier * state.tuning.rma_cost_mult * f64::from(units)).round() as i64;
    let rep = RMA_REP_LOSS * tier * f64::from(units);
    state.spend(cost, |l| &mut l.rma);
    state.reputation = (state.reputation - rep).max(0.0);
    state.today.field_failures += units;
    state.lots[lot.0 as usize].failed_in_field += units;
    let what = if doa {
        "dead on arrival"
    } else {
        "failed in the field"
    };
    state.emit(
        Severity::Critical,
        format!(
            "{units} actuator(s) from lot #{} {what} at {customer}: ${cost} RMA, -{rep:.1} rep",
            lot.0
        ),
        EventKind::FieldFailure {
            contract,
            lot,
            units,
            doa,
            cost,
        },
    );
}

/// Recall everything that shipped from `lot` or anything built from it, and
/// scrap whatever of it is still in the plant.
pub fn recall(state: &mut GameState, lot: LotId) -> Result<(), String> {
    if lot.0 as usize >= state.lots.len() {
        return Err("unknown lot".into());
    }
    let mut targets = trace::descendants(state, lot);
    targets.insert(lot);
    let live = |id: &LotId| targets.contains(id) && !state.lot(*id).recalled;
    let shipped_total: u32 = state
        .shipments
        .iter()
        .flat_map(|s| &s.parts)
        .filter(|p| live(&p.lot))
        .map(|p| p.qty)
        .sum();
    // Units that already came back as RMAs were paid for once; don't charge twice.
    let already_failed: u32 = targets
        .iter()
        .filter(|id| live(id))
        .map(|id| state.lot(*id).failed_in_field)
        .sum();
    let shipped = shipped_total.saturating_sub(already_failed);
    let scrapped: u32 = targets.iter().map(|id| scrap_units(state, *id)).sum();
    if shipped == 0 && scrapped == 0 {
        return Err("nothing from this lot is in the field or in stock".into());
    }
    state.pending_failures.retain(|f| !targets.contains(&f.lot));
    for id in &targets {
        if state.lot(*id).item == Item::FinishedGood {
            state.lots[id.0 as usize].recalled = true;
        }
    }
    let cost = (RECALL_COST * state.tuning.rma_cost_mult * f64::from(shipped)).round() as i64;
    if shipped > 0 {
        state.spend(cost, |l| &mut l.recalls);
        state.reputation = (state.reputation - RECALL_REP_LOSS).max(0.0);
    }
    state.emit(
        Severity::Warning,
        format!(
            "Recalled lot #{}: {shipped} shipped units recalled (${cost}), {scrapped} units scrapped in plant",
            lot.0
        ),
        EventKind::Recall { lot, recalled: shipped, scrapped, cost },
    );
    Ok(())
}

/// Scrap what is left of an in-stock lot.
pub fn scrap(state: &mut GameState, lot: LotId) -> Result<(), String> {
    if lot.0 as usize >= state.lots.len() {
        return Err("unknown lot".into());
    }
    let qty = scrap_units(state, lot);
    if qty == 0 {
        return Err("lot has no units in stock".into());
    }
    state.emit(
        Severity::Info,
        format!("Scrapped {qty} units of lot #{}", lot.0),
        EventKind::LotScrapped { lot, qty },
    );
    Ok(())
}

/// Remove a lot's remaining stock. Returns the units scrapped.
fn scrap_units(state: &mut GameState, id: LotId) -> u32 {
    let l = &state.lots[id.0 as usize];
    let in_plant = matches!(l.status, LotStatus::Available | LotStatus::Open);
    if !in_plant || l.qty == 0 {
        return 0;
    }
    let (item, qty) = (l.item, l.qty);
    if let Some(q) = state.stock.get_mut(&item) {
        q.retain(|x| *x != id);
    }
    // A lot still being filled at a station: stop adding to it.
    for st in &mut state.stations {
        if st.open_lot == Some(id) {
            st.open_lot = None;
        }
    }
    let l = &mut state.lots[id.0 as usize];
    l.status = LotStatus::Scrapped;
    l.qty = 0;
    l.defects = 0;
    l.latent = 0;
    // Finished goods were already counted as produced when they passed EOL;
    // counting them again as scrap would double-count them in the scrap rate.
    if item != Item::FinishedGood {
        state.today.scrapped += qty;
    }
    qty
}
