//! Equipment health: wear-driven breakdowns, tool breaks that shift the
//! process mean, SPC sampling that can reveal the shift, and preventive
//! maintenance (scheduled or on demand).

use crate::catalog::StationKind;
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::state::{station_index, GameState};

/// Breakdown odds per operating hour for a machine in new condition.
const BREAKDOWN_BASE: f64 = 0.0012;
/// Tool-break odds per station per operating hour at full condition.
const TOOL_BREAK_BASE: f64 = 0.0015;
/// Preventive maintenance downtime and cost (fraction of machine price).
pub const PM_HOURS: u32 = 3;
const PM_COST_FRACTION: f64 = 0.015;
/// Repair cost as a fraction of machine price, and condition after repair.
const REPAIR_COST_FRACTION: f64 = 0.06;
const REPAIR_CONDITION: f64 = 70.0;
/// SPC subgroup size; control limits are +/-3 sigma of the subgroup mean.
const SPC_SUBGROUP: f64 = 5.0;
/// Run rule: this many consecutive points on one side of center.
const SPC_RUN_LENGTH: usize = 9;
/// Take an SPC sample every this many hours.
const SPC_EVERY_HOURS: u32 = 3;
/// An alarm clears itself after this many in-control points in a row.
const SPC_CLEAR_AFTER: usize = 12;

/// Process defect multiplier from the hidden mean shift.
pub fn drift_factor(drift: f64) -> f64 {
    (drift * drift / 2.0).exp().min(25.0)
}

/// Control limit for x-bar charts, in process-sigma units.
pub fn spc_limit() -> f64 {
    3.0 / SPC_SUBGROUP.sqrt()
}

/// Runs every tick before production.
pub fn tick(state: &mut GameState) {
    let now = state.tick;
    let operating = state.policies.is_operating(state.hour());
    for kind in StationKind::ALL {
        let idx = station_index(kind);
        return_machines(state, idx, now);
        if !operating {
            continue;
        }
        auto_pm(state, idx);
        roll_breakdowns(state, idx);
        roll_drift(state, idx);
        sample_spc(state, idx);
    }
}

/// Bring machines back once repair or maintenance is over.
fn return_machines(state: &mut GameState, idx: usize, now: Tick) {
    for m in &mut state.stations[idx].machines {
        if m.down_until.is_some_and(|t| t <= now) {
            m.down_until = None;
            m.down_reason = None;
        }
    }
}

fn auto_pm(state: &mut GameState, idx: usize) {
    let st = &state.stations[idx];
    if st.pm_interval == 0 {
        return;
    }
    // One machine at a time so the station keeps running when it can.
    if st
        .machines
        .iter()
        .any(|m| m.down_reason == Some(DownReason::Maintenance))
    {
        return;
    }
    let due = st
        .machines
        .iter()
        .position(|m| m.is_up() && m.hours_since_pm >= st.pm_interval);
    if let Some(i) = due {
        start_pm(state, idx, i, false);
    }
}

/// Take machine `i` offline for preventive maintenance.
fn start_pm(state: &mut GameState, idx: usize, i: usize, manual: bool) {
    let kind = state.stations[idx].kind;
    let cost = (kind.spec().machine_price as f64 * PM_COST_FRACTION).round() as i64;
    state.spend(cost, |l| &mut l.maintenance);
    let now = state.tick;
    let st = &mut state.stations[idx];
    let m = &mut st.machines[i];
    m.down_until = Some(now + PM_HOURS);
    m.down_reason = Some(DownReason::Maintenance);
    m.condition = 100.0;
    m.hours_since_pm = 0;
    // New tooling and a fresh setup put the process back on center.
    st.drift = 0.0;
    st.spc_alarm = false;
    let msg = if manual {
        format!("Maintenance started on {} (${cost})", kind.label())
    } else {
        format!("Scheduled maintenance on {} (${cost})", kind.label())
    };
    state.emit(
        Severity::Info,
        msg,
        EventKind::MaintenanceStarted {
            station: kind,
            cost,
        },
    );
}

/// Player-requested maintenance on the most worn working machine.
pub fn maintain(state: &mut GameState, kind: StationKind) -> Result<(), String> {
    let idx = station_index(kind);
    let worst = state.stations[idx]
        .machines
        .iter()
        .enumerate()
        .filter(|(_, m)| m.is_up())
        .min_by(|a, b| a.1.condition.total_cmp(&b.1.condition))
        .map(|(i, _)| i)
        .ok_or("no working machine to maintain")?;
    start_pm(state, idx, worst, true);
    Ok(())
}

