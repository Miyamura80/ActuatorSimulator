//! Game event log. The UI reads events newer than the last `seq` it saw.

use crate::catalog::{Item, StationKind};
use crate::model::{ContractId, LotId, OrderId, SupplierId, Tick};
use serde::{Deserialize, Serialize};

/// Events kept in state; older ones are dropped.
pub const EVENT_LOG_CAP: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Info,
    Good,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventKind {
    OrderPlaced {
        order: OrderId,
        supplier: SupplierId,
        item: Item,
        qty: u32,
        cost: i64,
    },
    OrderLate {
        order: OrderId,
        supplier: SupplierId,
        item: Item,
    },
    OrderArrived {
        order: OrderId,
        lot: LotId,
        item: Item,
        qty: u32,
        late_hours: u32,
    },
    IqcPassed {
        lot: LotId,
        item: Item,
        inspected: u32,
        found: u32,
    },
    IqcRejected {
        lot: LotId,
        item: Item,
        supplier: SupplierId,
        inspected: u32,
        found: u32,
    },
    StationStarved {
        station: StationKind,
        item: Item,
    },
    ContractOffered {
        contract: ContractId,
    },
    ContractAccepted {
        contract: ContractId,
    },
    ContractDeclined {
        contract: ContractId,
    },
    ContractExpired {
        contract: ContractId,
    },
    Shipped {
        contract: ContractId,
        qty: u32,
        revenue: i64,
    },
    ContractCompleted {
        contract: ContractId,
        on_time: bool,
        reputation_gain: f64,
    },
    ContractLate {
        contract: ContractId,
        penalty: i64,
    },
    ContractFailed {
        contract: ContractId,
    },
    MachineBought {
        station: StationKind,
        cost: i64,
    },
    MachineSold {
        station: StationKind,
        proceeds: i64,
    },
    PriceSpike {
        supplier: SupplierId,
        percent: u32,
        days: u32,
    },
    PriceNormal {
        supplier: SupplierId,
    },
    SupplierBankrupt {
        supplier: SupplierId,
        lost_value: i64,
    },
    MaintenanceStarted {
        station: StationKind,
        cost: i64,
    },
    Breakdown {
        station: StationKind,
        hours: u32,
        cost: i64,
    },
    SpcAlarm {
        station: StationKind,
    },
    FieldFailure {
        contract: ContractId,
        lot: LotId,
        units: u32,
        doa: bool,
        cost: i64,
    },
    Recall {
        lot: LotId,
        recalled: u32,
        scrapped: u32,
        /// Pending field failures the recall prevented.
        averted: u32,
        cost: i64,
    },
    LotScrapped {
        lot: LotId,
        qty: u32,
    },
    LowCash {
        cash: i64,
    },
    Bankrupt {
        cash: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub seq: u64,
    pub tick: Tick,
    pub severity: Severity,
    pub message: String,
    pub kind: EventKind,
}
