// Hand-written mirrors of the Rust types the WASM bridge sends as JSON.
// Source of truth: crates/sim/src/{view,model,policy,event,action}.rs.

export type Item =
	| "magnets"
	| "laminations"
	| "copper_wire"
	| "bearing"
	| "encoder_ic"
	| "pcb_blank"
	| "alu_billet"
	| "steel_blank"
	| "housing"
	| "gear_set"
	| "stator"
	| "driver_board"
	| "motor"
	| "actuator"
	| "finished_good";

export type StationKind =
	| "mill"
	| "gear_cut"
	| "winding"
	| "smt"
	| "motor_asm"
	| "final_asm"
	| "eol_test";

export type Difficulty = "easy" | "normal" | "hard";
type Tier = "premium" | "standard" | "budget";
export type Severity = "info" | "good" | "warning" | "critical";

export type InspectionPlan =
	| { mode: "skip" }
	| { mode: "sample"; percent: number }
	| { mode: "full" };

export interface Machine {
	id: number;
	condition: number;
	down_until: number | null;
	down_reason: "breakdown" | "maintenance" | null;
	operating_hours: number;
	hours_since_pm: number;
}

export interface StationView {
	kind: StationKind;
	label: string;
	output: Item;
	inputs: [Item, number][];
	rate_per_hour: number;
	machine_price: number;
	machines: Machine[];
	busy: boolean;
	starved_on: Item | null;
	wip_cap: number;
	pm_interval: number;
	spc: number[];
	spc_alarm: boolean;
	units_built: number;
	units_scrapped: number;
}

export interface StockView {
	item: Item;
	label: string;
	purchased: boolean;
	qty: number;
	on_order: number;
	lots: { id: number; qty: number; created: number; supplier: number | null }[];
}

export interface SupplierView {
	id: number;
	name: string;
	item: Item;
	tier: Tier;
	price: number;
	base_price: number;
	price_spike: boolean;
	lead_days: number;
	min_order: number;
	active: boolean;
	lots_received: number;
	lots_rejected: number;
}

export interface OrderView {
	id: number;
	supplier: number;
	item: Item;
	qty: number;
	unit_price: number;
	expedited: boolean;
	placed: number;
	promised: number;
	late: boolean;
}

type ContractStatus = "offered" | "active" | "completed" | "failed" | "expired";

export interface Contract {
	id: number;
	customer: string;
	qty: number;
	unit_price: number;
	quality: "standard" | "premium";
	offer_expires: number;
	lead_days: number;
	deadline: number | null;
	delivered: number;
	status: ContractStatus;
	late_penalty_rate: number;
	penalties_paid: number;
}

interface ReorderPolicy {
	enabled: boolean;
	supplier: number;
	reorder_point: number;
	order_qty: number;
}

export interface Policies {
	shifts: number;
	iqc: Partial<Record<Item, InspectionPlan>>;
	eol: InspectionPlan;
	reorder: Partial<Record<Item, ReorderPolicy>>;
	auto_ship: boolean;
}

export interface Ledger {
	revenue: number;
	materials: number;
	labor: number;
	overhead: number;
	capex: number;
	inspection: number;
	penalties: number;
	maintenance: number;
	rma: number;
	recalls: number;
	refunds: number;
}

export interface DaySummary {
	day: number;
	cash: number;
	reputation: number;
	revenue: number;
	costs: number;
	produced: number;
	shipped: number;
	scrapped: number;
	iqc_rejects: number;
	field_failures: number;
	breakdowns: number;
}

export interface GameEvent {
	seq: number;
	tick: number;
	severity: Severity;
	message: string;
	kind: { type: string } & Record<string, unknown>;
}

export type GameStatus =
	| { state: "running" }
	| { state: "bankrupt"; day: number };

export interface View {
	tick: number;
	day: number;
	hour: number;
	seed: number;
	difficulty: Difficulty;
	status: GameStatus;
	cash: number;
	overdraft_limit: number;
	reputation: number;
	operating: boolean;
	spc_limit: number;
	stations: StationView[];
	stock: StockView[];
	suppliers: SupplierView[];
	orders: OrderView[];
	contracts: Contract[];
	policies: Policies;
	ledger: Ledger;
	history: DaySummary[];
	events: GameEvent[];
	next_event_seq: number;
}

export type Action =
	| { type: "place_order"; supplier: number; qty: number; expedite?: boolean }
	| {
			type: "set_reorder";
			item: Item;
			supplier: number;
			reorder_point: number;
			order_qty: number;
			enabled: boolean;
	  }
	| { type: "set_iqc"; item: Item; plan: InspectionPlan }
	| { type: "set_eol"; plan: InspectionPlan }
	| { type: "set_shifts"; shifts: number }
	| { type: "set_wip_cap"; station: StationKind; cap: number }
	| { type: "set_auto_ship"; enabled: boolean }
	| { type: "buy_machine"; station: StationKind }
	| { type: "sell_machine"; station: StationKind }
	| { type: "accept_contract"; contract: number }
	| { type: "decline_contract"; contract: number }
	| { type: "ship_now"; contract: number }
	| { type: "maintain"; station: StationKind }
	| { type: "set_pm_interval"; station: StationKind; hours: number }
	| { type: "recall"; lot: number }
	| { type: "scrap_lot"; lot: number };