fn roll_breakdowns(state: &mut GameState, idx: usize) {
    let kind = state.stations[idx].kind;
    let mult = state.tuning.breakdown_mult;
    for i in 0..state.stations[idx].machines.len() {
        let m = &state.stations[idx].machines[i];
        if !m.is_up() {
            continue;
        }
        let wear = 1.0 - m.condition / 100.0;
        let hazard = BREAKDOWN_BASE * (1.0 + 8.0 * wear * wear) * mult;
        if !state.rng.chance(hazard) {
            continue;
        }
        let hours = state.rng.range(6, 30);
        let cost = (kind.spec().machine_price as f64 * REPAIR_COST_FRACTION).round() as i64;
        state.spend(cost, |l| &mut l.maintenance);
        let now = state.tick;
        let m = &mut state.stations[idx].machines[i];
        m.down_until = Some(now + hours);
        m.down_reason = Some(DownReason::Breakdown);
        m.condition = m.condition.max(REPAIR_CONDITION);
        state.today.breakdowns += 1;
        state.emit(
            Severity::Critical,
            format!(
                "{} machine broke down: {hours}h repair, ${cost}",
                kind.label()
            ),
            EventKind::Breakdown {
                station: kind,
                hours,
                cost,
            },
        );
    }
}

/// Slow random walk plus occasional tool breaks that shift the mean.
fn roll_drift(state: &mut GameState, idx: usize) {
    let (condition, busy) = {
        let st = &state.stations[idx];
        let up: Vec<f64> = st
            .machines
            .iter()
            .filter(|m| m.is_up())
            .map(|m| m.condition)
            .collect();
        if up.is_empty() {
            return;
        }
        (up.iter().sum::<f64>() / up.len() as f64, st.busy)
    };
    if !busy {
        return;
    }
    let wear = 1.0 - condition / 100.0;
    let walk = state.rng.normal(0.0, 0.01 * (1.0 + wear));
    let odds = TOOL_BREAK_BASE * (1.0 + 3.0 * wear) * state.tuning.breakdown_mult;
    let broke = state.rng.chance(odds);
    let jump = if broke {
        let size = state.rng.range_f64(1.5, 3.0);
        if state.rng.chance(0.5) {
            size
        } else {
            -size
        }
    } else {
        0.0
    };
    let st = &mut state.stations[idx];
    st.drift = if broke {
        jump
    } else {
        (st.drift + walk).clamp(-4.0, 4.0)
    };
}

/// Every few hours, record one x-bar point and evaluate the SPC rules. Alarms are edge
/// triggered so the log gets one entry per excursion.
fn sample_spc(state: &mut GameState, idx: usize) {
    if !state.stations[idx].busy || !state.tick.is_multiple_of(SPC_EVERY_HOURS) {
        return;
    }
    let condition = {
        let ms = &state.stations[idx].machines;
        ms.iter().map(|m| m.condition).sum::<f64>() / ms.len() as f64
    };
    let sigma = 1.0 + 0.2 * (1.0 - condition / 100.0);
    let drift = state.stations[idx].drift;
    let xbar = state.rng.normal(drift, sigma / SPC_SUBGROUP.sqrt());
    let st = &mut state.stations[idx];
    st.spc.push_back(xbar);
    while st.spc.len() > SPC_HISTORY {
        st.spc.pop_front();
    }
    let limit = spc_limit();
    let beyond = xbar.abs() > limit;
    let run = st.spc.len() >= SPC_RUN_LENGTH && {
        let tail: Vec<f64> = st.spc.iter().rev().take(SPC_RUN_LENGTH).copied().collect();
        tail.iter().all(|x| *x > 0.0) || tail.iter().all(|x| *x < 0.0)
    };
    let violated = beyond || run;
    if st.spc_alarm && !violated && st.spc.len() >= SPC_CLEAR_AFTER {
        let calm = st
            .spc
            .iter()
            .rev()
            .take(SPC_CLEAR_AFTER)
            .all(|x| x.abs() <= limit);
        if calm {
            st.spc_alarm = false;
        }
    }
    if violated && !st.spc_alarm {
        st.spc_alarm = true;
        let kind = st.kind;
        let rule = if beyond {
            "point outside control limits"
        } else {
            "9 points on one side of center"
        };
        state.emit(
            Severity::Warning,
            format!("SPC alarm on {}: {rule}", kind.label()),
            EventKind::SpcAlarm { station: kind },
        );
    }
}
