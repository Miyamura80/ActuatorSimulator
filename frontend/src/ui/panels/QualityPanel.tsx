import { useState } from "react";
import type { GameEvent } from "../../sim/types";
import type { Game } from "../../sim/useGame";
import { LineChart } from "../charts";
import { formatTick } from "../format";
import { planFromKey, planKey, planOptions } from "./plans";

const QUALITY_EVENTS = new Set([
	"iqc_rejected",
	"field_failure",
	"spc_alarm",
	"recall",
]);

function eventLot(e: GameEvent): number | null {
	const lot = e.kind.lot;
	return typeof lot === "number" ? lot : null;
}

function TraceView({
	game,
	lot,
	onClose,
}: {
	game: Game;
	lot: number;
	onClose: () => void;
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
	const itemLabel = (item: string) =>
		game.view.stock.find((s) => s.item === item)?.label ?? item;
	const stationLabel = game.view.stations.find(
		(s) => s.kind === r.built_at,
	)?.label;
	const origin = r.supplier_name
		? `from ${r.supplier_name}`
		: stationLabel
			? `built at ${stationLabel}`
			: "";
	return (
		<div className="trace">
			<header>
				<strong>
					Lot #{r.lot} · {r.label}
				</strong>
				<button
					type="button"
					className="ghost close"
					onClick={onClose}
					aria-label="Close trace"
				>
					×
				</button>
			</header>
			<p className="muted">
				{r.initial_qty} units {origin}, {formatTick(r.created)}. {r.remaining}{" "}
				left in stock ({r.status}).
			</p>
			{r.source_lots.length > 0 && (
				<>
					<h4>Built from</h4>
					<ul className="lots">
						{r.source_lots.slice(0, 12).map((l) => (
							<li key={l.lot}>
								#{l.lot} {itemLabel(l.item)}{" "}
								<span className="muted">{l.supplier_name}</span>
							</li>
						))}
					</ul>
				</>
			)}
			<h4>Went into</h4>
			<p>
				{r.finished_lots.length} finished lot(s),{" "}
				<strong>{r.shipped_units}</strong> units shipped to customers
				{r.recalled ? " (recalled)" : ""}.
			</p>
			<div className="actions">
				<button
					type="button"
					className="primary"
					disabled={r.recalled && r.remaining === 0}
					onClick={() => setError(game.act({ type: "recall", lot: r.lot }))}
				>
					Recall
				</button>
				<button
					type="button"
					disabled={r.remaining === 0 || r.status !== "available"}
					onClick={() => setError(game.act({ type: "scrap_lot", lot: r.lot }))}
				>
					Scrap remaining stock
				</button>
			</div>
			<p className="muted small">
				Recall costs about $140 per shipped unit and some reputation, but stops
				the rest of this lot failing in the field.
			</p>
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
		.filter((e) => QUALITY_EVENTS.has(e.kind.type))
		.slice(0, 25);
	const scrapRate = (() => {
		const recent = view.history.slice(-7);
		const produced = recent.reduce((a, d) => a + d.produced, 0);
		const scrapped = recent.reduce((a, d) => a + d.scrapped, 0);
		return produced + scrapped > 0
			? (scrapped / (produced + scrapped)) * 100
			: 0;
	})();
	return (
		<div className="panel-body">
			{traceLot !== null && (
				<TraceView
					game={game}
					lot={traceLot}
					onClose={() => setTraceLot(null)}
				/>
			)}
			<div className="grid2">
				<label>
					End-of-line test
					<select
						value={planKey(view.policies.eol)}
						onChange={(e) =>
							act({ type: "set_eol", plan: planFromKey(e.target.value) })
						}
					>
						{planOptions(view.policies.eol).map((o) => (
							<option key={o.key} value={o.key}>
								{o.label}
							</option>
						))}
					</select>
				</label>
				<div className="kpi">
					<span className="k">Scrap, last 7 days</span>
					<span className="v">{scrapRate.toFixed(1)}%</span>
				</div>
			</div>
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
					value={lotInput}
					onChange={(e) => setLotInput(e.target.value)}
				/>
				<button type="submit">Trace lot</button>
			</form>

			<h3>Process control (x-bar, ±3σ)</h3>
			<div className="spc-grid">
				{view.stations.map((st) => (
					<div key={st.kind} className={st.spc_alarm ? "spc alarm" : "spc"}>
						<div className="spc-title">
							{st.label}
							{st.spc_alarm && <span className="tag warn">Alarm</span>}
						</div>
						<LineChart
							title={`${st.label} x-bar chart`}
							values={st.spc}
							format={(v) => v.toFixed(1)}
							refs={[view.spc_limit, -view.spc_limit]}
							domain={[-3.5, 3.5]}
							height={80}
						/>
					</div>
				))}
			</div>

			<h3>Quality incidents</h3>
			{incidents.length === 0 && <p className="muted">None yet.</p>}
			<ul className="incidents">
				{incidents.map((e) => {
					const lot = eventLot(e);
					return (
						<li key={e.seq} className={`sev-${e.severity}`}>
							<span className="when">{formatTick(e.tick)}</span>
							<span className="msg">{e.message}</span>
							{lot !== null && (
								<button
									type="button"
									className="ghost small"
									onClick={() => setTraceLot(lot)}
								>
									Trace #{lot}
								</button>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
