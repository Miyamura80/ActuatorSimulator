// Control chart drawn as zones: green is normal, amber is drifting, red is
// out of control. The limit lines are the edges of the red zone.

const W = 300;

export function SpcChart({
	values,
	limit,
	height = 64,
	title,
}: {
	values: number[];
	/** The ±limit (3 sigma), in the same units as values. */
	limit: number;
	height?: number;
	title: string;
}) {
	const h = height;
	const max = limit * 1.2;
	const y = (v: number) =>
		h / 2 - (Math.max(-max, Math.min(max, v)) / max) * ((h - 8) / 2);
	const warn = (limit * 2) / 3;
	const n = Math.max(values.length - 1, 1);
	const x = (i: number) => 4 + ((W - 8) * i) / n;
	const d = values
		.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
		.join("");
	const last = values[values.length - 1] as number | undefined;
	return (
		<svg
			viewBox={`0 0 ${W} ${h}`}
			className="spc-chart"
			role="img"
			aria-label={title}
		>
			<title>{title}</title>
			<rect x="0" y="0" width={W} height={y(limit)} className="zone red" />
			<rect
				x="0"
				y={y(-limit)}
				width={W}
				height={h - y(-limit)}
				className="zone red"
			/>
			<rect
				x="0"
				y={y(limit)}
				width={W}
				height={y(warn) - y(limit)}
				className="zone amber"
			/>
			<rect
				x="0"
				y={y(-warn)}
				width={W}
				height={y(-limit) - y(-warn)}
				className="zone amber"
			/>
			<rect
				x="0"
				y={y(warn)}
				width={W}
				height={y(-warn) - y(warn)}
				className="zone green"
			/>
			<line x1="0" x2={W} y1={h / 2} y2={h / 2} className="centre" />
			{values.length > 0 && <path d={d} className="trace" />}
			{values.map((v, i) =>
				Math.abs(v) > limit ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: points are positional
					<circle key={i} cx={x(i)} cy={y(v)} r="3" className="out" />
				) : null,
			)}
			{last !== undefined && (
				<circle
					cx={x(values.length - 1)}
					cy={y(last)}
					r="2.5"
					className="now"
				/>
			)}
		</svg>
	);
}
