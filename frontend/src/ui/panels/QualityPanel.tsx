import { useState } from "react";
import type { GameEvent, TraceLine } from "../../sim/types";
import type { Game } from "../../sim/useGame";
import { formatTick } from "../format";
import { Glyph, type GlyphName } from "../visual/glyphs";
import { ItemIcon, StationIcon } from "../visual/icons";
import { QualityGates } from "../visual/QualityGates";
import { SpcChart } from "../visual/SpcChart";

const QUALITY_EVENTS: Record<string, GlyphName> = {
	iqc_rejected: "truck",
	field_failure: "back",
	spc_alarm: "alert",
	recall: "cross",
};

function eventLot(e: GameEvent): number | null {
	const lot = e.kind.lot;
	return typeof lot === "number" ? lot : null;
}

/** A lot's family tree: what went in, the lot, and where it went. */
/** Upstream and downstream lots shown before the list is cut short. */
const MAX_NODES = 8;

function TraceView({
	game,
	lot,
	onClose,
	onTrace,
}: {
	game: Game;
	lot: number;
	onClose: () => void;
	/** Follow the family tree to another lot. */
	onTrace: (lot: number) => void;
}) {
	const [error, setError] = useState<string | null>(null);
	const r = game.trace(lot);
	if (!r)
		return (
			<div className="trace">
				<p className="error" role="alert">
					No lot #{lot}.
				</p>
				<button type="button" className="ghost" onClick={onClose}>
					Close trace
				</button>
			</div>
		);
	// A finished lot lists itself among its finished lots; show only others.
	const downstream = r.finished_lots.filter((l) => l.lot !== r.lot);
	const lotList = (lines: TraceLine[], label: string) => (
		<ul className="col" aria-label={label}>
			{lines.slice(0, MAX_NODES).map((l) => (
				<li key={l.lot}>
					<button
						type="button"
						className="node"
						title={l.supplier_name ?? undefined}
						onClick={() => onTrace(l.lot)}
					>
						<ItemIcon item={l.item} size={16} />
						<span className="num small">#{l.lot}</span>
						{l.supplier_name && (
							<span className="sr-only">{l.supplier_name}</span>
						)}
					</button>
				</li>
			))}
			{lines.length > MAX_NODES && (
				<li className="muted small">+{lines.length - MAX_NODES}</li>
			)}
		</ul>
	);
	return (
		<div className="trace">
			<header>
				<strong>Lot #{r.lot}</strong>
				<button
					type="button"
					className="ghost close"
					onClick={onClose}
					aria-label="Close trace"
				>
					×
				</button>
			</header>
			<div className="family">
				{r.supplier_name ? (
					<ul className="col" aria-label="Came from">
						<li className="node" title={r.supplier_name}>
							<Glyph name="truck" size={18} />
							<span className="small">{r.supplier_name}</span>
						</li>
					</ul>
				) : (
					lotList(r.source_lots, "Built from")
				)}
				<span className="link" aria-hidden="true" />
				<ul className="col" aria-label="This lot">
					<li
						className={`node me${r.recalled ? " recalled" : ""}`}
						title={r.label}
					>
						{r.built_at ? <StationIcon kind={r.built_at} size={16} /> : null}
						<ItemIcon item={r.item} size={26} title={r.label} />
						<span className="num small">{r.initial_qty}</span>
						{r.recalled && <span className="sr-only">recalled</span>}
					</li>
				</ul>
				<span className="link" aria-hidden="true" />
				<div className="col">
					{downstream.length > 0 && lotList(downstream, "Went into")}
					<ul className="col" aria-label="Where it is">
						<li className="node" title="In stock">
							<Glyph name="check" size={14} title="In stock" />
							<span className="num small">{r.remaining}</span>
						</li>
						<li className="node" title="Shipped to customers">
							<Glyph name="user" size={16} title="Shipped to customers" />
							<span className="num small">{r.shipped_units}</span>
						</li>
					</ul>
				</div>
			</div>
			<div className="actions">
				<button
					type="button"
					className="primary"
					disabled={r.recalled && r.remaining === 0}
					onClick={() => setError(game.act({ type: "recall", lot: r.lot }))}
					title="About $140 per shipped unit and some reputation; stops the rest failing"
				>
					<Glyph name="back" size={14} /> Recall
				</button>
				<button
					type="button"
					disabled={r.remaining === 0 || r.status !== "available"}
					onClick={() => setError(game.act({ type: "scrap_lot", lot: r.lot }))}
				>
					<Glyph name="cross" size={12} /> Scrap stock
				</button>
			</div>
			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}

interface Props {
	game: Game;
	traceLot: number | null;
	setTraceLot: (lot: number | null) => void;
}

export function QualityPanel({ game, traceLot, setTraceLot }: Props) {
	const { view, events, act } = game;
	const [lotInput, setLotInput] = useState("");
	const incidents = [...events]
		.reverse()
		.filter((e) => e.kind.type in QUALITY_EVENTS)
		.slice(0, 25);
	return (
		<div className="panel-body">
			{traceLot !== null && (
				<TraceView
					key={traceLot}
					game={game}
					lot={traceLot}
					onClose={() => setTraceLot(null)}
					onTrace={setTraceLot}
				/>
			)}
			<QualityGates
				view={view}
				days={14}
				onEol={(plan) => act({ type: "set_eol", plan })}
			/>

			<h3>
				<Glyph name="alert" size={13} /> Drift
			</h3>
			<div className="spc-grid">
				{view.stations.map((st) => (
					<div
						key={st.kind}
						className={st.spc_alarm ? "spc alarm" : "spc"}
						title={st.label}
					>
						<StationIcon kind={st.kind} size={16} />
						<SpcChart
							title={`${st.label} process drift`}
							values={st.spc}
							limit={view.spc_limit}
							height={36}
						/>
					</div>
				))}
			</div>

			<h3>Incidents</h3>
			{incidents.length === 0 && <p className="muted">None yet.</p>}
			<ul className="incidents">
				{incidents.map((e) => {
					const lot = eventLot(e);
					return (
						<li key={e.seq} className={`sev-${e.severity}`}>
							<Glyph name={QUALITY_EVENTS[e.kind.type]} size={14} />
							<span className="msg">
								<span className="when">{formatTick(e.tick)}</span> {e.message}
							</span>
							{lot !== null && (
								<button
									type="button"
									className="ghost small"
									onClick={() => setTraceLot(lot)}
								>
									#{lot}
								</button>
							)}
						</li>
					);
				})}
			</ul>
			<form
				className="order-row"
				onSubmit={(e) => {
					e.preventDefault();
					const n = Number(lotInput);
					if (lotInput.trim() !== "" && Number.isSafeInteger(n) && n >= 0)
						setTraceLot(n);
				}}
			>
				<input
					placeholder="Lot #"
					aria-label="Lot number"
					value={lotInput}
					onChange={(e) => setLotInput(e.target.value)}
				/>
				<button type="submit">Trace</button>
			</form>
		</div>
	);
}
