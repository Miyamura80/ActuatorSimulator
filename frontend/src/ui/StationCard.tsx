import { useEffect, useRef, useState } from "react";
import { beaconState } from "../floor/status";
import type { StationKind } from "../sim/types";
import type { Game } from "../sim/useGame";
import { formatMoney, formatMoneyCompact } from "./format";
import { IntField } from "./IntField";
import { ServiceBar, WearRing } from "./visual/gauges";
import { Glyph, type GlyphName } from "./visual/glyphs";
import { ItemIcon, StationIcon } from "./visual/icons";
import { SpcChart } from "./visual/SpcChart";

const STATE: Record<string, { label: string; glyph: GlyphName | null }> = {
	running: { label: "Running", glyph: "check" },
	starved: { label: "No parts", glyph: "alert" },
	alarm: { label: "Drifting", glyph: "alert" },
	degraded: { label: "Part down", glyph: "bolt" },
	broken: { label: "Broken", glyph: "bolt" },
	maintenance: { label: "Service", glyph: "wrench" },
	off: { label: "Idle", glyph: "clock" },
};

const PM_OPTIONS = [0, 80, 120, 200, 320];

interface Props {
	game: Game;
	kind: StationKind;
	onClose: () => void;
}

export function StationCard({ game, kind, onClose }: Props) {
	const { view, act } = game;
	const [error, setError] = useState<string | null>(null);
	// Selling is permanent and returns half the price: ask once first.
	const [confirmSell, setConfirmSell] = useState(false);
	const confirmRef = useRef<HTMLButtonElement>(null);
	// The Sell button it replaces had focus; hand it to the confirmation.
	useEffect(() => {
		if (confirmSell) confirmRef.current?.focus();
	}, [confirmSell]);
	const closeRef = useRef<HTMLButtonElement>(null);
	// A newly opened card takes focus so keyboard and screen-reader users land
	// in it. (GameScreen keys the card by station, so errors reset too.)
	useEffect(() => closeRef.current?.focus(), []);
	const st = view.stations.find((s) => s.kind === kind);
	if (!st) return null;
	const state = beaconState(st, view.operating);
	// The sim sells the most worn machine at half price scaled by condition.
	const worst = Math.min(...st.machines.map((m) => m.condition));
	const resale = Math.round((st.machine_price * 0.5 * worst) / 100);
	const run = (err: string | null) => setError(err);
	const have = (item: string) =>
		view.stock.find((s) => s.item === item)?.qty ?? 0;
	const label = (item: string) =>
		view.stock.find((s) => s.item === item)?.label ?? item;
	const s = STATE[state];
	return (
		<div className="station-card">
			<header>
				<StationIcon kind={kind} size={24} />
				<strong>{st.label}</strong>
				<span className={`pill beacon-${state}`}>
					{s.glyph && <Glyph name={s.glyph} size={12} />} {s.label}
				</span>
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

			{/* Recipe: what goes in (with stock on hand) and what comes out. */}
			<div className="recipe">
				{st.inputs.map(([item, n], i) => (
					<span key={item} className="ingredient-wrap">
						{i > 0 && <span className="op">+</span>}
						<span
							className={`ingredient${st.starved_on === item ? " starved" : ""}${have(item) === 0 ? " empty" : ""}`}
							title={label(item)}
						>
							<ItemIcon item={item} size={26} title={label(item)} />
							{n > 1 && <span className="times">×{n}</span>}
							<span className="have num">{have(item)}</span>
						</span>
					</span>
				))}
				<span className="op arrow" aria-hidden="true">
					<span className={st.busy ? "belt moving" : "belt"} />
				</span>
				<span className="ingredient out" title={label(st.output)}>
					<ItemIcon item={st.output} size={30} title={label(st.output)} />
					<span className="have num">{have(st.output)}</span>
				</span>
				<span className="rate" title="Capacity per hour">
					<span className="num">
						{st.machines.filter((m) => !m.down_reason).length *
							st.rate_per_hour}
					</span>
					<span className="muted small">/h</span>
				</span>
			</div>

			<ul className="machines">
				{st.machines.map((m) => (
					<li key={m.id}>
						<WearRing condition={m.condition} down={m.down_reason} />
						<ServiceBar hours={m.hours_since_pm} interval={st.pm_interval} />
					</li>
				))}
				<li className="add">
					<button
						type="button"
						className="add-machine"
						onClick={() => run(act({ type: "buy_machine", station: kind }))}
						title={`Buy a machine for ${formatMoney(st.machine_price)}`}
					>
						<Glyph name="plus" size={14} />
						<span className="small">
							{formatMoneyCompact(st.machine_price)}
						</span>
					</button>
				</li>
			</ul>

			<SpcChart
				title={`${st.label} process drift`}
				values={st.spc}
				limit={view.spc_limit}
			/>

			<div className="knob" title="Scheduled maintenance, in operating hours">
				<Glyph name="wrench" size={14} />
				<div className="seg">
					{PM_OPTIONS.map((h) => (
						<button
							type="button"
							aria-pressed={st.pm_interval === h}
							key={h}
							className={st.pm_interval === h ? "on" : ""}
							onClick={() =>
								run(act({ type: "set_pm_interval", station: kind, hours: h }))
							}
						>
							{h === 0 ? "Never" : `${h}h`}
						</button>
					))}
				</div>
			</div>
			<div className="knob" title="Most finished parts to hold before pausing">
				<ItemIcon item={st.output} size={16} />
				<span className="muted small">max</span>
				<IntField
					label="Buffer cap"
					min={1}
					value={st.wip_cap}
					onCommit={(cap) =>
						run(act({ type: "set_wip_cap", station: kind, cap }))
					}
				/>
			</div>

			<div className="actions">
				<button
					type="button"
					onClick={() => run(act({ type: "maintain", station: kind }))}
				>
					<Glyph name="wrench" size={14} /> Service now
				</button>
				{confirmSell ? (
					<>
						<button
							ref={confirmRef}
							type="button"
							className="danger"
							onClick={() => {
								setConfirmSell(false);
								run(act({ type: "sell_machine", station: kind }));
							}}
						>
							Sell for {formatMoney(resale)}?
						</button>
						<button
							type="button"
							className="ghost"
							onClick={() => setConfirmSell(false)}
						>
							Keep
						</button>
					</>
				) : (
					<button
						type="button"
						className="ghost"
						disabled={st.machines.length <= 1}
						onClick={() => setConfirmSell(true)}
					>
						<Glyph name="minus" size={12} /> Sell worst
					</button>
				)}
			</div>
			{error && (
				<p className="error" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
