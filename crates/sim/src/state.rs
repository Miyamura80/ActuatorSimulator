//! The complete, serializable game state plus low-level helpers shared by the
//! systems (money, events, lot bookkeeping).

use crate::catalog::{supplier_table, Item, StationKind};
use crate::difficulty::{Difficulty, Tuning};
use crate::event::{Event, EventKind, Severity, EVENT_LOG_CAP};
use crate::model::*;
use crate::policy::{default_wip_cap, InspectionPlan, Policies, ReorderPolicy};
use crate::rng::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};

/// Bump when the save format changes incompatibly.
pub const SAVE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub version: u32,
    pub seed: u64,
    pub difficulty: Difficulty,
    pub tuning: Tuning,
    pub tick: Tick,
    pub status: GameStatus,
    pub rng: Rng,
    pub cash: i64,
    /// 0..=100.
    pub reputation: f64,
    pub suppliers: Vec<Supplier>,
    /// Indexed by `LotId.0`.
    pub lots: Vec<Lot>,
    /// Available lots per item, oldest first.
    pub stock: BTreeMap<Item, VecDeque<LotId>>,
    pub orders: Vec<PurchaseOrder>,
    /// One per [`StationKind`], in `StationKind::ALL` order.
    pub stations: Vec<Station>,
    pub contracts: Vec<Contract>,
    pub shipments: Vec<Shipment>,
    pub policies: Policies,
    pub ledger: Ledger,
    /// Ledger at the start of the current day, for daily deltas.
    pub ledger_day_start: Ledger,
    pub history: Vec<DaySummary>,
    pub today: DayCounters,
    pub events: Vec<Event>,
    pub next_event_seq: u64,
    pub next_machine_id: u32,
}

/// Counters reset each day.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DayCounters {
    pub produced: u32,
    pub shipped: u32,
    pub scrapped: u32,
    pub iqc_rejects: u32,
}

/// Units drawn from stock, with the hidden quality they carried.
#[derive(Debug, Clone, Default)]
pub struct Drawn {
    pub defects: u32,
    pub latent: u32,
    pub parts: Vec<ShippedPart>,
}

impl GameState {
    pub fn new(seed: u64, difficulty: Difficulty) -> Self {
        let tuning = difficulty.tuning();
        let mut rng = Rng::new(seed);
        let suppliers = make_suppliers(&mut rng, &tuning);
        let mut next_machine_id = 0;
        let stations = StationKind::ALL
            .iter()
            .map(|&kind| {
                let machine = Machine {
                    id: MachineId(next_machine_id),
                    condition: 100.0,
                    down_until: None,
                    operating_hours: 0,
                };
                next_machine_id += 1;
                Station {
                    kind,
                    machines: vec![machine],
                    progress: 0.0,
                    wip_cap: default_wip_cap(kind),
                    open_lot: None,
                    units_built: 0,
                    units_scrapped: 0,
                    busy: false,
                    starved_on: None,
                }
            })
            .collect();
        let policies = default_policies(&suppliers);
        let mut state = Self {
            version: SAVE_VERSION,
            seed,
            difficulty,
            cash: tuning.start_cash,
            tuning,
            tick: 0,
            status: GameStatus::Running,
            rng,
            reputation: 20.0,
            suppliers,
            lots: Vec::new(),
            stock: BTreeMap::new(),
            orders: Vec::new(),
            stations,
            contracts: Vec::new(),
            shipments: Vec::new(),
            policies,
            ledger: Ledger::default(),
            ledger_day_start: Ledger::default(),
            history: Vec::new(),
            today: DayCounters::default(),
            events: Vec::new(),
            next_event_seq: 0,
            next_machine_id,
        };
        state.seed_starting_stock();
        crate::systems::contracts::generate_offers(&mut state);
        state
    }

    pub fn day(&self) -> u32 {
        self.tick / TICKS_PER_DAY
    }

