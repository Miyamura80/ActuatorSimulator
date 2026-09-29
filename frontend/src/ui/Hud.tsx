import type { Game, Speed } from "../sim/useGame";
import { formatClock, formatMoney } from "./format";

const SPEEDS: { s: Speed; label: string }[] = [
	{ s: 0, label: "❚❚" },
	{ s: 1, label: "1×" },
	{ s: 2, label: "2×" },
	{ s: 4, label: "4×" },
];

interface Props {
	game: Game;
	onSave: () => void;
	onExit: () => void;
	notice: string | null;
}

export function Hud({ game, onSave, onExit, notice }: Props) {
	const { view, speed, setSpeed, act } = game;
	const over = view.status.state !== "running";
	const cashClass = view.cash < 0 ? "stat bad" : "stat";
	return (
		<header className="hud">
			<div className="brand">
				<div className="hazard small" />
				Actuator Works
			</div>
			<div className="stat">
				<span className="k">Time</span>
				<span className="v">{formatClock(view.day, view.hour)}</span>
			</div>
			<div className={cashClass}>
				<span className="k">Cash</span>
				<span className="v">{formatMoney(view.cash)}</span>
			</div>
			<div className="stat">
				<span className="k">Reputation</span>
				<span className="v">
					<span className="meter">
						<span style={{ width: `${view.reputation}%` }} />
					</span>
					{view.reputation.toFixed(0)}
				</span>
			</div>
			<div className="stat">
				<span className="k">Shifts</span>
				<span className="v seg">
					{[1, 2, 3].map((n) => (
						<button
							type="button"
							key={n}
							className={view.policies.shifts === n ? "on" : ""}
							onClick={() => act({ type: "set_shifts", shifts: n })}
							disabled={over}
						>
							{n}
						</button>
					))}
				</span>
			</div>
			<div className="seg speed">
				{SPEEDS.map(({ s, label }) => (
					<button
						type="button"
						key={s}
						className={speed === s ? "on" : ""}
						onClick={() => setSpeed(s)}
						disabled={over}
						aria-label={s === 0 ? "Pause" : `Speed ${label}`}
					>
						{label}
					</button>
				))}
			</div>
			<div className="spacer" />
			{notice && <span className="notice">{notice}</span>}
			<button type="button" className="ghost" onClick={onSave}>
				Save
			</button>
			<button type="button" className="ghost" onClick={onExit}>
				Menu
			</button>
		</header>
	);
}
