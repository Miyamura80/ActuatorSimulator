// Small pictures that replace sentences: stock bars, wear rings, a sampling
// strip, a delivery road, a deadline track.
import type { CSSProperties } from "react";
import type { InspectionPlan } from "../../sim/types";
import { inspectedShare } from "./capacity";
import { healthColor } from "./colors";
import { Glyph } from "./glyphs";

/** On-hand stock (solid), incoming (striped) and the reorder point (tick). */
export function StockGauge({
	qty,
	incoming,
	reorder,
	scale,
}: {
	qty: number;
	incoming: number;
	reorder: number;
	/** Units at full width. */
	scale: number;
}) {
	const w = (n: number) => `${Math.min(100, (n / Math.max(scale, 1)) * 100)}%`;
	const tone = qty === 0 ? "empty" : qty < reorder ? "low" : "ok";
	return (
		<span
			className={`stock-gauge ${tone}`}
			role="img"
			aria-label={`${qty} in stock, ${incoming} coming, reorder below ${reorder}`}
		>
			<span className="have" style={{ width: w(qty) }} />
			<span className="coming" style={{ width: w(incoming) }} />
			{reorder > 0 && <span className="reorder" style={{ left: w(reorder) }} />}
		</span>
	);
}

/** Supplier tier as 1 to 3 stars. */
export function TierStars({
	tier,
}: {
	tier: "premium" | "standard" | "budget";
}) {
	const n = tier === "premium" ? 3 : tier === "standard" ? 2 : 1;
	return (
		<span className="stars" role="img" aria-label={`${tier} tier`}>
			{[0, 1, 2].map((i) => (
				<Glyph key={i} name="star" size={11} className={i < n ? "lit" : ""} />
			))}
		</span>
	);
}

/**
 * Up to 10 dots standing for the lots received, with the rejected share in
 * red. Any rejection shows at least one red dot.
 */
export function LotRecord({
	received,
	rejected,
}: {
	received: number;
	rejected: number;
}) {
	const shown = Math.min(received, 10);
	const bad =
		rejected > 0
			? Math.min(shown, Math.max(1, Math.round((rejected / received) * shown)))
			: 0;
	if (shown === 0) return <span className="lot-record muted small">new</span>;
	return (
		<span
			className="lot-record"
			role="img"
			aria-label={`${rejected} of ${received} lots rejected`}
		>
			{Array.from({ length: shown }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: positional dots
				<i key={i} className={i < bad ? "bad" : ""} />
			))}
		</span>
	);
}

const SAMPLE_PLANS: { plan: InspectionPlan; label: string }[] = [
	{ plan: { mode: "skip" }, label: "0" },
	{ plan: { mode: "sample", percent: 5 }, label: "5%" },
	{ plan: { mode: "sample", percent: 10 }, label: "10%" },
	{ plan: { mode: "sample", percent: 25 }, label: "25%" },
	{ plan: { mode: "full" }, label: "All" },
];

const samePlan = (a: InspectionPlan | undefined, b: InspectionPlan) =>
	inspectedShare(a) === inspectedShare(b) && (a?.mode ?? "skip") === b.mode;

/**
 * An inspection plan picker. A strip of 20 units shows how many get looked
 * at: more lit units catch more defects and cost more.
 */
