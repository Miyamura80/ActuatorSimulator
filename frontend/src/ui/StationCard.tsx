import { useEffect, useRef, useState } from "react";
import { beaconState } from "../floor/status";
import type { StationKind } from "../sim/types";
import type { Game } from "../sim/useGame";
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

export function StationCard({
	game,
	kind,
	onClose,
}: {
	game: Game;
	kind: StationKind;
	onClose: () => void;
}) {
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
			<ul className="machines">
				{st.machines.map((m, i) => (
					<li key={m.id}>
						<span>
							Machine {i + 1} · {Math.round(m.condition)}%
						</span>
						<span className="meter" aria-hidden="true">
							<span style={{ width: `${m.condition}%` }} />
						</span>
						<span className="muted">
							{m.down_reason ?? `${m.hours_since_pm}h since PM`}
						</span>
					</li>
				))}
			</ul>
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
					Buy machine ({formatMoney(st.machine_price)})
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
