//! Lot genealogy queries: where a lot came from and what it went into.

use crate::model::{LotId, LotOrigin, SupplierId};
use crate::state::GameState;
use std::collections::{BTreeSet, VecDeque};

/// Every lot built (directly or indirectly) from `root`, excluding `root`.
pub fn descendants(state: &GameState, root: LotId) -> BTreeSet<LotId> {
    // Lots only consume older lots, so one forward pass over ids in order
    // finds every descendant without building a child index.
    let mut found = BTreeSet::new();
    let mut frontier: BTreeSet<LotId> = BTreeSet::from([root]);
    for lot in state.lots.iter().skip(root.0 as usize + 1) {
        if let LotOrigin::Built { inputs, .. } = &lot.origin {
            if inputs.iter().any(|i| frontier.contains(i)) {
                frontier.insert(lot.id);
                found.insert(lot.id);
            }
        }
    }
    found
}

/// Every lot `root` was built from, excluding `root`.
pub fn ancestors(state: &GameState, root: LotId) -> BTreeSet<LotId> {
    let mut found = BTreeSet::new();
    let mut queue = VecDeque::from([root]);
    while let Some(id) = queue.pop_front() {
        if let LotOrigin::Built { inputs, .. } = &state.lot(id).origin {
            for input in inputs {
                if found.insert(*input) {
                    queue.push_back(*input);
                }
            }
        }
    }
    found
}

/// The supplier a purchased (or opening-stock) lot came from.
pub fn supplier_of(state: &GameState, lot: LotId) -> Option<SupplierId> {
    match state.lot(lot).origin {
        LotOrigin::Purchased { supplier, .. } | LotOrigin::Opening { supplier } => Some(supplier),
        LotOrigin::Built { .. } => None,
    }
}

/// What the player can learn about a lot by pulling its records: where it came
/// from, what it went into, and how much of it shipped. Hidden defect counts
/// stay hidden.
#[derive(Debug, Clone, serde::Serialize)]
pub struct TraceReport {
    pub lot: LotId,
    pub item: crate::Item,
    pub label: &'static str,
    pub created: crate::Tick,
    pub initial_qty: u32,
    pub remaining: u32,
    pub status: crate::model::LotStatus,
    pub built_at: Option<crate::StationKind>,
    pub supplier: Option<SupplierId>,
    pub supplier_name: Option<String>,
    /// Purchased lots this lot was built from (directly or not).
    pub source_lots: Vec<TraceLine>,
    /// Finished-goods lots built from this lot (or the lot itself).
    pub finished_lots: Vec<TraceLine>,
    /// Units from `finished_lots` already shipped to customers.
    pub shipped_units: u32,
    pub recalled: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct TraceLine {
    pub lot: LotId,
    pub item: crate::Item,
    pub supplier_name: Option<String>,
}

fn line(state: &GameState, id: LotId) -> TraceLine {
    TraceLine {
        lot: id,
        item: state.lot(id).item,
        supplier_name: supplier_of(state, id).map(|s| state.suppliers[s.0 as usize].name.clone()),
    }
}

/// Build the player-facing trace for `lot`, or `None` if it does not exist.
pub fn report(state: &GameState, lot: LotId) -> Option<TraceReport> {
    let l = state.lots.get(lot.0 as usize)?;
    let supplier = supplier_of(state, lot);
    let source_lots = ancestors(state, lot)
        .into_iter()
        .filter(|id| supplier_of(state, *id).is_some())
        .map(|id| line(state, id))
        .collect();
    let mut related = descendants(state, lot);
    related.insert(lot);
    // A set for membership tests against every shipment part.
    let finished: BTreeSet<LotId> = related
        .into_iter()
        .filter(|id| state.lot(*id).item == crate::Item::FinishedGood)
        .collect();
    let shipped_units = state
        .shipments
        .iter()
        .flat_map(|s| &s.parts)
        .filter(|p| finished.contains(&p.lot))
        .map(|p| p.qty)
        .sum();
    Some(TraceReport {
        lot,
        item: l.item,
        label: l.item.label(),
        created: l.created,
        initial_qty: l.initial_qty,
        remaining: l.qty,
        status: l.status,
        built_at: match l.origin {
            LotOrigin::Built { station, .. } => Some(station),
            _ => None,
        },
        supplier,
        supplier_name: supplier.map(|s| state.suppliers[s.0 as usize].name.clone()),
        source_lots,
        finished_lots: finished.iter().map(|id| line(state, *id)).collect(),
        shipped_units,
        recalled: l.recalled || finished.iter().any(|id| state.lot(*id).recalled),
    })
}
