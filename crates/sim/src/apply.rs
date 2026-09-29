//! Apply player actions to the state.

use crate::action::{Action, ActionError};
use crate::event::{EventKind, Severity};
use crate::model::{ContractStatus, Machine, MachineId};
use crate::policy::InspectionPlan;
use crate::state::GameState;
use crate::systems::{contracts, purchasing};

/// Fraction of the purchase price returned when selling a machine.
const RESALE_FRACTION: f64 = 0.5;
const MAX_MACHINES_PER_STATION: usize = 6;

impl GameState {
    pub fn apply(&mut self, action: Action) -> Result<(), ActionError> {
        if self.is_over() {
            return Err(ActionError("the game is over".into()));
        }
        self.apply_inner(action).map_err(ActionError)
    }

    fn apply_inner(&mut self, action: Action) -> Result<(), String> {
        match action {
            Action::PlaceOrder {
                supplier,
                qty,
                expedite,
            } => purchasing::place_order(self, supplier, qty, expedite).map(|_| ()),
            Action::SetReorder {
                item,
                supplier,
                reorder_point,
                order_qty,
                enabled,
            } => {
                let s = self.supplier(supplier).ok_or("unknown supplier")?;
                if s.item != item {
                    return Err(format!("{} does not sell {}", s.name, item.label()));
                }
                let policy = self
                    .policies
                    .reorder
                    .get_mut(&item)
                    .ok_or("item is not purchased")?;
                policy.supplier = supplier;
                policy.reorder_point = reorder_point;
                policy.order_qty = order_qty;
                policy.enabled = enabled;
                Ok(())
            }
            Action::SetIqc { item, plan } => {
                if !item.is_purchased() {
                    return Err("IQC applies to purchased parts only".into());
                }
                validate_plan(plan)?;
                self.policies.iqc.insert(item, plan);
                Ok(())
            }
            Action::SetEol { plan } => {
                validate_plan(plan)?;
                self.policies.eol = plan;
                Ok(())
            }
            Action::SetShifts { shifts } => {
                if !(1..=3).contains(&shifts) {
                    return Err("shifts must be 1, 2 or 3".into());
                }
                self.policies.shifts = shifts;
                Ok(())
            }
            Action::SetWipCap { station, cap } => {
                self.station_mut(station).wip_cap = cap.max(1);
                Ok(())
            }
            Action::SetAutoShip { enabled } => {
                self.policies.auto_ship = enabled;
                Ok(())
            }
            Action::BuyMachine { station } => {
                if self.station(station).machines.len() >= MAX_MACHINES_PER_STATION {
                    return Err("no floor space left at this station".into());
                }
                let cost = station.spec().machine_price;
                if self.cash - cost < -self.tuning.overdraft_limit {
                    return Err("not enough cash or credit".into());
                }
                self.spend(cost, |l| &mut l.capex);
                let id = MachineId(self.next_machine_id);
                self.next_machine_id += 1;
                self.station_mut(station).machines.push(Machine {
                    id,
                    condition: 100.0,
                    down_until: None,
                    operating_hours: 0,
                });
                self.emit(
                    Severity::Info,
                    format!("Bought a machine for {} (${cost})", station.label()),
                    EventKind::MachineBought { station, cost },
                );
                Ok(())
            }
            Action::SellMachine { station } => {
                let st = self.station_mut(station);
                if st.machines.len() <= 1 {
                    return Err("a station needs at least one machine".into());
                }
                // Sell the most worn machine.
                let worst = st
                    .machines
                    .iter()
                    .enumerate()
                    .min_by(|a, b| a.1.condition.total_cmp(&b.1.condition))
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                let m = st.machines.remove(worst);
                let price = station.spec().machine_price as f64;
                let proceeds = (price * RESALE_FRACTION * m.condition / 100.0).round() as i64;
                self.cash += proceeds;
                self.ledger.capex -= proceeds;
                self.emit(
                    Severity::Info,
                    format!("Sold a {} machine for ${proceeds}", station.label()),
                    EventKind::MachineSold { station, proceeds },
                );
                Ok(())
            }
            Action::AcceptContract { contract } => contracts::accept(self, contract),
            Action::DeclineContract { contract } => contracts::decline(self, contract),
            Action::ShipNow { contract } => {
                let c = self
                    .contracts
                    .iter()
                    .find(|c| c.id == contract)
                    .ok_or("unknown contract")?;
                if c.status != ContractStatus::Active {
                    return Err("contract is not active".into());
                }
                contracts::ship(self, contract);
                Ok(())
            }
        }
    }
}

fn validate_plan(plan: InspectionPlan) -> Result<(), String> {
    match plan {
        InspectionPlan::Sample { percent } if !(1..=100).contains(&percent) => {
            Err("sample percent must be 1..=100".into())
        }
        _ => Ok(()),
    }
}
