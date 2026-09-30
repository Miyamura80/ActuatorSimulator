// Live schematic of the line. Parts enter on the left, actuators leave on the
// right. Pipe width is a station's capacity per hour, so the bottleneck is
// the thinnest pipe; material flows along a pipe while its source runs, a
// starved input flashes red, and the counts on the pipes are the buffers.
import type { CSSProperties } from "react";
import { beaconState } from "../../floor/status";
import type { Item, StationKind, StationView, View } from "../../sim/types";
import { capacity } from "./capacity";
import { BEACON, ITEM_COLOR } from "./colors";
import { Glyph } from "./glyphs";
import { ItemIcon, StationIcon } from "./icons";

const VW = 720;
const VH = 204;
const NODE_W = 54;
const NODE_H = 32;
const STOCK_X = 22;
const STOCK_R = 11;

/** Purchased parts, top to bottom, in the order their stations sit. */
const STOCK_ORDER: Item[] = [
	"alu_billet",
	"steel_blank",
	"laminations",
	"copper_wire",
	"magnets",
	"bearing",
	"pcb_blank",
	"encoder_ic",
];
const stockY = (item: Item) => 16 + STOCK_ORDER.indexOf(item) * 24.5;

const NODE: Record<StationKind, [number, number]> = {
	mill: [175, 16],
	gear_cut: [175, 42],
	winding: [175, 77],
	smt: [175, 185],
	motor_asm: [320, 118],
	final_asm: [460, 102],
	eol_test: [575, 102],
};
const SHIP: [number, number] = [680, 102];

const SHORT: Record<StationKind, string> = {
	mill: "Mill",
	gear_cut: "Gears",
	winding: "Stator",
	smt: "SMT",
	motor_asm: "Motor",
	final_asm: "Final",
	eol_test: "Test",
};

const pipeWidth = (cap: number) =>
	Math.min(18, cap === 0 ? 1 : 1.5 + cap * 1.8);

