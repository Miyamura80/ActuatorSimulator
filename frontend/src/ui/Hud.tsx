import { DAILY_DAYS, type Mode, modeLabel } from "../modes";
import type { Game, Speed } from "../sim/useGame";
import { formatClock, formatMoney } from "./format";
import { Glyph } from "./visual/glyphs";
import { CashSpark, DayDial } from "./visual/HudWidgets";

const SPEEDS: { s: Speed; label: string }[] = [
	{ s: 0, label: "❚❚" },
	{ s: 1, label: "1×" },
	{ s: 2, label: "2×" },
	{ s: 4, label: "4×" },
];

interface Props {
	game: Game;
	mode: Mode;
	onSave: () => void;
	onExit: () => void;
	onSettings: () => void;
	notice: string | null;
}

export function Hud({ game, mode, onSave, onExit, onSettings, notice }: Props) {
	const { view, speed, setSpeed, act } = game;
	const over = view.status.state !== "running";
	const cashClass = view.cash < 0 ? "stat cash bad" : "stat cash";
	return (
		<header className="hud">
			<div className="brand">
				<div className="hazard small" />
				Actuator Works
			</div>
			<div className="stat dial">
				<DayDial hour={view.hour} shifts={view.policies.shifts} />
				<span className="v">
					{mode.kind === "daily" && view.day >= DAILY_DAYS
						? `Day ${DAILY_DAYS}`
						: formatClock(view.day, view.hour)}
					{mode.kind === "daily" && (
						<span className="muted"> / {DAILY_DAYS}</span>
					)}
				</span>
			</div>
			<div className={cashClass}>
				<CashSpark view={view} />
				<span className="v">{formatMoney(view.cash)}</span>
			</div>
			<div className="stat">
				<span className="v" title="Reputation: wins bigger contracts">
					<Glyph name="star" size={14} className="gold" />
					<span className="meter">
						<span style={{ width: `${view.reputation}%` }} />
					</span>
					{view.reputation.toFixed(0)}
				</span>
			</div>
			<div className="stat">
				<span className="v seg" title="Shifts per day">
					<Glyph name="user" size={14} className="muted" />
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
			<span className="mode">{modeLabel(mode)}</span>
			{notice && <span className="notice">{notice}</span>}
			{mode.kind !== "daily" && (
				<button type="button" className="ghost" onClick={onSave}>
					Save
				</button>
			)}
			<button
				type="button"
				className="ghost"
				onClick={onSettings}
				aria-label="Settings"
			>
				⚙
			</button>
			<button type="button" className="ghost" onClick={onExit}>
				Menu
			</button>
		</header>
	);
}