    pub fn hour(&self) -> u32 {
        self.tick % TICKS_PER_DAY
    }

    pub fn is_over(&self) -> bool {
        self.status != GameStatus::Running
    }

    pub fn station(&self, kind: StationKind) -> &Station {
        &self.stations[station_index(kind)]
    }

    pub fn station_mut(&mut self, kind: StationKind) -> &mut Station {
        &mut self.stations[station_index(kind)]
    }

    pub fn supplier(&self, id: SupplierId) -> Option<&Supplier> {
        self.suppliers.get(id.0 as usize)
    }

    pub fn contract_mut(&mut self, id: ContractId) -> Option<&mut Contract> {
        self.contracts.iter_mut().find(|c| c.id == id)
    }

    pub fn lot(&self, id: LotId) -> &Lot {
        &self.lots[id.0 as usize]
    }

    pub fn emit(&mut self, severity: Severity, message: String, kind: EventKind) {
        self.events.push(Event {
            seq: self.next_event_seq,
            tick: self.tick,
            severity,
            message,
            kind,
        });
        self.next_event_seq += 1;
        if self.events.len() > EVENT_LOG_CAP {
            let excess = self.events.len() - EVENT_LOG_CAP;
            self.events.drain(..excess);
        }
    }

    /// Events with `seq >= since`.
    pub fn events_since(&self, since: u64) -> &[Event] {
        let start = self.events.partition_point(|e| e.seq < since);
        &self.events[start..]
    }

    /// Units available in stock for `item`.
    pub fn available(&self, item: Item) -> u32 {
        self.stock
            .get(&item)
            .map(|q| q.iter().map(|id| self.lot(*id).qty).sum())
            .unwrap_or(0)
    }

    /// Create a lot. Available lots go straight into stock.
    pub fn new_lot(&mut self, item: Item, qty: u32, origin: LotOrigin, status: LotStatus) -> LotId {
        let id = LotId(self.lots.len() as u32);
        self.lots.push(Lot {
            id,
            item,
            qty,
            initial_qty: qty,
            defects: 0,
            latent: 0,
            origin,
            created: self.tick,
            status,
        });
        if status == LotStatus::Available && qty > 0 {
            self.stock.entry(item).or_default().push_back(id);
        }
        id
    }

    /// Move an open lot into stock.
    pub fn release_lot(&mut self, id: LotId) {
        let lot = &mut self.lots[id.0 as usize];
        lot.status = LotStatus::Available;
        let item = lot.item;
        if lot.qty > 0 {
            self.stock.entry(item).or_default().push_back(id);
        }
    }

    /// Draw `n` units FIFO. Each unit is randomly good, defective or latent in
    /// proportion to what its lot still holds. Caller checks `available` first.
    pub fn take_units(&mut self, item: Item, n: u32) -> Drawn {
        let mut drawn = Drawn::default();
        let mut remaining = n;
        while remaining > 0 {
            let Some(&lot_id) = self.stock.get(&item).and_then(|q| q.front()) else {
                break;
            };
            let mut part = ShippedPart {
                lot: lot_id,
                qty: 0,
                defects: 0,
                latent: 0,
            };
            loop {
                let lot = &self.lots[lot_id.0 as usize];
                if remaining == 0 || lot.qty == 0 {
                    break;
                }
                let roll = self.rng.range(0, lot.qty - 1);
                let lot = &mut self.lots[lot_id.0 as usize];
                if roll < lot.defects {
                    lot.defects -= 1;
                    part.defects += 1;
                } else if roll < lot.defects + lot.latent {
                    lot.latent -= 1;
                    part.latent += 1;
                }
                lot.qty -= 1;
                part.qty += 1;
                remaining -= 1;
            }
            drawn.defects += part.defects;
            drawn.latent += part.latent;
            drawn.parts.push(part);
            if self.lots[lot_id.0 as usize].qty == 0 {
                if let Some(q) = self.stock.get_mut(&item) {
                    q.pop_front();
                }
            }
        }
        drawn
    }

