//! Station processing: consume inputs FIFO, build units, propagate defects,
//! run the end-of-line test, and batch output into lots.

use crate::catalog::{Item, StationKind, EOL_TEST_COVERAGE, LABOR_PER_MACHINE_HOUR};
use crate::event::{EventKind, Severity};
use crate::model::*;
use crate::policy::InspectionPlan;
use crate::state::{station_index, GameState};
use crate::systems::maintenance::drift_factor;

/// Open lots are released after this many ticks even if not full.
const MAX_LOT_AGE: u32 = 2;
/// Bench capacity used by a unit that skips the test (handling only).
const UNTESTED_COST: f64 = 0.15;

/// Output speed multiplier from machine condition (0..=100).
pub fn speed_factor(condition: f64) -> f64 {
    0.7 + 0.3 * (condition / 100.0)
}

/// Process defect multiplier from machine condition: 1x when new, 4x at 0.
pub fn defect_factor(condition: f64) -> f64 {
    let wear = 1.0 - condition / 100.0;
    1.0 + 3.0 * wear * wear
}

pub fn tick(state: &mut GameState) {
    let operating = state.policies.is_operating(state.hour());
    for kind in StationKind::ALL {
        let idx = station_index(kind);
        if operating {
            run_station(state, idx);
        } else {
            state.stations[idx].busy = false;
        }
        close_lot_if_due(state, idx);
    }
}

fn run_station(state: &mut GameState, idx: usize) {
    let kind = state.stations[idx].kind;
    let spec = kind.spec();
    let wear_mult = state.tuning.wear_mult;

    let mut capacity = 0.0;
    let mut up = 0;
    for m in state.stations[idx].machines.iter().filter(|m| m.is_up()) {
        up += 1;
        capacity += spec.rate_per_hour * speed_factor(m.condition);
    }
    let labor = up as i64 * LABOR_PER_MACHINE_HOUR;
    if labor > 0 {
        state.spend(labor, |l| &mut l.labor);
    }
    if up == 0 {
        state.stations[idx].busy = false;
        return;
    }

    let avg_condition = {
        let ms = &state.stations[idx].machines;
        let live: Vec<f64> = ms
            .iter()
            .filter(|m| m.is_up())
            .map(|m| m.condition)
            .collect();
        live.iter().sum::<f64>() / live.len() as f64
    };
    state.stations[idx].progress += capacity;

    let mut built = 0;
    let mut starved = None;
    while state.stations[idx].progress >= 1.0 {
        let st = &state.stations[idx];
        let open_qty = st.open_lot.map(|l| state.lot(l).qty).unwrap_or(0);
        if kind != StationKind::EolTest && state.available(spec.output) + open_qty >= st.wip_cap {
            break;
        }
        if let Some((item, _)) = spec
            .inputs
            .iter()
            .find(|(item, n)| state.available(*item) < *n)
        {
            starved = Some(*item);
            break;
        }
        let cost = if kind == StationKind::EolTest {
            test_one(state, idx)
        } else {
            build_one(state, idx, avg_condition);
            1.0
        };
        state.stations[idx].progress -= cost;
        built += 1;
    }

    let st = &mut state.stations[idx];
    // Unused capacity does not bank up while blocked or starved.
    st.progress = st.progress.min(1.0);
    st.busy = built > 0;
    if built > 0 {
        let wear = spec.wear_per_hour * wear_mult;
        for m in st.machines.iter_mut().filter(|m| m.is_up()) {
            m.condition = (m.condition - wear).max(0.0);
            m.operating_hours += 1;
            m.hours_since_pm += 1;
        }
    }
    let was_starved = st.starved_on;
    st.starved_on = starved;
    if let Some(item) = starved {
        // Waiting on an upstream station is normal flow; only flag parts shortages.
        if was_starved != Some(item) && item.is_purchased() {
            state.emit(
                Severity::Warning,
                format!("{} is waiting on {}", kind.label(), item.label()),
                EventKind::StationStarved {
                    station: kind,
                    item,
                },
            );
        }
    }
}

