//! Failure systems: supplier events, breakdowns, SPC, field failures, recalls.

use sim::model::{DownReason, LotStatus, OrderStatus};
use sim::policy::InspectionPlan;
use sim::{bot, trace, Action, Difficulty, EventKind, GameState, Item, StationKind};

fn count_events(s: &GameState, pred: impl Fn(&EventKind) -> bool) -> usize {
    s.events.iter().filter(|e| pred(&e.kind)).count()
}

/// Play with the bot for `days`, applying `setup` first.
fn play_with(seed: u64, d: Difficulty, days: u32, setup: impl Fn(&mut GameState)) -> GameState {
    let mut s = GameState::new(seed, d);
    setup(&mut s);
    for _ in 0..days * 24 {
        if s.is_over() {
            break;
        }
        for a in bot::decide(&s) {
            let _ = s.apply(a);
        }
        s.step();
    }
    s
}

#[test]
fn skipping_maintenance_means_more_breakdowns() {
    let total = |pm: u32| -> u32 {
        (0..4)
            .map(|seed| {
                let s = play_with(seed, Difficulty::Normal, 60, |s| {
                    for k in StationKind::ALL {
                        s.apply(Action::SetPmInterval {
                            station: k,
                            hours: pm,
                        })
                        .unwrap();
                    }
                });
                s.history.iter().map(|d| d.breakdowns).sum::<u32>()
            })
            .sum()
    };
    let with_pm = total(80);
    let without = total(0);
    assert!(without > with_pm, "no PM {without} vs PM {with_pm}");
}

#[test]
fn manual_maintenance_takes_machine_offline_and_resets() {
    let mut s = GameState::new(3, Difficulty::Normal);
    s.run_days(5);
    s.stations[0].drift = 2.5;
    s.stations[0].machines[0].condition = 40.0;
    s.apply(Action::Maintain {
        station: StationKind::Mill,
    })
    .unwrap();
    let st = s.station(StationKind::Mill);
    assert_eq!(st.machines[0].down_reason, Some(DownReason::Maintenance));
    assert_eq!(st.machines[0].condition, 100.0);
    assert_eq!(st.drift, 0.0);
    // Nothing left to maintain while the only machine is down.
    assert!(s
        .apply(Action::Maintain {
            station: StationKind::Mill
        })
        .is_err());
    s.run_hours(4);
    assert!(s.station(StationKind::Mill).machines[0].is_up());
}

#[test]
fn a_large_drift_trips_spc() {
    let mut s = GameState::new(8, Difficulty::Normal);
    // Get to a working hour with stock flowing, then knock the gear cutter off center.
    s.run_hours(10);
    let idx = StationKind::ALL
        .iter()
        .position(|k| *k == StationKind::GearCut)
        .unwrap();
    s.stations[idx].pm_interval = 0;
    s.stations[idx].drift = 3.0;
    s.run_hours(8);
    assert!(
        count_events(&s, |k| matches!(
            k,
            EventKind::SpcAlarm {
                station: StationKind::GearCut
            }
        )) > 0
    );
}

#[test]
fn escapes_turn_into_field_failures() {
    let s = play_with(12, Difficulty::Hard, 80, |s| {
        s.apply(Action::SetEol {
            plan: InspectionPlan::Skip,
        })
        .unwrap();
    });
    let failures: u32 = s.history.iter().map(|d| d.field_failures).sum();
    assert!(failures > 0, "expected RMAs with EOL test skipped");
    assert!(s.ledger.rma > 0);
}

#[test]
fn recall_cancels_pending_failures_for_traced_lots() {
    let mut s = play_with(12, Difficulty::Hard, 30, |s| {
        s.apply(Action::SetEol {
            plan: InspectionPlan::Skip,
        })
        .unwrap();
    });
    let pending = s
        .pending_failures
        .first()
        .cloned()
        .expect("some failures pending");
    // Recall from a purchased ancestor: genealogy must reach the shipped lot.
    let root = trace::ancestors(&s, pending.lot)
        .into_iter()
        .find(|id| trace::supplier_of(&s, *id).is_some())
        .expect("finished lot traces back to a purchased lot");
    assert!(trace::descendants(&s, root).contains(&pending.lot));
    s.apply(Action::Recall { lot: root }).unwrap();
    assert!(s.pending_failures.iter().all(|f| f.lot != pending.lot));
    assert!(s.lot(pending.lot).recalled);
    assert!(s.ledger.recalls > 0);
}

#[test]
fn scrap_removes_stock() {
    let mut s = GameState::new(5, Difficulty::Normal);
    let lot = s.stock[&Item::Magnets][0];
    let before = s.available(Item::Magnets);
    s.apply(Action::ScrapLot { lot }).unwrap();
    assert_eq!(s.lot(lot).status, LotStatus::Scrapped);
    assert!(s.available(Item::Magnets) < before);
    assert!(s.apply(Action::ScrapLot { lot }).is_err());
}

#[test]
fn supplier_events_happen_and_bankruptcy_reroutes_reorders() {
    // Hard doubles down on events; across seeds something must go wrong.
    let mut spikes = 0;
    let mut bankrupt = 0;
    for seed in 0..6 {
        let s = play_with(seed, Difficulty::Hard, 90, |_| {});
        spikes += count_events(&s, |k| matches!(k, EventKind::PriceSpike { .. }));
        for sup in s.suppliers.iter().filter(|x| !x.active) {
            bankrupt += 1;
            assert_ne!(s.policies.reorder[&sup.item].supplier, sup.id);
            assert!(s
                .orders
                .iter()
                .filter(|o| o.supplier == sup.id)
                .all(|o| o.status != OrderStatus::Pending));
        }
    }
    assert!(spikes > 0);
    assert!(bankrupt > 0);
}

#[test]
fn bad_lots_get_rejected_at_full_iqc() {
    let mut s = GameState::new(4, Difficulty::Normal);
    let magnets = s.policies.reorder[&Item::Magnets].supplier;
    s.suppliers[magnets.0 as usize].bad_lots_pending = 3;
    s.apply(Action::SetIqc {
        item: Item::Magnets,
        plan: InspectionPlan::Sample { percent: 20 },
    })
    .unwrap();
    s.apply(Action::PlaceOrder {
        supplier: magnets,
        qty: 200,
        expedite: false,
    })
    .unwrap();
    s.run_days(8);
    assert!(
        count_events(&s, |k| matches!(
            k,
            EventKind::IqcRejected {
                item: Item::Magnets,
                ..
            }
        )) > 0
    );
}