    /// Money out. Categories feed the ledger for the stats panel.
    pub fn spend(&mut self, amount: i64, bucket: fn(&mut Ledger) -> &mut i64) {
        self.cash -= amount;
        *bucket(&mut self.ledger) += amount;
    }

    pub fn earn(&mut self, amount: i64) {
        self.cash += amount;
        self.ledger.revenue += amount;
    }

    /// Units on order but not yet received for `item`.
    pub fn on_order(&self, item: Item) -> u32 {
        self.orders
            .iter()
            .filter(|o| o.item == item && o.status == OrderStatus::Pending)
            .map(|o| o.qty)
            .sum()
    }

    fn seed_starting_stock(&mut self) {
        // Enough of every part for roughly two days of one-shift production,
        // from each part's default supplier so genealogy still works.
        for item in Item::PURCHASED {
            let supplier = self.policies.reorder[&item].supplier;
            let qty = if item == Item::Bearing { 120 } else { 60 };
            let origin = LotOrigin::Opening { supplier };
            let id = self.new_lot(item, qty, origin, LotStatus::Available);
            let (d, l) = {
                let s = &self.suppliers[supplier.0 as usize];
                (s.defect_rate, s.latent_rate)
            };
            let defects = self.rng.binomial(qty, d);
            let latent = self.rng.binomial(qty - defects, l);
            let lot = &mut self.lots[id.0 as usize];
            lot.defects = defects;
            lot.latent = latent;
        }
    }
}

pub fn station_index(kind: StationKind) -> usize {
    StationKind::ALL
        .iter()
        .position(|k| *k == kind)
        .unwrap_or(0)
}

fn make_suppliers(rng: &mut Rng, tuning: &Tuning) -> Vec<Supplier> {
    supplier_table()
        .iter()
        .enumerate()
        .map(|(i, spec)| {
            let jitter = rng.range_f64(0.7, 1.4);
            let price_jitter = rng.range_f64(0.92, 1.08);
            Supplier {
                id: SupplierId(i as u16),
                name: spec.name.to_string(),
                item: spec.item,
                tier: spec.tier,
                unit_price: ((spec.item.base_price() as f64)
                    * spec.tier.price_mult()
                    * price_jitter)
                    .round()
                    .max(1.0) as i64,
                defect_rate: spec.tier.defect_rate() * jitter * tuning.supplier_defect_mult,
                latent_rate: spec.tier.latent_rate() * jitter * tuning.supplier_defect_mult,
                lead_days: spec.tier.lead_days(),
                reliability: spec.tier.reliability(),
                min_order: spec.tier.min_order(),
                active: true,
                lots_received: 0,
                lots_rejected: 0,
            }
        })
        .collect()
}

fn default_policies(suppliers: &[Supplier]) -> Policies {
    use crate::catalog::Tier;
    let mut iqc = BTreeMap::new();
    let mut reorder = BTreeMap::new();
    for item in Item::PURCHASED {
        iqc.insert(item, InspectionPlan::Sample { percent: 5 });
        // Default to the Standard supplier when one exists, else the first.
        let pick = suppliers
            .iter()
            .filter(|s| s.item == item)
            .min_by_key(|s| match s.tier {
                Tier::Standard => 0,
                Tier::Premium => 1,
                Tier::Budget => 2,
            })
            .expect("every purchased item has a supplier");
        let per_unit = if item == Item::Bearing { 2 } else { 1 };
        reorder.insert(
            item,
            ReorderPolicy {
                enabled: true,
                supplier: pick.id,
                reorder_point: 120 * per_unit,
                order_qty: (150 * per_unit).max(pick.min_order),
            },
        );
    }
    Policies {
        shifts: 1,
        iqc,
        eol: InspectionPlan::Full,
        reorder,
        auto_ship: true,
    }
}
