// Belts between and through stations, and the parts riding them. The shapes
// (plates, corners, rails with merge gaps, legs) come from conveyorPath.ts.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Item } from "../sim/types";
import {
	BELT_HW,
	type BeltParts,
	beltParts,
	pathLength,
	type Segment,
	type Span,
	segmentsOf,
} from "./conveyorPath";
import { CONVEYORS, type Conveyor, type Vec2 } from "./layout";
import { G, M, MAT, Static, type V3, type Xform } from "./models/kit";
import { itemMaterial } from "./palette";

/** Height of the belt surface. */
const BELT_Y = 0.5;
const PART_SPACING = 0.9;
const BELT_SPEED = 1.4;
/** World length of one cleat period in the belt texture. */
const CLEAT = 0.3;

let beltImage: THREE.CanvasTexture | null = null;

/** Rubber belt with cross cleats; each segment clones it to scroll alone. */
function beltTexture(): THREE.CanvasTexture {
	if (beltImage) return beltImage;
	const c = document.createElement("canvas");
	c.width = 64;
	c.height = 64;
	const g = c.getContext("2d");
	if (g) {
		g.fillStyle = "#1c1f22";
		g.fillRect(0, 0, 64, 64);
		g.fillStyle = "#34393e";
		g.fillRect(0, 0, 10, 64);
		g.fillStyle = "#26292d";
		g.fillRect(10, 0, 4, 64);
	}
	beltImage = new THREE.CanvasTexture(c);
	beltImage.wrapS = THREE.RepeatWrapping;
	beltImage.colorSpace = THREE.SRGBColorSpace;
	beltImage.anisotropy = 4;
	return beltImage;
}

const SIDE = 0.05;
const LEG_H = BELT_Y - 0.12;

type StaticSet = Record<
	"legs" | "feet" | "cross" | "beams" | "caps" | "plates" | "drums",
	Xform[]
>;

/** Every non-moving belt piece, in world space, grouped by shape. */
function staticPieces(all: BeltParts[]): StaticSet {
	const out: StaticSet = {
		legs: [],
		feet: [],
		cross: [],
		beams: [],
		caps: [],
		plates: [],
		drums: [],
	};
	// Local (u along the belt, v across it) to world, for a frame at `a`.
	const frame = (a: Vec2, angle: number) => {
		const dx = Math.cos(angle);
		const dz = -Math.sin(angle);
		return (u: number, y: number, v: number): V3 => [
			a[0] + dx * u - dz * v,
			y,
			a[1] + dz * u + dx * v,
		];
	};
	const legsAt = (
		at: (u: number, y: number, v: number) => V3,
		u: number,
		angle: number,
	) => {
		for (const s of [-1, 1]) {
			out.legs.push({
				p: at(u, LEG_H / 2, s * (BELT_HW - 0.03)),
				r: [0, angle, 0],
			});
			out.feet.push({ p: at(u, 0.01, s * (BELT_HW - 0.03)), r: [0, angle, 0] });
		}
		out.cross.push({ p: at(u, 0.16, 0), r: [0, angle, 0] });
	};
	const drumAt = new Set<string>();
	for (const belt of all) {
		for (const { seg, rails, legs } of belt.segments) {
			const at = frame(seg.a, seg.angle);
			for (const u of legs) legsAt(at, u, seg.angle);
			for (const { side, spans } of rails) {
				for (const sp of spans) {
					const u = (sp.u0 + sp.u1) / 2;
					const len = sp.u1 - sp.u0;
					const v = side * (BELT_HW + SIDE / 2);
					out.beams.push({
						p: at(u, BELT_Y - 0.04, v),
						r: [0, seg.angle, 0],
						s: [len, 1, 1],
					});
					out.caps.push({
						p: at(u, BELT_Y + 0.07, v),
						r: [0, seg.angle, 0],
						s: [len, 1, 1],
					});
				}
			}
		}
		for (const c of belt.corners) {
			const at = frame(c.at, c.angle);
			out.plates.push({ p: at(0, BELT_Y - 0.02, 0), r: [0, c.angle, 0] });
			legsAt(at, 0, c.angle);
			if (c.backRail) {
				// A beam across the upstream edge, turned 90 degrees.
				out.beams.push({
					p: at(-BELT_HW - SIDE / 2, BELT_Y - 0.04, 0),
					r: [0, c.angle + Math.PI / 2, 0],
					s: [BELT_HW * 2 + SIDE * 2, 1, 1],
				});
			}
		}
		for (const e of belt.ends) {
			// Belts butt end to end at every cell; one roller serves both.
			const key = `${e.at[0].toFixed(2)},${e.at[1].toFixed(2)}`;
			if (drumAt.has(key)) continue;
			drumAt.add(key);
			out.drums.push({
				p: [e.at[0], BELT_Y - 0.06, e.at[1]],
				r: [Math.PI / 2, e.angle, 0],
			});
		}
	}
	return out;
}

