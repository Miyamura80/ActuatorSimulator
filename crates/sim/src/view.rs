//! The player-visible snapshot of a game, sent to the UI every frame.
//!
//! Anything the player should have to discover stays out of here: hidden
//! defect counts, supplier quality numbers, process drift, pending field
//! failures, and when a late order will really arrive.

use crate::catalog::{Item, StationKind, Tier};
use crate::event::Event;
use crate::model::*;
use crate::policy::Policies;
use crate::state::GameState;
use crate::systems::maintenance::spc_limit;
use crate::Difficulty;
use serde::Serialize;

/// Days of history included in a view.
const HISTORY_DAYS: usize = 60;
/// Finished contracts included in a view (newest first).
const RECENT_CONTRACTS: usize = 10;

#[derive(Debug, Clone, Serialize)]
pub struct View {
    pub tick: Tick,
    pub day: u32,
    pub hour: u32,
    pub seed: u64,
    pub difficulty: Difficulty,
    pub status: GameStatus,
    pub cash: i64,
    pub overdraft_limit: i64,
    pub reputation: f64,
    pub operating: bool,
    pub spc_limit: f64,
    pub stations: Vec<StationView>,
    pub stock: Vec<StockView>,
    pub suppliers: Vec<SupplierView>,
    pub orders: Vec<OrderView>,
    pub contracts: Vec<Contract>,
    pub policies: Policies,
    pub ledger: Ledger,
    pub history: Vec<DaySummary>,
    pub events: Vec<Event>,
    pub next_event_seq: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StationView {
    pub kind: StationKind,
    pub label: &'static str,
    pub output: Item,
    pub inputs: Vec<(Item, u32)>,
    pub rate_per_hour: f64,
    pub machine_price: i64,
    pub machines: Vec<Machine>,
    pub busy: bool,
    pub starved_on: Option<Item>,
    pub wip_cap: u32,
    pub pm_interval: u32,
    pub spc: Vec<f64>,
    pub spc_alarm: bool,
    pub units_built: u64,
    pub units_scrapped: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockLotView {
    pub id: LotId,
    pub qty: u32,
    pub created: Tick,
    pub supplier: Option<SupplierId>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockView {
    pub item: Item,
    pub label: &'static str,
    pub purchased: bool,
    pub qty: u32,
    pub on_order: u32,
    pub lots: Vec<StockLotView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SupplierView {
    pub id: SupplierId,
    pub name: String,
    pub item: Item,
    pub tier: Tier,
    pub price: i64,
    pub base_price: i64,
    pub price_spike: bool,
    pub lead_days: u32,
    pub min_order: u32,
    pub active: bool,
    pub lots_received: u32,
    pub lots_rejected: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderView {
    pub id: OrderId,
    pub supplier: SupplierId,
    pub item: Item,
    pub qty: u32,
    pub unit_price: i64,
    pub expedited: bool,
    pub placed: Tick,
    pub promised: Tick,
    pub late: bool,
}

impl GameState {
    /// Snapshot for the UI, with events newer than `since_seq`.
    pub fn view(&self, since_seq: u64) -> View {
        View {
            tick: self.tick,
            day: self.day(),
            hour: self.hour(),
            seed: self.seed,
            difficulty: self.difficulty,
            status: self.status.clone(),
            cash: self.cash,
            overdraft_limit: self.tuning.overdraft_limit,
            reputation: self.reputation,
            operating: self.policies.is_operating(self.hour()),
            spc_limit: spc_limit(),
            stations: self.stations.iter().map(station_view).collect(),
            stock: Item::ALL.iter().map(|&i| self.stock_view(i)).collect(),
            suppliers: self.suppliers.iter().map(supplier_view).collect(),
            orders: self
                .orders
                .iter()
                .filter(|o| o.status == OrderStatus::Pending)
                .map(|o| OrderView {
                    id: o.id,
                    supplier: o.supplier,
                    item: o.item,
                    qty: o.qty,
                    unit_price: o.unit_price,
                    expedited: o.expedited,
                    placed: o.placed,
                    promised: o.promised,
                    late: self.tick > o.promised,
                })
                .collect(),
            contracts: self.contracts_view(),
            policies: self.policies.clone(),
            ledger: self.ledger.clone(),
            history: self
                .history
                .iter()
                .rev()
                .take(HISTORY_DAYS)
                .rev()
                .cloned()
                .collect(),
            events: self.events_since(since_seq).to_vec(),
            next_event_seq: self.next_event_seq,
        }
    }

    fn stock_view(&self, item: Item) -> StockView {
        let lots = self
            .stock
            .get(&item)
            .map(|q| {
                q.iter()
                    .map(|id| {
                        let l = self.lot(*id);
                        StockLotView {
                            id: *id,
                            qty: l.qty,
                            created: l.created,
                            supplier: crate::trace::supplier_of(self, *id),
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();
        StockView {
            item,
            label: item.label(),
            purchased: item.is_purchased(),
            qty: self.available(item),
            on_order: self.on_order(item),
            lots,
        }
    }

    fn contracts_view(&self) -> Vec<Contract> {
        let open =
            |c: &&Contract| matches!(c.status, ContractStatus::Offered | ContractStatus::Active);
        let mut out: Vec<Contract> = self.contracts.iter().filter(open).cloned().collect();
        out.extend(
            self.contracts
                .iter()
                .rev()
                .filter(|c| !open(c))
                .take(RECENT_CONTRACTS)
                .cloned(),
        );
        out
    }
}

fn station_view(st: &Station) -> StationView {
    let spec = st.kind.spec();
    StationView {
        kind: st.kind,
        label: st.kind.label(),
        output: spec.output,
        inputs: spec.inputs.to_vec(),
        rate_per_hour: spec.rate_per_hour,
        machine_price: spec.machine_price,
        machines: st.machines.clone(),
        busy: st.busy,
        starved_on: st.starved_on,
        wip_cap: st.wip_cap,
        pm_interval: st.pm_interval,
        spc: st.spc.iter().copied().collect(),
        spc_alarm: st.spc_alarm,
        units_built: st.units_built,
        units_scrapped: st.units_scrapped,
    }
}

fn supplier_view(s: &Supplier) -> SupplierView {
    SupplierView {
        id: s.id,
        name: s.name.clone(),
        item: s.item,
        tier: s.tier,
        price: s.current_price(),
        base_price: s.unit_price,
        price_spike: s.price_spike_until.is_some(),
        lead_days: s.lead_days,
        min_order: s.min_order,
        active: s.active,
        lots_received: s.lots_received,
        lots_rejected: s.lots_rejected,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn view_hides_secrets_and_pages_events() {
        let mut s = GameState::new(3, Difficulty::Normal);
        s.run_days(3);
        let v = s.view(0);
        let json = serde_json::to_string(&v).unwrap();
        for secret in [
            "\"defects\"",
            "\"latent\"",
            "\"drift\"",
            "\"arrives\"",
            "defect_rate",
        ] {
            assert!(!json.contains(secret), "view leaks {secret}");
        }
        assert_eq!(v.stations.len(), StationKind::ALL.len());
        let later = s.view(v.next_event_seq);
        assert!(later.events.is_empty());
    }
}
