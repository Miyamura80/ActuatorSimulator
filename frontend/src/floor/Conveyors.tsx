// Belts between stations, parts riding them, loading docks, and buffer crates.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";
import { CONVEYORS, type Conveyor, type Vec2 } from "./layout";
import { Part } from "./Machines";
import { COLORS, ITEM_COLOR } from "./palette";

const BELT_Y = 0.25;
const PART_SPACING = 1.1;
const BELT_SPEED = 1.4;

interface Segment {
	from: Vec2;
	len: number;
	angle: number;
	mid: Vec2;
}

function segments(points: Vec2[]): Segment[] {
	const out: Segment[] = [];
	for (let i = 0; i + 1 < points.length; i++) {
		const [ax, az] = points[i];
		const [bx, bz] = points[i + 1];
		const dx = bx - ax;
		const dz = bz - az;
		out.push({
			from: [ax, az],
			len: Math.hypot(dx, dz),
			angle: Math.atan2(-dz, dx),
			mid: [(ax + bx) / 2, (az + bz) / 2],
		});
	}
	return out;
}

/** Point at distance `d` along the polyline. */
function pointAt(segs: Segment[], d: number): Vec2 {
	let left = d;
	for (const s of segs) {
		if (left <= s.len) {
			const t = left / s.len;
			return [
				s.from[0] + Math.cos(s.angle) * s.len * t,
				s.from[1] - Math.sin(s.angle) * s.len * t,
			];
		}
		left -= s.len;
	}
	const last = segs[segs.length - 1];
	return [
		last.from[0] + Math.cos(last.angle) * last.len,
		last.from[1] - Math.sin(last.angle) * last.len,
	];
}

function Belt({ conveyor, active }: { conveyor: Conveyor; active: boolean }) {
	const segs = useMemo(() => segments(conveyor.points), [conveyor]);
	const total = segs.reduce((a, s) => a + s.len, 0);
	const count = Math.max(1, Math.floor(total / PART_SPACING));
	const parts = useRef<(THREE.Mesh | null)[]>([]);
	const offset = useRef(0);
	const color = ITEM_COLOR[conveyor.item] ?? COLORS.accent;

	useFrame((_, dt) => {
		if (active) offset.current = (offset.current + dt * BELT_SPEED) % total;
		parts.current.forEach((m, i) => {
			if (!m) return;
			const [x, z] = pointAt(segs, (offset.current + i * PART_SPACING) % total);
			m.position.set(x, BELT_Y + 0.14, z);
			m.visible = active;
		});
	});

	return (
		<group>
			{segs.map((s) => (
				<group
					key={`${s.from[0]},${s.from[1]}`}
					position={[s.mid[0], BELT_Y, s.mid[1]]}
					rotation={[0, s.angle, 0]}
				>
					<Part color={COLORS.belt} outline={false}>
						<boxGeometry args={[s.len + 0.5, 0.08, 0.5]} />
					</Part>
					<Part pos={[0, 0.02, 0.28]} color={COLORS.rail} outline={false}>
						<boxGeometry args={[s.len + 0.5, 0.1, 0.06]} />
					</Part>
					<Part pos={[0, 0.02, -0.28]} color={COLORS.rail} outline={false}>
						<boxGeometry args={[s.len + 0.5, 0.1, 0.06]} />
					</Part>
				</group>
			))}
			{Array.from({ length: count }, (_, i) => (
				<mesh
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size pool of belt slots
					key={i}
					ref={(m) => {
						parts.current[i] = m;
					}}
					castShadow
				>
					<boxGeometry args={[0.26, 0.2, 0.26]} />
					<meshToonMaterial color={color} />
				</mesh>
			))}
		</group>
	);
}

export function Conveyors({ isBusy }: { isBusy: (c: Conveyor) => boolean }) {
	return (
		<group>
			{CONVEYORS.map((c) => (
				<Belt key={c.id} conveyor={c} active={isBusy(c)} />
			))}
		</group>
	);
}

/** Stack of crates showing roughly how full a buffer is (log scale). */
export function CrateStack({ pos, qty }: { pos: Vec2; qty: number }) {
	const n = qty <= 0 ? 0 : Math.min(9, Math.ceil(Math.log2(qty + 1) * 1.3));
	return (
		<group position={[pos[0], 0, pos[1]]}>
			{Array.from({ length: n }, (_, i) => {
				const layer = Math.floor(i / 3);
				const slot = i % 3;
				return (
					<Part
						// biome-ignore lint/suspicious/noArrayIndexKey: crates are interchangeable
						key={i}
						pos={[(slot - 1) * 0.38, 0.17 + layer * 0.34, 0]}
						color={COLORS.crate}
					>
						<boxGeometry args={[0.34, 0.32, 0.34]} />
					</Part>
				);
			})}
		</group>
	);
}

/** A loading dock with a parked truck. */
export function Dock({
	pos,
	label,
	facing,
}: {
	pos: Vec2;
	label: string;
	facing: 1 | -1;
}) {
	return (
		<group position={[pos[0], 0, pos[1]]} name={label}>
			<Part pos={[0, 0.1, 0]} color={COLORS.dock}>
				<boxGeometry args={[4, 0.2, 7]} />
			</Part>
			<group position={[-facing * 3.2, 0, 0]}>
				<Part pos={[0, 1.1, 0]} color={COLORS.body}>
					<boxGeometry args={[2.6, 1.8, 1.8]} />
				</Part>
				<Part pos={[facing * -1.8, 0.8, 0]} color={COLORS.accent}>
					<boxGeometry args={[1, 1.2, 1.7]} />
				</Part>
			</group>
			<CrateStack pos={[0.6, -1.8]} qty={40} />
			<CrateStack pos={[0.6, 1.8]} qty={12} />
		</group>
	);
}
