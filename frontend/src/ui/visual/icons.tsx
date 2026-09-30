// One glyph per part, station and common idea, drawn on a 24 x 24 grid.
// Parts use their belt colour, so an icon in a gauge matches the box on the
// conveyor.
import type { ReactNode } from "react";
import type { Item, StationKind } from "../../sim/types";
import { ITEM_COLOR } from "./colors";
import { INK, Svg } from "./glyphs";

const STEEL = "#aab3bc";

/** A gear outline centred at (cx, cy), as a path. */
function gearPath(cx: number, cy: number, r: number, teeth: number) {
	const pts: string[] = [];
	for (let i = 0; i < teeth * 2; i++) {
		const a = (i / (teeth * 2)) * Math.PI * 2;
		const rr = i % 2 === 0 ? r : r * 0.78;
		const a0 = a - Math.PI / (teeth * 2) / 1.6;
		const a1 = a + Math.PI / (teeth * 2) / 1.6;
		pts.push(
			`${(cx + rr * Math.cos(a0)).toFixed(2)} ${(cy + rr * Math.sin(a0)).toFixed(2)}`,
			`${(cx + rr * Math.cos(a1)).toFixed(2)} ${(cy + rr * Math.sin(a1)).toFixed(2)}`,
		);
	}
	return `M${pts.join("L")}Z`;
}

