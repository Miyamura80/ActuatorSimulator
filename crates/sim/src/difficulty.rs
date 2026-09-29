//! Difficulty presets. Every balance knob that depends on difficulty lives here.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    Easy,
    #[default]
    Normal,
    Hard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tuning {
    pub start_cash: i64,
    /// Game over when cash drops below `-overdraft_limit` at end of day.
    pub overdraft_limit: i64,
    pub overhead_per_day: i64,
    /// Multiplies every supplier's defect and latent rates.
    pub supplier_defect_mult: f64,
    /// Multiplies machine wear.
    pub wear_mult: f64,
    /// Multiplies contract unit prices.
    pub contract_price_mult: f64,
    /// Multiplies contract lead times.
    pub contract_lead_mult: f64,
    /// Multiplies supplier event odds (bad lots, price spikes, bankruptcies).
    pub event_mult: f64,
    /// Multiplies machine breakdown and tool-break odds.
    pub breakdown_mult: f64,
    /// Multiplies RMA and recall costs.
    pub rma_cost_mult: f64,
}

impl Difficulty {
    pub fn tuning(self) -> Tuning {
        match self {
            Difficulty::Easy => Tuning {
                start_cash: 400_000,
                overdraft_limit: 150_000,
                overhead_per_day: 1_500,
                supplier_defect_mult: 0.6,
                wear_mult: 0.7,
                contract_price_mult: 1.15,
                contract_lead_mult: 1.3,
                event_mult: 0.5,
                breakdown_mult: 0.6,
                rma_cost_mult: 0.7,
            },
            Difficulty::Normal => Tuning {
                start_cash: 250_000,
                overdraft_limit: 75_000,
                overhead_per_day: 2_000,
                supplier_defect_mult: 1.0,
                wear_mult: 1.0,
                contract_price_mult: 1.0,
                contract_lead_mult: 1.0,
                event_mult: 1.0,
                breakdown_mult: 1.0,
                rma_cost_mult: 1.0,
            },
            Difficulty::Hard => Tuning {
                start_cash: 150_000,
                overdraft_limit: 25_000,
                overhead_per_day: 2_500,
                supplier_defect_mult: 1.5,
                wear_mult: 1.3,
                contract_price_mult: 0.9,
                contract_lead_mult: 0.8,
                event_mult: 1.5,
                breakdown_mult: 1.4,
                rma_cost_mult: 1.3,
            },
        }
    }
}