function BeltFrames() {
	const set = useMemo(
		() => staticPieces(CONVEYORS.map((c) => beltParts(c, CONVEYORS))),
		[],
	);
	return (
		<group>
			<Static g={G.box(0.05, LEG_H, 0.05)} m={MAT.frame} items={set.legs} />
			<Static g={G.box(0.12, 0.02, 0.12)} m={MAT.steelDark} items={set.feet} />
			<Static
				g={G.box(0.04, 0.04, BELT_HW * 2)}
				m={MAT.frame}
				items={set.cross}
			/>
			<Static g={G.box(1, 0.2, SIDE)} m={MAT.rail} items={set.beams} />
			<Static
				g={G.box(1, 0.025, SIDE + 0.02)}
				m={MAT.chrome}
				items={set.caps}
			/>
			<Static
				g={G.box(BELT_HW * 2, 0.04, BELT_HW * 2)}
				m={MAT.rubber}
				items={set.plates}
			/>
			<Static
				g={G.cyl(0.06, 0.06, BELT_HW * 2 + 0.1, 24)}
				m={MAT.steel}
				items={set.drums}
			/>
		</group>
	);
}

/** The moving belt surface of one straight run; its cleats scroll while active. */
function BeltSurface({
	seg,
	plate,
	active,
}: {
	seg: Segment;
	plate: Span;
	active: boolean;
}) {
	const len = plate.u1 - plate.u0;
	const mat = useMemo(() => {
		const map = beltTexture().clone();
		map.repeat.set(len / CLEAT, 1);
		return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
	}, [len]);
	useFrame((_, dt) => {
		if (active && mat.map) mat.map.offset.x -= (dt * BELT_SPEED) / CLEAT;
	});
	return (
		<group position={[seg.a[0], 0, seg.a[1]]} rotation={[0, seg.angle, 0]}>
			<mesh
				position={[(plate.u0 + plate.u1) / 2, BELT_Y - 0.02, 0]}
				material={mat}
				geometry={G.box(1, 0.04, BELT_HW * 2 - 0.02)}
				scale={[len, 1, 1]}
				receiveShadow
			/>
		</group>
	);
}