const GLYPH: Record<Item, (c: string) => ReactNode> = {
	magnets: (c) => (
		<>
			<path
				d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z"
				fill={c}
				stroke={INK}
				strokeWidth="0.8"
			/>
			<rect x="6" y="3" width="4" height="3" fill="#e8e6e1" />
			<rect x="14" y="3" width="4" height="3" fill="#e8e6e1" />
		</>
	),
	laminations: (c) => (
		<>
			{[0, 1, 2, 3].map((i) => (
				<path
					key={i}
					d={`M4 ${15 - i * 3}l8-4 8 4-8 4z`}
					fill={c}
					stroke="#c9d1d9"
					strokeWidth="0.8"
				/>
			))}
		</>
	),
	copper_wire: (c) => (
		<>
			<rect x="5" y="4" width="14" height="3" rx="1" fill="#59616a" />
			<rect x="5" y="17" width="14" height="3" rx="1" fill="#59616a" />
			<rect x="7" y="7" width="10" height="10" fill={c} />
			{[9, 11, 13, 15].map((y) => (
				<line
					key={y}
					x1="7"
					x2="17"
					y1={y}
					y2={y}
					stroke="#8a4a1a"
					strokeWidth="0.7"
				/>
			))}
		</>
	),
	bearing: (c) => (
		<>
			<circle cx="12" cy="12" r="9" fill={c} stroke={INK} strokeWidth="0.8" />
			<circle cx="12" cy="12" r="4" fill={INK} />
			{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
				const a = (i / 8) * Math.PI * 2;
				return (
					<circle
						key={i}
						cx={12 + 6.4 * Math.cos(a)}
						cy={12 + 6.4 * Math.sin(a)}
						r="1.5"
						fill="#f4f6f8"
						stroke={INK}
						strokeWidth="0.4"
					/>
				);
			})}
		</>
	),
	encoder_ic: (c) => (
		<>
			{[7, 10, 13, 16].flatMap((p) => [
				<rect key={`t${p}`} x={p} y="3" width="1.4" height="3" fill={STEEL} />,
				<rect key={`b${p}`} x={p} y="18" width="1.4" height="3" fill={STEEL} />,
			])}
			<rect x="5" y="6" width="14" height="12" rx="1.5" fill={c} />
			<circle cx="8" cy="9" r="1" fill="#6b737c" />
		</>
	),
	pcb_blank: (c) => (
		<>
			<rect x="3" y="5" width="18" height="14" rx="1.5" fill={c} />
			<path
				d="M6 9h5v4h6M6 15h4"
				stroke="#d6c26a"
				strokeWidth="1"
				fill="none"
			/>
			<circle cx="18" cy="8" r="1" fill="#d6c26a" />
		</>
	),
	alu_billet: (c) => (
		<>
			<rect x="3" y="8" width="16" height="8" fill={c} />
			<ellipse
				cx="19"
				cy="12"
				rx="2.5"
				ry="4"
				fill="#eef1f4"
				stroke="#8a939c"
			/>
			<ellipse cx="3" cy="12" rx="2.5" ry="4" fill={c} />
		</>
	),
	steel_blank: (c) => (
		<>
			<ellipse cx="12" cy="15" rx="9" ry="4" fill="#4d565f" />
			<rect x="3" y="10" width="18" height="5" fill={c} />
			<ellipse cx="12" cy="10" rx="9" ry="4" fill="#a3adb7" />
		</>
	),
	housing: (c) => (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" fill={c} />
			<circle
				cx="12"
				cy="12"
				r="5"
				fill="#59616a"
				stroke="#8a939c"
				strokeWidth="1"
			/>
			{[
				[5.5, 6.5],
				[18.5, 6.5],
				[5.5, 17.5],
				[18.5, 17.5],
			].map(([x, y]) => (
				<circle key={`${x}${y}`} cx={x} cy={y} r="1" fill="#59616a" />
			))}
		</>
	),
	gear_set: (c) => (
		<>
			<path
				d={gearPath(12, 12, 10, 10)}
				fill={c}
				stroke={INK}
				strokeWidth="0.6"
			/>
			<circle cx="12" cy="12" r="3" fill={INK} />
		</>
	),
	stator: (c) => (
		<>
			<circle cx="12" cy="12" r="10" fill="#59616a" />
			<circle cx="12" cy="12" r="8" fill={c} />
			<circle cx="12" cy="12" r="4.5" fill={INK} />
			{[0, 1, 2, 3, 4, 5].map((i) => {
				const a = (i / 6) * Math.PI * 2;
				return (
					<line
						key={i}
						x1={12 + 4.5 * Math.cos(a)}
						y1={12 + 4.5 * Math.sin(a)}
						x2={12 + 8 * Math.cos(a)}
						y2={12 + 8 * Math.sin(a)}
						stroke="#59616a"
						strokeWidth="1.4"
					/>
				);
			})}
		</>
	),
	driver_board: (c) => (
		<>
			<rect x="3" y="5" width="18" height="14" rx="1.5" fill={c} />
			<rect x="8" y="8" width="8" height="8" rx="1" fill={INK} />
			<rect x="4.5" y="7" width="2" height="3" fill="#d6c26a" />
			<rect x="4.5" y="14" width="2" height="3" fill="#d6c26a" />
			<rect x="17.5" y="10" width="2" height="4" fill="#c9d1d9" />
		</>
	),
	motor: (c) => (
		<>
			<rect x="3" y="6" width="14" height="12" rx="2" fill={c} />
			{[8, 11, 14].map((x) => (
				<line
					key={x}
					x1={x}
					x2={x}
					y1="6"
					y2="18"
					stroke="#2f4f8f"
					strokeWidth="0.8"
				/>
			))}
			<rect x="17" y="9" width="2" height="6" fill="#59616a" />
			<rect x="19" y="11" width="3" height="2" fill={STEEL} />
		</>
	),
	actuator: (c) => (
		<>
			<rect x="4" y="5" width="14" height="14" rx="3" fill={c} />
			<circle cx="11" cy="12" r="4" fill={INK} />
			<circle cx="11" cy="12" r="1.5" fill={c} />
			<rect x="18" y="8" width="3" height="8" rx="1" fill="#59616a" />
		</>
	),
	finished_good: (c) => (
		<>
			<path d="M3 8l9-4 9 4v10l-9 4-9-4z" fill="#b07a44" />
			<path d="M3 8l9 4 9-4M12 12v10" stroke="#7a4f24" fill="none" />
			<circle cx="17" cy="17" r="5" fill={c} stroke={INK} strokeWidth="0.8" />
			<path
				d="M14.6 17l1.7 1.7 3.2-3.4"
				stroke={INK}
				strokeWidth="1.6"
				fill="none"
				strokeLinecap="round"
			/>
		</>
	),
};