/// Build one unit: any bad input makes a bad unit, plus a chance of a process
/// defect that grows as the machine wears.
fn build_one(state: &mut GameState, idx: usize, condition: f64) {
    let kind = state.stations[idx].kind;
    let spec = kind.spec();
    let mut defective = false;
    let mut latent = false;
    let mut input_lots = Vec::new();
    for (item, n) in spec.inputs {
        let drawn = state.take_units(*item, *n);
        defective |= drawn.defects > 0;
        latent |= drawn.latent > 0;
        input_lots.extend(drawn.parts.iter().map(|p| p.lot));
    }
    let factor = defect_factor(condition) * drift_factor(state.stations[idx].drift);
    if !defective && state.rng.chance(spec.process_defect * factor) {
        defective = true;
    }
    if !defective && !latent && state.rng.chance(spec.process_latent * factor) {
        latent = true;
    }
    add_to_open_lot(
        state,
        idx,
        spec.output,
        defective,
        latent && !defective,
        &input_lots,
    );
}

/// Test (or pass through) one actuator. Returns bench capacity used.
fn test_one(state: &mut GameState, idx: usize) -> f64 {
    let drawn = state.take_units(Item::Actuator, 1);
    let lots: Vec<LotId> = drawn.parts.iter().map(|p| p.lot).collect();
    let defective = drawn.defects > 0;
    let latent = drawn.latent > 0;
    let tested = match state.policies.eol {
        InspectionPlan::Full => true,
        InspectionPlan::Skip => false,
        plan @ InspectionPlan::Sample { .. } => state.rng.chance(plan.fraction()),
    };
    // A drifting test bench (miscalibration) misses more defects.
    let drift = state.stations[idx].drift;
    let coverage = EOL_TEST_COVERAGE / (1.0 + drift * drift / 2.0);
    if tested && defective && state.rng.chance(coverage) {
        state.stations[idx].units_scrapped += 1;
        state.today.scrapped += 1;
        return 1.0;
    }
    add_to_open_lot(state, idx, Item::FinishedGood, defective, latent, &lots);
    state.today.produced += 1;
    if tested {
        1.0
    } else {
        UNTESTED_COST
    }
}

fn add_to_open_lot(
    state: &mut GameState,
    idx: usize,
    item: Item,
    defective: bool,
    latent: bool,
    inputs: &[LotId],
) {
    let kind = state.stations[idx].kind;
    let lot_id = match state.stations[idx].open_lot {
        Some(id) => id,
        None => {
            let origin = LotOrigin::Built {
                station: kind,
                inputs: Vec::new(),
            };
            let id = state.new_lot(item, 0, origin, LotStatus::Open);
            state.stations[idx].open_lot = Some(id);
            id
        }
    };
    let lot = &mut state.lots[lot_id.0 as usize];
    lot.qty += 1;
    lot.initial_qty += 1;
    if defective {
        lot.defects += 1;
    } else if latent {
        lot.latent += 1;
    }
    if let LotOrigin::Built { inputs: known, .. } = &mut lot.origin {
        for id in inputs {
            if !known.contains(id) {
                known.push(*id);
            }
        }
    }
    state.stations[idx].units_built += 1;
}

fn close_lot_if_due(state: &mut GameState, idx: usize) {
    let Some(lot_id) = state.stations[idx].open_lot else {
        return;
    };
    let lot_size = state.stations[idx].kind.spec().lot_size;
    let lot = state.lot(lot_id);
    let full = lot.qty >= lot_size;
    let old = state.tick.saturating_sub(lot.created) >= MAX_LOT_AGE;
    if full || old {
        state.stations[idx].open_lot = None;
        state.release_lot(lot_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wear_slows_and_degrades() {
        assert!(speed_factor(100.0) > speed_factor(20.0));
        assert!((defect_factor(100.0) - 1.0).abs() < 1e-9);
        assert!((defect_factor(0.0) - 4.0).abs() < 1e-9);
    }
}
