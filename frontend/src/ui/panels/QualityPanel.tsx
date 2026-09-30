import { useState } from "react";
import type { GameEvent, Item } from "../../sim/types";
import type { Game } from "../../sim/useGame";
import { formatMoney, formatTick } from "../format";
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
	const byItem = new Map<Item, number>();
	for (const l of r.source_lots)
		byItem.set(l.item, (byItem.get(l.item) ?? 0) + 1);
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
			<div className="family" role="img" aria-label={`Lot ${r.lot} genealogy`}>
				<div className="col">
					{r.supplier_name ? (
						<span className="node" title={r.supplier_name}>
							<Glyph name="truck" size={18} />
						</span>
					) : (
						[...byItem].map(([item, n]) => (
							<span key={item} className="node" title={`${n} lot(s)`}>
								<ItemIcon item={item} size={18} />
								{n > 1 && <span className="num small">×{n}</span>}
							</span>
						))
					)}
				</div>
				<span className="link" />
				<div className="col">
					<span
						className={`node me${r.recalled ? " recalled" : ""}`}
						title={r.label}
					>
						{r.built_at ? <StationIcon kind={r.built_at} size={16} /> : null}
						<ItemIcon item={r.item} size={26} />
						<span className="num small">{r.initial_qty}</span>
					</span>
				</div>
				<span className="link" />
				<div className="col">
					<span className="node" title="In stock">
						<Glyph name="check" size={14} />
						<span className="num small">{r.remaining}</span>
					</span>
					<span className="node" title="Shipped to customers">
						<Glyph name="user" size={16} />
						<span className="num small">{r.shipped_units}</span>
					</span>
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
					<Glyph name="back" size={14} /> Recall{" "}
					<span className="small">~{formatMoney(r.shipped_units * 140)}</span>
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
					game={game}
					lot={traceLot}
					onClose={() => setTraceLot(null)}
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
							<span className="msg" title={formatTick(e.tick)}>
								{e.message}
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
