import { useEffect, useRef, useState } from "react";
import { beaconState } from "../floor/status";
import type { StationKind } from "../sim/types";
import type { Game } from "../sim/useGame";
import { LineChart } from "./charts";
import { formatMoney } from "./format";

const STATE_LABEL = {
	running: "Running",
	starved: "Waiting on parts",
	alarm: "SPC alarm",
	degraded: "Machine down",
	broken: "Broken down",
	maintenance: "Maintenance",
	off: "Idle",
} as const;

const PM_OPTIONS = [0, 80, 120, 200, 320];

interface Props {
	game: Game;
	kind: StationKind;
	onClose: () => void;
}

export function StationCard({ game, kind, onClose }: Props) {
	const { view, act } = game;
	const [error, setError] = useState<string | null>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	// A newly opened card takes focus so keyboard and screen-reader users land
	// in it. (GameScreen keys the card by station, so errors reset too.)
	useEffect(() => closeRef.current?.focus(), []);
	const st = view.stations.find((s) => s.kind === kind);
	if (!st) return null;
	const state = beaconState(st, view.operating);
	const run = (err: string | null) => setError(err);
	const inputs = st.inputs
		.map(
			([item, n]) =>
				`${n}× ${view.stock.find((s) => s.item === item)?.label ?? item}`,
		)
		.join(" + ");
	return (
		<div className="station-card">
			<header>
				<strong>{st.label}</strong>
				<span className={`pill beacon-${state}`}>{STATE_LABEL[state]}</span>
				<button
					ref={closeRef}
					type="button"
					className="ghost close"
					onClick={onClose}
					aria-label="Close"
				>
					×
				</button>
			</header>
			<p className="muted small">
				{inputs} → {view.stock.find((s) => s.item === st.output)?.label}.{" "}
				{st.rate_per_hour}/h per machine.
			</p>
			<ul className="machines">
				{st.machines.map((m, i) => (
					<li key={m.id}>
						<span>
							Machine {i + 1} · {Math.round(m.condition)}%
						</span>
						<span className="meter" aria-hidden="true">
							<span style={{ width: `${m.condition}%` }} />
						</span>
						<span className={m.down_reason === "breakdown" ? "bad" : "muted"}>
							{m.down_reason ?? `${m.hours_since_pm}h since PM`}
						</span>
					</li>
				))}
			</ul>
			<div className="spc-mini">
				<LineChart
					title={`${st.label} x-bar chart`}
					values={st.spc}
					format={(v) => v.toFixed(1)}
					refs={[view.spc_limit, -view.spc_limit]}
					domain={[-3.5, 3.5]}
					height={70}
				/>
			</div>
			<div className="grid2">
				<label>
					Maintenance every
					<select
						value={st.pm_interval}
						onChange={(e) =>
							run(
								act({
									type: "set_pm_interval",
									station: kind,
									hours: Number(e.target.value),
								}),
							)
						}
					>
						{PM_OPTIONS.map((h) => (
							<option key={h} value={h}>
								{h === 0 ? "Never (run to failure)" : `${h} operating hours`}
							</option>
						))}
					</select>
				</label>
				<label>
					Buffer cap
					<input
						type="number"
						min={1}
						value={st.wip_cap}
						onChange={(e) =>
							run(
								act({
									type: "set_wip_cap",
									station: kind,
									cap: Math.max(1, Number(e.target.value)),
								}),
							)
						}
					/>
				</label>
			</div>
			<div className="actions">
				<button
					type="button"
					onClick={() => run(act({ type: "maintain", station: kind }))}
				>
					Maintain now
				</button>
				<button
					type="button"
					onClick={() => run(act({ type: "buy_machine", station: kind }))}
				>
					Buy ({formatMoney(st.machine_price)})
				</button>
				<button
					type="button"
					className="ghost"
					disabled={st.machines.length <= 1}
					onClick={() => run(act({ type: "sell_machine", station: kind }))}
				>
					Sell worst
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
