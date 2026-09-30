// Top-bar pictures: a 24-hour dial (lit arc = shift hours, tick = the 17:00
// truck) and a cash sparkline over the red overdraft zone.
import type { View } from "../../sim/types";

const SHIP_HOUR = 17;

/** Hours the line runs for a shift count, as [start, end) on a 24 h clock. */
function shiftSpan(shifts: number): [number, number] {
	if (shifts >= 3) return [0, 24];
	return [8, shifts === 2 ? 24 : 16];
}

export function DayDial({ hour, shifts }: { hour: number; shifts: number }) {
	const [a, b] = shiftSpan(shifts);
	const r = 14;
	const pt = (h: number, rr = r) => {
		const t = (h / 24) * Math.PI * 2 - Math.PI / 2;
		return [18 + rr * Math.cos(t), 18 + rr * Math.sin(t)];
	};
	const [x0, y0] = pt(a);
	const [x1, y1] = pt(b === 24 && a === 0 ? 23.999 : b);
	const large = b - a > 12 ? 1 : 0;
	const [hx, hy] = pt(hour + 0.5, 11);
	const [sx, sy] = pt(SHIP_HOUR, 17);
	const [sx2, sy2] = pt(SHIP_HOUR, 12);
	const on = hour >= a && hour < b;
	return (
		<svg
			width="36"
			height="36"
			viewBox="0 0 36 36"
			className="day-dial"
			role="img"
			aria-label={`${String(hour).padStart(2, "0")}:00, line ${on ? "running" : "closed"}`}
		>
			<circle cx="18" cy="18" r={r} className="night" />
			<path
				d={`M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
				className="shift"
			/>
			<line x1={sx} y1={sy} x2={sx2} y2={sy2} className="ship" />
			<line
				x1="18"
				y1="18"
				x2={hx}
				y2={hy}
				className={on ? "hand on" : "hand"}
			/>
			<circle cx="18" cy="18" r="2" className="hub" />
		</svg>
	);
}

export function CashSpark({ view }: { view: View }) {
	const pts = [...view.history.slice(-20).map((d) => d.cash), view.cash];
	const floor = -view.overdraft_limit;
	const lo = Math.min(floor * 1.1, ...pts);
	const hi = Math.max(0, ...pts) || 1;
	const W = 84;
	const H = 26;
	const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
	const x = (i: number) => (pts.length === 1 ? W : (i / (pts.length - 1)) * W);
	const d = pts
		.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
		.join("");
	const falling = pts.length > 1 && pts[pts.length - 1] < pts[0];
	return (
		<svg
			width={W}
			height={H}
			viewBox={`0 0 ${W} ${H}`}
			className="cash-spark"
			aria-hidden="true"
		>
			{/* Below the overdraft limit the bank closes the plant. */}
			<rect
				x="0"
				y={y(floor)}
				width={W}
				height={H - y(floor)}
				className="bust"
			/>
			<rect
				x="0"
				y={y(0)}
				width={W}
				height={y(floor) - y(0)}
				className="debt"
			/>
			<path d={d} className={falling ? "line down" : "line"} />
		</svg>
	);
}
