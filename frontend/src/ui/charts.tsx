// Tiny single-series SVG charts with a hover readout. One series per chart
// (no dual axes); titles name the series, so no legend is needed.
import { useState } from "react";

interface Common {
	values: number[];
	/** X labels (e.g. day numbers), same length as values. */
	xs?: number[];
	format: (v: number) => string;
	height?: number;
	/** Optional horizontal reference lines, e.g. SPC limits. */
	refs?: number[];
	/** Fix the y range instead of fitting the data. */
	domain?: [number, number];
	/** Accessible name for the chart. */
	title: string;
}

const W = 320;
const PAD = { l: 44, r: 8, t: 8, b: 18 };

function scale(
	values: number[],
	domain?: [number, number],
	refs: number[] = [],
) {
	const lo = domain?.[0] ?? Math.min(0, ...values, ...refs);
	let hi = domain?.[1] ?? Math.max(...values, ...refs);
	if (hi === lo) hi = lo + 1;
	return { lo, hi };
}

function Hover({
	i,
	x,
	label,
	value,
	h,
}: {
	i: number | null;
	x: number;
	label: string;
	value: string;
	h: number;
}) {
	if (i === null) return null;
	const left = x > W - 110;
	return (
		<g pointerEvents="none">
			<line x1={x} x2={x} y1={PAD.t} y2={h - PAD.b} className="chart-cross" />
			<text
				x={left ? x - 6 : x + 6}
				y={PAD.t + 10}
				textAnchor={left ? "end" : "start"}
				className="chart-tip"
			>
				{label}: {value}
			</text>
		</g>
	);
}

export function LineChart({
	title,
	values,
	xs,
	format,
	height = 120,
	refs = [],
	domain,
}: Common) {
	const [hover, setHover] = useState<number | null>(null);
	if (values.length === 0) return <p className="muted">No data yet.</p>;
	const h = height;
	const { lo, hi } = scale(values, domain, refs);
	const n = Math.max(values.length - 1, 1);
	const x = (i: number) => PAD.l + ((W - PAD.l - PAD.r) * i) / n;
	const y = (v: number) =>
		PAD.t + (h - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));
	const d = values
		.map(
			(v, i) =>
				`${i ? "L" : "M"}${x(i).toFixed(1)} ${y(Math.min(hi, Math.max(lo, v))).toFixed(1)}`,
		)
		.join("");
	const label = (i: number) => (xs ? `Day ${xs[i] + 1}` : `#${i + 1}`);
	return (
		<svg
			viewBox={`0 0 ${W} ${h}`}
			className="chart"
			role="img"
			aria-label={title}
			onMouseLeave={() => setHover(null)}
			onMouseMove={(e) => {
				const r = e.currentTarget.getBoundingClientRect();
				const px = ((e.clientX - r.left) / r.width) * W;
				setHover(Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * n));
			}}
		>
			<title>{title}</title>
			{[lo, (lo + hi) / 2, hi].map((v) => (
				<g key={v}>
					<line
						x1={PAD.l}
						x2={W - PAD.r}
						y1={y(v)}
						y2={y(v)}
						className="chart-grid"
					/>
					<text
						x={PAD.l - 4}
						y={y(v) + 3}
						textAnchor="end"
						className="chart-axis"
					>
						{format(v)}
					</text>
				</g>
			))}
			{lo < 0 && hi > 0 && (
				<line
					x1={PAD.l}
					x2={W - PAD.r}
					y1={y(0)}
					y2={y(0)}
					className="chart-zero"
				/>
			)}
			{refs.map((r) => (
				<line
					key={r}
					x1={PAD.l}
					x2={W - PAD.r}
					y1={y(r)}
					y2={y(r)}
					className="chart-ref"
				/>
			))}
			<path d={d} className="chart-line" />
			{values.length === 1 && (
				// A lone reading has no line to draw; mark the point instead.
				<circle
					cx={x(0)}
					cy={y(Math.min(hi, Math.max(lo, values[0])))}
					r={3}
					className="chart-dot"
				/>
			)}
			<Hover
				i={hover !== null && hover >= 0 && hover < values.length ? hover : null}
				x={x(hover ?? 0)}
				label={hover !== null ? label(hover) : ""}
				value={
					hover !== null && values[hover] !== undefined
						? format(values[hover])
						: ""
				}
				h={h}
			/>
		</svg>
	);
}

export function BarChart({ title, values, xs, format, height = 100 }: Common) {
	const [hover, setHover] = useState<number | null>(null);
	if (values.length === 0) return <p className="muted">No data yet.</p>;
	const h = height;
	const { lo, hi } = scale(values);
	const bw = (W - PAD.l - PAD.r) / values.length;
	const y = (v: number) =>
		PAD.t + (h - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));
	const label = (i: number) => (xs ? `Day ${xs[i] + 1}` : `#${i + 1}`);
	return (
		<svg
			viewBox={`0 0 ${W} ${h}`}
			className="chart"
			role="img"
			aria-label={title}
			onMouseLeave={() => setHover(null)}
			onMouseMove={(e) => {
				const r = e.currentTarget.getBoundingClientRect();
				const px = ((e.clientX - r.left) / r.width) * W;
				const idx = Math.floor((px - PAD.l) / bw);
				setHover(idx >= 0 && idx < values.length ? idx : null);
			}}
		>
			<title>{title}</title>
			{[lo, hi].map((v) => (
				<g key={v}>
					<line
						x1={PAD.l}
						x2={W - PAD.r}
						y1={y(v)}
						y2={y(v)}
						className="chart-grid"
					/>
					<text
						x={PAD.l - 4}
						y={y(v) + 3}
						textAnchor="end"
						className="chart-axis"
					>
						{format(v)}
					</text>
				</g>
			))}
			{values.map((v, i) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
					key={i}
					x={PAD.l + i * bw + 1}
					y={Math.min(y(v), y(0))}
					width={Math.max(bw - 2, 1)}
					height={Math.max(Math.abs(y(0) - y(v)), v === 0 ? 0 : 1)}
					rx={2}
					className={hover === i ? "chart-bar on" : "chart-bar"}
				/>
			))}
			<Hover
				i={hover}
				x={PAD.l + (hover ?? 0) * bw + bw / 2}
				label={hover !== null ? label(hover) : ""}
				value={hover !== null ? format(values[hover]) : ""}
				h={h}
			/>
		</svg>
	);
}

/** Horizontal bars sorted largest first (a Pareto of categories). */
export function Pareto({
	rows,
	format,
}: {
	rows: { label: string; value: number }[];
	format: (v: number) => string;
}) {
	const sorted = [...rows]
		.filter((r) => r.value > 0)
		.sort((a, b) => b.value - a.value);
	const max = sorted[0]?.value ?? 1;
	if (sorted.length === 0) return <p className="muted">Nothing yet.</p>;
	return (
		<ul className="pareto">
			{sorted.map((r) => (
				<li key={r.label}>
					<span className="lbl">{r.label}</span>
					<span className="bar">
						<span style={{ width: `${(r.value / max) * 100}%` }} />
					</span>
					<span className="val">{format(r.value)}</span>
				</li>
			))}
		</ul>
	);
}