function curve(x1: number, y1: number, x2: number, y2: number) {
	const dx = (x2 - x1) / 2;
	return `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

/** A point part-way along `curve`, where a buffer chip sits. */
function along(x1: number, y1: number, x2: number, y2: number, t: number) {
	const u = 1 - t;
	// Both control points sit half-way across, level with their end points.
	const y = y1 * (u ** 3 + 3 * u * u * t) + y2 * (3 * u * t * t + t ** 3);
	return { x: x1 + (x2 - x1) * (1.5 * t * u + t ** 3), y };
}

interface Pipe {
	id: string;
	d: string;
	item: Item;
	width: number;
	flowing: boolean;
	starved: boolean;
	bottleneck: boolean;
	/** Buffer count shown at the middle of station-to-station pipes. */
	chip?: { x: number; y: number; qty: number };
}

function pipes(view: View, bottleneck: StationKind | null): Pipe[] {
	const out: Pipe[] = [];
	const producer = new Map(view.stations.map((s) => [s.output, s]));
	const qty = (item: Item) => view.stock.find((s) => s.item === item)?.qty ?? 0;
	for (const st of view.stations) {
		const [tx, ty] = NODE[st.kind];
		for (const [item] of st.inputs) {
			const src = producer.get(item);
			const starved = st.starved_on === item;
			if (src) {
				const [sx, sy] = NODE[src.kind];
				const x1 = sx + NODE_W / 2;
				const x2 = tx - NODE_W / 2;
				out.push({
					id: `${src.kind}-${st.kind}`,
					d: curve(x1, sy, x2, ty),
					item,
					width: pipeWidth(capacity(src, view)),
					flowing: src.busy,
					starved,
					bottleneck: src.kind === bottleneck,
					chip: { ...along(x1, sy, x2, ty, 0.28), qty: qty(item) },
				});
			} else {
				out.push({
					id: `${item}-${st.kind}`,
					d: curve(STOCK_X + STOCK_R, stockY(item), tx - NODE_W / 2, ty),
					item,
					width: 2,
					flowing: st.busy,
					starved,
					bottleneck: false,
				});
			}
		}
	}
	const eol = view.stations.find((s) => s.kind === "eol_test");
	if (eol) {
		const [x, y] = NODE.eol_test;
		const x1 = x + NODE_W / 2;
		const x2 = SHIP[0] - 18;
		out.push({
			id: "eol-ship",
			d: curve(x1, y, x2, SHIP[1]),
			item: "finished_good",
			width: pipeWidth(capacity(eol, view)),
			flowing: eol.busy,
			starved: false,
			bottleneck: eol.kind === bottleneck,
			chip: { x: (x1 + x2) / 2, y, qty: qty("finished_good") },
		});
	}
	return out;
}

/**
 * The station with the least capacity. It stays marked when the line is
 * idle: the bottleneck is a property of the machines, not of the hour.
 */
function bottleneckOf(view: View): StationKind | null {
	let best: StationView | null = null;
	for (const st of view.stations)
		if (!best || capacity(st, view) < capacity(best, view)) best = st;
	return best?.kind ?? null;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

interface Props {
	view: View;
	selected: StationKind | null;
	onSelect: (k: StationKind | null) => void;
	onPart: (item: Item) => void;
}

export function FlowMap({ view, selected, onSelect, onPart }: Props) {
	const neck = bottleneckOf(view);
	const all = pipes(view, neck);
	return (
		<nav className="flow-map" aria-label="Production line">
			<svg viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
				{all.map((p) => (
					<g
						key={p.id}
						className={`pipe${p.flowing ? " flowing" : ""}${p.starved ? " starved" : ""}${p.bottleneck ? " neck" : ""}`}
					>
						<path d={p.d} className="pipe-wall" strokeWidth={p.width + 2} />
						<path
							d={p.d}
							className="pipe-core"
							strokeWidth={Math.max(1.5, p.width * 0.55)}
							style={{ "--c": ITEM_COLOR[p.item] } as CSSProperties}
						/>
					</g>
				))}
				{all.map(
					(p) =>
						p.chip && (
							<g
								key={`chip-${p.id}`}
								transform={`translate(${p.chip.x} ${p.chip.y})`}
								className={p.chip.qty === 0 ? "chip empty" : "chip"}
							>
								<rect x="-17" y="-8" width="34" height="16" rx="8" />
								<g transform="translate(-15 -6)">
									<ItemIcon item={p.item} size={12} />
								</g>
								<text x="9" y="4" textAnchor="middle">
									{p.chip.qty > 999 ? "999+" : p.chip.qty}
								</text>
							</g>
						),
				)}
				<g transform={`translate(${SHIP[0] - 14} ${SHIP[1] - 12})`}>
					<Glyph name="truck" size={30} className="ship-truck" />
				</g>
			</svg>
			{STOCK_ORDER.map((item) => {
				const s = view.stock.find((x) => x.item === item);
				const reorder = view.policies.reorder[item]?.reorder_point ?? 0;
				const q = s?.qty ?? 0;
				const full = Math.max(reorder * 2, 1);
				const tone = q === 0 ? "empty" : q < reorder ? "low" : "ok";
				const ring = Math.min(1, q / full);
				return (
					<button
						type="button"
						key={item}
						className={`stock-node ${tone}`}
						style={
							{
								left: pct(STOCK_X, VW),
								top: pct(stockY(item), VH),
								"--fill": `${ring * 360}deg`,
							} as CSSProperties
						}
						onClick={() => onPart(item)}
						aria-label={`${s?.label ?? item}: ${q} in stock${s?.on_order ? `, ${s.on_order} on order` : ""}`}
						title={`${s?.label ?? item}: ${q}${s?.on_order ? ` (+${s.on_order} coming)` : ""}`}
					>
						<ItemIcon item={item} size={15} />
						{(s?.on_order ?? 0) > 0 && (
							<span className="incoming">
								<Glyph name="truck" size={10} />
							</span>
						)}
					</button>
				);
			})}
			{view.stations.map((st) => {
				const [x, y] = NODE[st.kind];
				const state = beaconState(st, view.operating);
				return (
					<button
						type="button"
						key={st.kind}
						data-station={st.kind}
						aria-pressed={selected === st.kind}
						aria-label={`${st.label}: ${state}${st.kind === neck ? ", bottleneck" : ""}`}
						title={st.label}
						className={`flow-node state-${state}${selected === st.kind ? " on" : ""}${st.kind === neck ? " neck" : ""}`}
						style={
							{
								left: pct(x, VW),
								top: pct(y, VH),
								width: pct(NODE_W, VW),
								height: pct(NODE_H, VH),
								"--state": BEACON[state],
							} as CSSProperties
						}
						onClick={() => onSelect(selected === st.kind ? null : st.kind)}
					>
						<StationIcon kind={st.kind} size={18} />
						<span className="node-meta">
							<span className="node-name">{SHORT[st.kind]}</span>
							<span className="dots">
								{st.machines.map((m) => (
									<i key={m.id} className={m.down_reason ? "down" : ""} />
								))}
							</span>
						</span>
					</button>
				);
			})}
		</nav>
	);
}
