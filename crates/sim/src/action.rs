//! Player actions. Every state change the player makes goes through
//! [`crate::GameState::apply`], so a seed plus an action log replays a game.

use crate::catalog::{Item, StationKind};
use crate::model::{ContractId, SupplierId};
use crate::policy::InspectionPlan;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    /// `expedite` ships by air: about a third of the lead time for +50% cost.
    PlaceOrder {
        supplier: SupplierId,
        qty: u32,
        #[serde(default)]
        expedite: bool,
    },
    SetReorder {
        item: Item,
        supplier: SupplierId,
        reorder_point: u32,
        order_qty: u32,
        enabled: bool,
    },
    SetIqc {
        item: Item,
        plan: InspectionPlan,
    },
    SetEol {
        plan: InspectionPlan,
    },
    SetShifts {
        shifts: u8,
    },
    SetWipCap {
        station: StationKind,
        cap: u32,
    },
    SetAutoShip {
        enabled: bool,
    },
    BuyMachine {
        station: StationKind,
    },
    SellMachine {
        station: StationKind,
    },
    AcceptContract {
        contract: ContractId,
    },
    DeclineContract {
        contract: ContractId,
    },
    ShipNow {
        contract: ContractId,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionError(pub String);

impl std::fmt::Display for ActionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ActionError {}
