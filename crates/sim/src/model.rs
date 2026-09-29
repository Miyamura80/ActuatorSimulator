//! Plain data types held by [`crate::GameState`].

use crate::catalog::{Item, StationKind, Tier};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

/// One tick is one hour of game time.
pub type Tick = u32;
pub const TICKS_PER_DAY: u32 = 24;

macro_rules! id_type {
    ($name:ident, $inner:ty) => {
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize,
        )]
        #[serde(transparent)]
        pub struct $name(pub $inner);
    };
}

id_type!(LotId, u32);
id_type!(SupplierId, u16);
id_type!(OrderId, u32);
id_type!(ContractId, u32);
id_type!(MachineId, u32);

/// A supplier as it exists in this game (base table plus per-seed jitter).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplier {
    pub id: SupplierId,
    pub name: String,
    pub item: Item,
    pub tier: Tier,
    pub unit_price: i64,
    pub defect_rate: f64,
    pub latent_rate: f64,
    pub lead_days: u32,
    pub reliability: f64,
    pub min_order: u32,
    pub active: bool,
    /// Current price multiplier (price spikes).
    pub price_mult: f64,
    pub price_spike_until: Option<Tick>,
    /// Hidden: this many upcoming deliveries are bad lots.
    pub bad_lots_pending: u32,
    /// Lots received / rejected at IQC, for the player's scorecard.
    pub lots_received: u32,
    pub lots_rejected: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LotOrigin {
    /// Stock the plant starts the game with.
    Opening { supplier: SupplierId },
    Purchased {
        supplier: SupplierId,
        order: OrderId,
    },
    Built {
        station: StationKind,
        inputs: Vec<LotId>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LotStatus {
    /// Still being filled at a station.
    Open,
    Available,
    /// Failed incoming inspection and went back to the supplier.
    Rejected,
    /// Scrapped by the player (quarantine, recall).
    Scrapped,
}

/// A batch of identical items. `defects` and `latent` are hidden from the
/// player: they only surface through inspection, test, or field failures.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lot {
    pub id: LotId,
    pub item: Item,
    /// Units still in this lot.
    pub qty: u32,
    /// Units the lot started with.
    pub initial_qty: u32,
    /// Remaining units with a detectable defect.
    pub defects: u32,
    /// Remaining units with a latent (field-only) defect. Disjoint from `defects`.
    pub latent: u32,
    pub origin: LotOrigin,
    pub created: Tick,
    pub status: LotStatus,
    /// Shipped units from this lot were recalled.
    #[serde(default)]
    pub recalled: bool,
    /// Shipped units from this lot that already failed at a customer.
    #[serde(default)]
    pub failed_in_field: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,
    Received,
    /// The supplier went bust before shipping.
    Lost,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchaseOrder {
    pub id: OrderId,
    pub supplier: SupplierId,
    pub item: Item,
    pub qty: u32,
    pub unit_price: i64,
    pub expedited: bool,
    pub placed: Tick,
    /// Tick the player was quoted.
    pub promised: Tick,
    /// Tick it will actually arrive (hidden until then).
    pub arrives: Tick,
    pub status: OrderStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Machine {
    pub id: MachineId,
    /// 0..=100. Lower condition means slower output and more defects.
    pub condition: f64,
    /// Out of service (repair or maintenance) until this tick.
    pub down_until: Option<Tick>,
    pub down_reason: Option<DownReason>,
    pub operating_hours: u32,
    /// Operating hours since the last preventive maintenance.
    pub hours_since_pm: u32,
}

impl Machine {
    pub fn new(id: MachineId) -> Self {
        Self {
            id,
            condition: 100.0,
            down_until: None,
            down_reason: None,
            operating_hours: 0,
            hours_since_pm: 0,
        }
    }

    pub fn is_up(&self) -> bool {
        self.down_until.is_none()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownReason {
    Breakdown,
    Maintenance,
}

/// SPC samples kept per station.
pub const SPC_HISTORY: usize = 48;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Station {
    pub kind: StationKind,
    pub machines: Vec<Machine>,
    /// Fractional units of capacity carried between ticks.
    pub progress: f64,
    /// Stop producing when this many output units are in stock.
    pub wip_cap: u32,
    pub open_lot: Option<LotId>,
    pub units_built: u64,
    pub units_scrapped: u64,
    /// Whether the station did work in the last tick (for the 3D view).
    pub busy: bool,
    /// Why the station was idle in the last operating tick, if it was.
    pub starved_on: Option<Item>,
    /// Hidden process mean shift in sigma units (tool wear, breakage).
    pub drift: f64,
    /// X-bar samples (subgroup of 5, every 3 hours), newest last, in sigma units.
    pub spc: VecDeque<f64>,
    /// An SPC rule is currently violated.
    pub spc_alarm: bool,
    /// Preventive maintenance every this many operating hours (0 = never).
    pub pm_interval: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QualityTier {
    Standard,
    Premium,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContractStatus {
    Offered,
    Active,
    Completed,
    Failed,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contract {
    pub id: ContractId,
    pub customer: String,
    pub qty: u32,
    pub unit_price: i64,
    pub quality: QualityTier,
    /// Last tick the offer can be accepted.
    pub offer_expires: Tick,
    /// Delivery deadline, relative to acceptance, in days.
    pub lead_days: u32,
    /// Absolute deadline tick, set on acceptance.
    pub deadline: Option<Tick>,
    pub delivered: u32,
    pub status: ContractStatus,
    /// Late penalty per day, as a fraction of contract value.
    pub late_penalty_rate: f64,
    pub penalties_paid: i64,
}

impl Supplier {
    /// Price per unit today, including any spike.
    pub fn current_price(&self) -> i64 {
        (self.unit_price as f64 * self.price_mult).round() as i64
    }
}

impl Contract {
    pub fn value(&self) -> i64 {
        self.qty as i64 * self.unit_price
    }

    pub fn remaining(&self) -> u32 {
        self.qty.saturating_sub(self.delivered)
    }
}

/// Units of one lot that went out in a shipment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShippedPart {
    pub lot: LotId,
    pub qty: u32,
    pub defects: u32,
    pub latent: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shipment {
    pub contract: ContractId,
    pub tick: Tick,
    pub parts: Vec<ShippedPart>,
}

/// Running money totals by category.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Ledger {
    pub revenue: i64,
    pub materials: i64,
    pub labor: i64,
    pub overhead: i64,
    pub capex: i64,
    pub inspection: i64,
    pub penalties: i64,
    pub maintenance: i64,
    pub rma: i64,
    pub recalls: i64,
    pub refunds: i64,
}

impl Ledger {
    pub fn costs(&self) -> i64 {
        self.materials
            + self.labor
            + self.overhead
            + self.capex
            + self.inspection
            + self.penalties
            + self.maintenance
            + self.rma
            + self.recalls
            - self.refunds
    }
}

/// End-of-day snapshot for charts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaySummary {
    pub day: u32,
    pub cash: i64,
    pub reputation: f64,
    pub revenue: i64,
    pub costs: i64,
    pub produced: u32,
    pub shipped: u32,
    pub scrapped: u32,
    pub iqc_rejects: u32,
    pub field_failures: u32,
    pub breakdowns: u32,
}

/// A shipped unit that will fail at the customer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingFailure {
    pub due: Tick,
    pub contract: ContractId,
    /// Finished-goods lot the unit shipped from.
    pub lot: LotId,
    /// Dead on arrival (detectable defect) rather than a latent failure.
    pub doa: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum GameStatus {
    Running,
    Bankrupt { day: u32 },
}
