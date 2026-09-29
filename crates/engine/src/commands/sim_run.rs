//! `sim_run` - play headless autopilot games for balance checks.
//!
//! Runs `seeds` games starting at `seed` and reports per-run results plus an
//! aggregate, so a balance change can be checked across many seeds at once:
//! `actsim call sim_run --args '{"seeds": 20, "days": 90}' --json`.

use crate::commands::{Command, CommandError};
use crate::context::Ctx;
use crate::register_command;
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sim::model::ContractStatus;
use sim::{bot, Difficulty, GameState};

const MAX_SEEDS: u32 = 200;
const MAX_DAYS: u32 = 365;

#[derive(Default)]
pub struct SimRun;

fn default_seed() -> u64 {
    1
}
fn default_days() -> u32 {
    60
}
fn default_seeds() -> u32 {
    1
}
fn default_difficulty() -> String {
    "normal".into()
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SimRunInput {
    /// First seed to play.
    #[serde(default = "default_seed")]
    pub seed: u64,
    /// Number of consecutive seeds to play.
    #[serde(default = "default_seeds")]
    pub seeds: u32,
    /// Game days per run.
    #[serde(default = "default_days")]
    pub days: u32,
    /// `easy`, `normal` or `hard`.
    #[serde(default = "default_difficulty")]
    pub difficulty: String,
    /// Include the day-by-day history of each run.
    #[serde(default)]
    pub history: bool,
}

#[derive(Debug, Serialize, JsonSchema)]
pub struct RunSummary {
    pub seed: u64,
    pub bankrupt_day: Option<u32>,
    pub days_played: u32,
    pub cash: i64,
    pub reputation: f64,
    pub revenue: i64,
    pub costs: i64,
    pub produced: u32,
    pub shipped: u32,
    pub scrapped: u32,
    pub iqc_rejects: u32,
    /// Shipped units that carried a detectable defect (escapes).
    pub escaped_defects: u32,
    /// Shipped units that carried a latent defect.
    pub escaped_latent: u32,
    pub contracts_completed: u32,
    pub contracts_failed: u32,
    pub machines: u32,
    pub shifts: u8,
    /// Day-by-day summaries when `history` was requested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub history: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, JsonSchema)]
pub struct Aggregate {
    pub runs: u32,
    pub survived: u32,
    pub mean_cash: f64,
    pub mean_reputation: f64,
    pub mean_shipped: f64,
    /// Scrapped / (produced + scrapped) across all runs.
    pub scrap_rate: f64,
    /// Escaped defects per million shipped units.
    pub escape_ppm: f64,
}

#[derive(Debug, Serialize, JsonSchema)]
pub struct SimRunOutput {
    pub aggregate: Aggregate,
    pub runs: Vec<RunSummary>,
}

fn parse_difficulty(s: &str) -> Result<Difficulty, CommandError> {
    match s.to_ascii_lowercase().as_str() {
        "easy" => Ok(Difficulty::Easy),
        "normal" => Ok(Difficulty::Normal),
        "hard" => Ok(Difficulty::Hard),
        other => Err(CommandError::InvalidInput(format!(
            "difficulty must be easy, normal or hard (got {other})"
        ))),
    }
}

fn summarize(seed: u64, s: &GameState, history: bool) -> RunSummary {
    let sum = |f: fn(&sim::model::DaySummary) -> u32| s.history.iter().map(f).sum();
    let parts = s.shipments.iter().flat_map(|sh| &sh.parts);
    let (escaped_defects, escaped_latent) =
        parts.fold((0, 0), |(d, l), p| (d + p.defects, l + p.latent));
    let count = |st: ContractStatus| s.contracts.iter().filter(|c| c.status == st).count() as u32;
    RunSummary {
        seed,
        bankrupt_day: match s.status {
            sim::GameStatus::Bankrupt { day } => Some(day),
            sim::GameStatus::Running => None,
        },
        days_played: s.day(),
        cash: s.cash,
        reputation: s.reputation,
        revenue: s.ledger.revenue,
        costs: s.ledger.costs(),
        produced: sum(|d| d.produced),
        shipped: sum(|d| d.shipped),
        scrapped: sum(|d| d.scrapped),
        iqc_rejects: sum(|d| d.iqc_rejects),
        escaped_defects,
        escaped_latent,
        contracts_completed: count(ContractStatus::Completed),
        contracts_failed: count(ContractStatus::Failed),
        machines: s.stations.iter().map(|st| st.machines.len() as u32).sum(),
        shifts: s.policies.shifts,
        history: history.then(|| serde_json::to_value(&s.history).unwrap_or_default()),
    }
}

fn aggregate(runs: &[RunSummary]) -> Aggregate {
    let n = runs.len().max(1) as f64;
    let mean = |f: fn(&RunSummary) -> f64| runs.iter().map(f).sum::<f64>() / n;
    let produced: u64 = runs.iter().map(|r| u64::from(r.produced)).sum();
    let scrapped: u64 = runs.iter().map(|r| u64::from(r.scrapped)).sum();
    let shipped: u64 = runs.iter().map(|r| u64::from(r.shipped)).sum();
    let escaped: u64 = runs.iter().map(|r| u64::from(r.escaped_defects)).sum();
    Aggregate {
        runs: runs.len() as u32,
        survived: runs.iter().filter(|r| r.bankrupt_day.is_none()).count() as u32,
        mean_cash: mean(|r| r.cash as f64),
        mean_reputation: mean(|r| r.reputation),
        mean_shipped: mean(|r| f64::from(r.shipped)),
        scrap_rate: scrapped as f64 / (produced + scrapped).max(1) as f64,
        escape_ppm: escaped as f64 * 1e6 / shipped.max(1) as f64,
    }
}

#[async_trait]
impl Command for SimRun {
    type Input = SimRunInput;
    type Output = SimRunOutput;

    fn name(&self) -> &'static str {
        "sim_run"
    }

    fn description(&self) -> &'static str {
        "Play headless autopilot games across seeds and report balance stats."
    }

    async fn run(&self, input: SimRunInput, _cx: &Ctx<'_>) -> Result<SimRunOutput, CommandError> {
        let difficulty = parse_difficulty(&input.difficulty)?;
        if input.seeds == 0 || input.seeds > MAX_SEEDS {
            return Err(CommandError::InvalidInput(format!(
                "seeds must be 1..={MAX_SEEDS}"
            )));
        }
        if input.days == 0 || input.days > MAX_DAYS {
            return Err(CommandError::InvalidInput(format!(
                "days must be 1..={MAX_DAYS}"
            )));
        }
        let SimRunInput {
            seed,
            seeds,
            days,
            history,
            ..
        } = input;
        let runs = tokio::task::spawn_blocking(move || {
            (0..u64::from(seeds))
                .map(|i| {
                    let s = seed.wrapping_add(i);
                    summarize(s, &bot::play(s, difficulty, days), history)
                })
                .collect::<Vec<_>>()
        })
        .await
        .map_err(|e| CommandError::Other(format!("simulation task failed: {e}")))?;
        Ok(SimRunOutput {
            aggregate: aggregate(&runs),
            runs,
        })
    }
}

register_command!(SimRun);

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::AppContext;

    #[tokio::test]
    async fn runs_and_aggregates() {
        let app = AppContext::default();
        let cx = Ctx::new(&app);
        let input = SimRunInput {
            seed: 3,
            seeds: 2,
            days: 10,
            difficulty: "normal".into(),
            history: true,
        };
        let out = SimRun.run(input, &cx).await.unwrap();
        assert_eq!(out.aggregate.runs, 2);
        assert_eq!(out.runs[0].seed, 3);
        assert!(out.runs[0].history.is_some());
    }

    #[tokio::test]
    async fn rejects_bad_input() {
        let app = AppContext::default();
        let cx = Ctx::new(&app);
        let input = SimRunInput {
            seed: 1,
            seeds: 1,
            days: 10,
            difficulty: "nightmare".into(),
            history: false,
        };
        assert!(SimRun.run(input, &cx).await.is_err());
    }
}
