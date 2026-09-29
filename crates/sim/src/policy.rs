//! Player-controlled policy knobs.

use crate::catalog::{Item, StationKind};
use crate::model::SupplierId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// How much of a lot to inspect.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum InspectionPlan {
    Skip,
    /// Inspect this percentage of units (1..=100).
    Sample {
        percent: u8,
    },
    Full,
}

impl InspectionPlan {
    /// Fraction of units that get inspected.
    pub fn fraction(self) -> f64 {
        match self {
            InspectionPlan::Skip => 0.0,
            InspectionPlan::Sample { percent } => f64::from(percent.clamp(1, 100)) / 100.0,
            InspectionPlan::Full => 1.0,
        }
    }
}

/// Automatic purchasing for one part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReorderPolicy {
    pub enabled: bool,
    pub supplier: SupplierId,
    /// Reorder when on-hand plus on-order falls below this.
    pub reorder_point: u32,
    pub order_qty: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Policies {
    /// 1, 2, or 3 eight-hour shifts per day.
    pub shifts: u8,
    pub iqc: BTreeMap<Item, InspectionPlan>,
    pub eol: InspectionPlan,
    pub reorder: BTreeMap<Item, ReorderPolicy>,
    /// Auto-ship finished goods to active contracts at end of day.
    pub auto_ship: bool,
}

impl Policies {
    /// Whether the plant is staffed at `hour` (0..24).
    pub fn is_operating(&self, hour: u32) -> bool {
        match self.shifts {
            0 => false,
            1 => (8..16).contains(&hour),
            2 => hour >= 8,
            _ => true,
        }
    }
}

/// Default output buffer target per station.
pub fn default_wip_cap(kind: StationKind) -> u32 {
    match kind {
        StationKind::EolTest => 10_000,
        StationKind::Smt => 150,
        _ => 100,
    }
}