/** Shape of one part riding a belt. */
function ItemShape({ item }: { item: Item }) {
	const m = itemMaterial(item);
	switch (item) {
		case "alu_billet":
		case "steel_blank":
			return (
				<M
					g={G.cyl(0.09, 0.09, 0.26, 24)}
					m={m}
					p={[0, 0.09, 0]}
					r={[0, 0, Math.PI / 2]}
					shadow={false}
				/>
			);
		case "copper_wire":
			return (
				<group position={[0, 0.1, 0]}>
					<M g={G.cyl(0.1, 0.1, 0.16, 24)} m={m} shadow={false} />
					<M
						g={G.cyl(0.12, 0.12, 0.02, 24)}
						m={MAT.frame}
						p={[0, 0.08, 0]}
						shadow={false}
					/>
				</group>
			);
		case "bearing":
			return (
				<M
					g={G.torus(0.08, 0.035, 12, 32)}
					m={m}
					p={[0, 0.04, 0]}
					r={[Math.PI / 2, 0, 0]}
					shadow={false}
				/>
			);
		case "gear_set":
			return (
				<M g={G.gear(0.11, 14, 0.07)} m={m} p={[0, 0.05, 0]} shadow={false} />
			);
		case "stator":
			return (
				<group position={[0, 0.08, 0]}>
					<M g={G.gear(0.12, 12, 0.12)} m={MAT.steelDark} shadow={false} />
					<M
						g={G.torus(0.085, 0.03, 10, 32)}
						m={m}
						r={[Math.PI / 2, 0, 0]}
						shadow={false}
					/>
				</group>
			);
		case "motor":
			return (
				<M
					g={G.cyl(0.09, 0.09, 0.2, 32)}
					m={m}
					p={[0, 0.1, 0]}
					shadow={false}
				/>
			);
		case "pcb_blank":
		case "driver_board":
			return (
				<M g={G.box(0.26, 0.03, 0.2)} m={m} p={[0, 0.02, 0]} shadow={false} />
			);
		case "encoder_ic":
		case "magnets":
		case "laminations":
			return (
				<M
					g={G.rbox(0.18, 0.08, 0.18, 0.02, 2)}
					m={m}
					p={[0, 0.04, 0]}
					shadow={false}
				/>
			);
		case "finished_good":
			return (
				<M
					g={G.rbox(0.26, 0.22, 0.26, 0.02, 2)}
					m={MAT.cardboard}
					p={[0, 0.11, 0]}
					shadow={false}
				/>
			);
		default:
			return (
				<M
					g={G.rbox(0.22, 0.18, 0.22, 0.04, 2)}
					m={m}
					p={[0, 0.09, 0]}
					shadow={false}
				/>
			);
	}
}

/** Position and heading at distance `d` along the path. */
function poseAt(segs: Segment[], d: number): [number, number, number] {
	let left = d;
	for (const s of segs) {
		if (left <= s.len)
			return [s.a[0] + s.dir[0] * left, s.a[1] + s.dir[1] * left, s.angle];
		left -= s.len;
	}
	const s = segs[segs.length - 1];
	return [s.b[0], s.b[1], s.angle];
}

function Belt({ conveyor, active }: { conveyor: Conveyor; active: boolean }) {
	const parts = useMemo(() => beltParts(conveyor, CONVEYORS), [conveyor]);
	const segs = useMemo(() => segmentsOf(conveyor.points), [conveyor]);
	const total = pathLength(segs);
	const count = Math.max(1, Math.floor(total / PART_SPACING));
	const riders = useRef<(THREE.Group | null)[]>([]);
	const offset = useRef(0);

	useFrame((_, dt) => {
		if (active) offset.current = (offset.current + dt * BELT_SPEED) % total;
		riders.current.forEach((g, i) => {
			if (!g) return;
			const [x, z, angle] = poseAt(
				segs,
				(offset.current + i * PART_SPACING) % total,
			);
			g.position.set(x, BELT_Y, z);
			g.rotation.y = angle;
			g.visible = active;
		});
	});

	return (
		<group>
			{parts.segments.map((p) => (
				<BeltSurface
					key={`${p.seg.a[0]},${p.seg.a[1]}`}
					seg={p.seg}
					plate={p.plate}
					active={active}
				/>
			))}
			{Array.from({ length: count }, (_, i) => (
				<group
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-size pool of belt slots
					key={i}
					ref={(g) => {
						riders.current[i] = g;
					}}
				>
					<ItemShape item={conveyor.items[i % conveyor.items.length]} />
				</group>
			))}
		</group>
	);
}

export function Conveyors({ isBusy }: { isBusy: (c: Conveyor) => boolean }) {
	return (
		<group>
			<BeltFrames />
			{CONVEYORS.map((c) => (
				<Belt key={c.id} conveyor={c} active={isBusy(c)} />
			))}
		</group>
	);
}