export function ItemIcon({
	item,
	size = 20,
	title,
}: {
	item: Item;
	size?: number;
	title?: string;
}) {
	return (
		<Svg size={size} title={title}>
			{GLYPH[item](ITEM_COLOR[item])}
		</Svg>
	);
}

const Y = "#f2b705";
const W = "#dfe3e7";

const STATION: Record<StationKind, ReactNode> = {
	mill: (
		<>
			<rect x="4" y="3" width="16" height="5" rx="1" fill={W} />
			<rect x="10" y="8" width="4" height="5" fill={STEEL} />
			<path d="M11 13h2l-.4 5h-1.2z" fill={Y} />
			<rect x="3" y="19" width="18" height="2" rx="1" fill="#59616a" />
		</>
	),
	gear_cut: (
		<>
			<path d={gearPath(9, 14, 7, 9)} fill={STEEL} />
			<circle cx="9" cy="14" r="2" fill={INK} />
			<rect x="15" y="3" width="4" height="10" rx="2" fill={Y} />
			{[5, 7.5, 10].map((y) => (
				<line key={y} x1="15" x2="19" y1={y} y2={y} stroke={INK} />
			))}
		</>
	),
	winding: (
		<>
			<circle cx="12" cy="12" r="9" fill="#59616a" />
			<circle cx="12" cy="12" r="6.5" fill={ITEM_COLOR.copper_wire} />
			<circle cx="12" cy="12" r="3" fill={INK} />
			<path d="M20 4l-5 5" stroke={Y} strokeWidth="2" strokeLinecap="round" />
		</>
	),
	smt: (
		<>
			<rect
				x="3"
				y="14"
				width="18"
				height="6"
				rx="1"
				fill={ITEM_COLOR.pcb_blank}
			/>
			<rect x="10" y="3" width="4" height="6" fill={Y} />
			<path d="M12 9v3" stroke={W} strokeWidth="1.5" />
			<rect x="10" y="12" width="4" height="2" fill={INK} />
		</>
	),
	motor_asm: (
		<>
			<rect x="3" y="6" width="13" height="12" rx="2" fill={ITEM_COLOR.motor} />
			<rect x="16" y="10" width="5" height="4" fill={STEEL} />
			<circle cx="9.5" cy="12" r="3" fill={ITEM_COLOR.stator} />
		</>
	),
	final_asm: (
		<>
			<rect x="3" y="18" width="8" height="3" rx="1" fill="#59616a" />
			<path
				d="M7 18V12l6-5 5 3"
				stroke={Y}
				strokeWidth="3"
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="7" cy="12" r="1.8" fill={INK} />
			<circle cx="13" cy="7" r="1.8" fill={INK} />
			<path d="M18 10l2 2M18 10l2-2" stroke={W} strokeWidth="1.5" />
		</>
	),
	eol_test: (
		<>
			<rect
				x="3"
				y="4"
				width="18"
				height="13"
				rx="1.5"
				fill="#23282d"
				stroke={STEEL}
			/>
			<path
				d="M5 11h3l2-4 3 8 2-4h4"
				stroke="#3ec27a"
				strokeWidth="1.5"
				fill="none"
				strokeLinejoin="round"
			/>
			<rect x="9" y="18" width="6" height="3" fill="#59616a" />
		</>
	),
};

export function StationIcon({
	kind,
	size = 20,
	title,
}: {
	kind: StationKind;
	size?: number;
	title?: string;
}) {
	return (
		<Svg size={size} title={title}>
			{STATION[kind]}
		</Svg>
	);
}
