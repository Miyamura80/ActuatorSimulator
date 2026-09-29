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
