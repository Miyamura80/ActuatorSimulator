//! End-to-end behaviour of the simulation.

use sim::model::{ContractStatus, LotStatus, OrderStatus};
use sim::policy::InspectionPlan;
use sim::{bot, Action, Difficulty, GameState, Item, StationKind};

#[test]
fn same_seed_and_actions_replay_identically() {
    let a = bot::play(7, Difficulty::Normal, 30);
    let b = bot::play(7, Difficulty::Normal, 30);
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap()
    );
}

#[test]
fn different_seeds_diverge() {
    let a = bot::play(1, Difficulty::Normal, 10);
    let b = bot::play(2, Difficulty::Normal, 10);
    assert_ne!(a.cash, b.cash);
}

#[test]
fn save_round_trip_continues_identically() {
    let mut a = bot::play(11, Difficulty::Normal, 5);
    let json = serde_json::to_string(&a).unwrap();
    let mut b: GameState = serde_json::from_str(&json).unwrap();
    a.run_days(5);
    b.run_days(5);
    assert_eq!(
        serde_json::to_string(&a).unwrap(),
        serde_json::to_string(&b).unwrap()
    );
}

#[test]
fn line_produces_and_ships() {
    let s = bot::play(3, Difficulty::Normal, 30);
    let shipped: u32 = s.history.iter().map(|d| d.shipped).sum();
    let produced: u32 = s.history.iter().map(|d| d.produced).sum();
    assert!(produced > 200, "produced {produced}");
    assert!(shipped > 150, "shipped {shipped}");
    assert!(s
        .contracts
        .iter()
        .any(|c| c.status == ContractStatus::Completed));
}

#[test]
fn autopilot_survives_normal() {
    for seed in 0..5 {
        let s = bot::play(seed, Difficulty::Normal, 60);
        assert!(!s.is_over(), "seed {seed} went bankrupt: cash {}", s.cash);
    }
}

#[test]
fn lot_quantities_are_consistent() {
    let s = bot::play(5, Difficulty::Hard, 20);
    for lot in &s.lots {
        assert!(lot.defects + lot.latent <= lot.qty, "lot {:?}", lot.id);
        assert!(lot.qty <= lot.initial_qty);
    }
    for (item, queue) in &s.stock {
        for id in queue {
            let lot = s.lot(*id);
            assert_eq!(lot.item, *item);
            assert_eq!(lot.status, LotStatus::Available);
            assert!(lot.qty > 0);
        }
    }
}

#[test]
fn full_iqc_on_budget_parts_catches_more_than_skip() {
    let run = |plan: InspectionPlan| {
        let mut s = GameState::new(9, Difficulty::Hard);
        let budget = s
            .suppliers
            .iter()
            .find(|x| x.item == Item::Magnets && x.tier == sim::catalog::Tier::Budget)
            .unwrap()
            .id;
        s.apply(Action::SetIqc {
            item: Item::Magnets,
            plan,
        })
        .unwrap();
        s.apply(Action::SetReorder {
            item: Item::Magnets,
            supplier: budget,
            reorder_point: 400,
            order_qty: 400,
            enabled: true,
        })
        .unwrap();
        s.run_days(20);
        s.lots
            .iter()
            .filter(|l| l.item == Item::Magnets && l.status != LotStatus::Rejected)
            .map(|l| l.defects)
            .sum::<u32>()
    };
    assert!(run(InspectionPlan::Full) < run(InspectionPlan::Skip));
}

#[test]
fn skipping_eol_ships_more_defects() {
    let escaped = |plan: InspectionPlan| {
        let mut s = GameState::new(21, Difficulty::Hard);
        s.apply(Action::SetEol { plan }).unwrap();
        for _ in 0..40 * 24 {
            for a in bot::decide(&s) {
                let _ = s.apply(a);
            }
            s.step();
        }
        s.shipments
            .iter()
            .flat_map(|sh| &sh.parts)
            .map(|p| p.defects)
            .sum::<u32>()
    };
    assert!(escaped(InspectionPlan::Skip) > escaped(InspectionPlan::Full));
}

#[test]
fn actions_validate_input() {
    let mut s = GameState::new(1, Difficulty::Normal);
    assert!(s.apply(Action::SetShifts { shifts: 4 }).is_err());
    assert!(s
        .apply(Action::SellMachine {
            station: StationKind::Mill
        })
        .is_err());
    assert!(s
        .apply(Action::SetIqc {
            item: Item::Motor,
            plan: InspectionPlan::Full
        })
        .is_err());
    let wrong = s
        .suppliers
        .iter()
        .find(|x| x.item != Item::Magnets)
        .unwrap()
        .id;
    assert!(s
        .apply(Action::SetReorder {
            item: Item::Magnets,
            supplier: wrong,
            reorder_point: 1,
            order_qty: 1,
            enabled: true
        })
        .is_err());
}

#[test]
fn orders_arrive_eventually() {
    let mut s = GameState::new(4, Difficulty::Normal);
    let supplier = s.suppliers[0].id;
    s.apply(Action::PlaceOrder {
        supplier,
        qty: 100,
        expedite: false,
    })
    .unwrap();
    s.run_days(20);
    assert!(s
        .orders
        .iter()
        .all(|o| o.status == OrderStatus::Received || o.placed > 0));
    assert_eq!(s.orders[0].status, OrderStatus::Received);
}
