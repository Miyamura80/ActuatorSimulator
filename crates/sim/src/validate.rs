//! Structural checks for a deserialized save.
//!
//! The systems index lots, suppliers and stations directly, so a save with a
//! dangling ID would panic on the next tick or view. Loading runs these checks
//! first and refuses the save instead.

use crate::catalog::StationKind;
use crate::model::{LotId, LotOrigin, SupplierId};
use crate::state::GameState;

impl GameState {
    /// Every stored ID points at something that exists.
    pub fn validate(&self) -> Result<(), String> {
        let lot = |id: LotId, what: &str| -> Result<(), String> {
            if (id.0 as usize) < self.lots.len() {
                Ok(())
            } else {
                Err(format!("{what} refers to missing lot #{}", id.0))
            }
        };
        let supplier = |id: SupplierId, what: &str| -> Result<(), String> {
            if (id.0 as usize) < self.suppliers.len() {
                Ok(())
            } else {
                Err(format!("{what} refers to missing supplier {}", id.0))
            }
        };

        for (i, s) in self.suppliers.iter().enumerate() {
            if s.id.0 as usize != i {
                return Err(format!("supplier {i} is stored out of order"));
            }
        }
        for (i, l) in self.lots.iter().enumerate() {
            if l.id.0 as usize != i {
                return Err(format!("lot {i} is stored out of order"));
            }
            match &l.origin {
                LotOrigin::Opening { supplier: s } | LotOrigin::Purchased { supplier: s, .. } => {
                    supplier(*s, "a lot origin")?
                }
                LotOrigin::Built { inputs, .. } => {
                    for id in inputs {
                        lot(*id, "a lot's genealogy")?;
                    }
                }
            }
        }
        for (item, queue) in &self.stock {
            for id in queue {
                lot(*id, "stock")?;
                if self.lot(*id).item != *item {
                    return Err(format!("lot #{} is filed under the wrong item", id.0));
                }
            }
        }
        if self.stations.len() != StationKind::ALL.len()
            || self
                .stations
                .iter()
                .zip(StationKind::ALL)
                .any(|(st, kind)| st.kind != kind)
        {
            return Err("stations do not match this build's line".into());
        }
        for st in &self.stations {
            if let Some(id) = st.open_lot {
                lot(id, "a station")?;
            }
        }
        for o in &self.orders {
            supplier(o.supplier, "a purchase order")?;
        }
        for p in self.policies.reorder.values() {
            supplier(p.supplier, "a reorder policy")?;
        }
        for s in &self.shipments {
            for part in &s.parts {
                lot(part.lot, "a shipment")?;
            }
        }
        for f in &self.pending_failures {
            lot(f.lot, "a field failure")?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Difficulty;

    #[test]
    fn fresh_and_played_games_validate() {
        let mut s = GameState::new(5, Difficulty::Normal);
        assert!(s.validate().is_ok());
        s.run_days(10);
        assert!(s.validate().is_ok());
    }

    #[test]
    fn dangling_stock_lot_is_rejected() {
        let mut s = GameState::new(5, Difficulty::Normal);
        let queue = s.stock.values_mut().next().unwrap();
        queue.push_back(LotId(9_999_999));
        assert!(s.validate().unwrap_err().contains("missing lot"));
    }
}