export function SampleGate({
	plan,
	onChange,
	label,
}: {
	plan: InspectionPlan | undefined;
	onChange: (p: InspectionPlan) => void;
	label: string;
}) {
	const lit = Math.round(inspectedShare(plan) * 20);
	return (
		<div className="sample-gate">
			<span className="units" aria-hidden="true">
				{Array.from({ length: 20 }, (_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: positional units
					<i key={i} className={i < lit ? "seen" : ""} />
				))}
				<Glyph name="eye" size={14} className={lit ? "eye on" : "eye"} />
			</span>
			<div className="seg">
				{SAMPLE_PLANS.map((o) => (
					<button
						type="button"
						aria-pressed={samePlan(plan, o.plan)}
						aria-label={`${label}: ${o.label}`}
						key={o.label}
						className={samePlan(plan, o.plan) ? "on" : ""}
						onClick={() => onChange(o.plan)}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}

/**
 * Trucks on a road from the order date to the promised date. A truck past
 * the end is late.
 */
export function Road({
	now,
	orders,
}: {
	now: number;
	orders: {
		id: number;
		placed: number;
		promised: number;
		late: boolean;
		expedited: boolean;
		icon: React.ReactNode;
		title: string;
	}[];
}) {
	if (orders.length === 0) return null;
	return (
		<ul className="road">
			{orders.map((o) => {
				const span = Math.max(o.promised - o.placed, 1);
				const t = Math.min(1.06, (now - o.placed) / span);
				const days = Math.max(0, Math.ceil((o.promised - now) / 24));
				return (
					<li key={o.id} title={o.title} className={o.late ? "late" : ""}>
						<span className="what">{o.icon}</span>
						<span className="lane">
							<span
								className="truck"
								style={{ left: `${Math.max(0, t) * 100}%` } as CSSProperties}
							>
								<Glyph name="truck" size={16} />
								{o.expedited && <Glyph name="bolt" size={9} />}
							</span>
							<span className="dock" />
						</span>
						<span className="eta">{o.late ? "late" : `${days}d`}</span>
					</li>
				);
			})}
		</ul>
	);
}

/** Machine condition as a ring; a wrench or bolt shows when it is down. */
export function WearRing({
	condition,
	down,
	size = 38,
}: {
	condition: number;
	down: "breakdown" | "maintenance" | null;
	size?: number;
}) {
	const t = condition / 100;
	const r = 15;
	const c = 2 * Math.PI * r;
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 38 38"
			className="wear-ring"
			role="img"
			aria-label={`Condition ${Math.round(condition)}%${down ? `, ${down}` : ""}`}
		>
			<circle cx="19" cy="19" r={r} className="track" />
			<circle
				cx="19"
				cy="19"
				r={r}
				stroke={healthColor(t)}
				strokeDasharray={`${c * t} ${c}`}
				transform="rotate(-90 19 19)"
				className="arc"
			/>
			{down ? (
				<g transform="translate(11 11)">
					<svg
						aria-hidden="true"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						className={down === "breakdown" ? "bad" : "info"}
					>
						{down === "breakdown" ? (
							<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor" />
						) : (
							<path
								d="M14.5 3a5 5 0 0 0-4.6 6.8L3 16.7 7.3 21l6.9-6.9A5 5 0 0 0 21 9.5l-3 3-3.5-1-1-3.5 3-3a5 5 0 0 0-2-.5z"
								fill="currentColor"
							/>
						)}
					</svg>
				</g>
			) : (
				<text x="19" y="23" textAnchor="middle" className="pct">
					{Math.round(condition)}
				</text>
			)}
		</svg>
	);
}

/** Hours since maintenance, filling toward the next scheduled service. */
export function ServiceBar({
	hours,
	interval,
}: {
	hours: number;
	interval: number;
}) {
	// "Never" still draws a bar: it just keeps filling past a notional 320 h.
	const span = interval > 0 ? interval : 320;
	const t = Math.min(1, hours / span);
	return (
		<span
			className={`service-bar${interval === 0 ? " never" : ""}`}
			role="img"
			aria-label={`${hours} h since maintenance${interval ? ` of ${interval}` : ""}`}
		>
			<span style={{ width: `${t * 100}%`, background: healthColor(1 - t) }} />
			{interval > 0 && <Glyph name="wrench" size={11} className="due" />}
		</span>
	);
}

/**
 * Time from now to a deadline (flag) with the forecast finish (truck).
 * Anything past the flag is late.
 */
export function DeadlineTrack({
	hoursLeft,
	forecastHours,
}: {
	hoursLeft: number;
	/** Infinity when the line can't make any. */
	forecastHours: number;
}) {
	const span = Math.max(hoursLeft, Math.min(forecastHours, hoursLeft * 2), 24);
	const x = (h: number) => `${Math.min(100, (Math.max(0, h) / span) * 91)}%`;
	const late = forecastHours > hoursLeft;
	return (
		<span
			className={`deadline-track${late ? " late" : ""}`}
			role="img"
			aria-label={`${
				hoursLeft < 0 ? "Overdue" : `Due in ${Math.ceil(hoursLeft / 24)} days`
			}; ${
				Number.isFinite(forecastHours)
					? `done in about ${Math.ceil(forecastHours / 24)} days`
					: "no delivery forecast"
			}`}
		>
			<span className="span" style={{ width: x(hoursLeft) }} />
			{late && (
				<span
					className="overrun"
					style={{
						left: x(hoursLeft),
						width: `calc(${x(forecastHours)} - ${x(hoursLeft)})`,
					}}
				/>
			)}
			<span className="flag" style={{ left: x(hoursLeft) }} />
			<span className="flag-label" style={{ left: x(hoursLeft) }}>
				<Glyph name="clock" size={11} />
				{Math.max(0, Math.ceil(hoursLeft / 24))}d
			</span>
			<span className="eta" style={{ left: x(forecastHours) }}>
				<Glyph name="truck" size={15} />
			</span>
		</span>
	);
}
