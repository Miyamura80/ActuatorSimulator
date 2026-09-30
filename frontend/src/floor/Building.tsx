// The building shell and set dressing: concrete slab, painted markings,
// back wall with columns and clerestory windows, storage racks, a forklift.
import { useMemo } from "react";
import * as THREE from "three";
import { TAPE } from "./Docks";
import { CELL_HALF_D, CELL_HALF_W, PLANT_BOUNDS, STATION_POS } from "./layout";
import { G, M, MAT, Static, tinted, type Xform } from "./models/kit";

const [MIN_X, MAX_X, MIN_Z, MAX_Z] = PLANT_BOUNDS;
const WALL_Z = MIN_Z;
const WALL_H = 4.2;

/** Concrete: mottled noise with saw-cut joints; tiles every 4 world units. */
function concreteTexture() {
	const size = 256;
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const g = c.getContext("2d");
	if (g) {
		g.fillStyle = "#6b7178";
		g.fillRect(0, 0, size, size);
		// Deterministic speckle so every load looks the same.
		let s = 7;
		const rnd = () => {
			s = (s * 16807) % 2147483647;
			return s / 2147483647;
		};
		for (let i = 0; i < 2600; i++) {
			const v = 90 + Math.floor(rnd() * 40);
			g.fillStyle = `rgba(${v},${v + 4},${v + 8},0.35)`;
			const r = 1 + rnd() * 3;
			g.fillRect(rnd() * size, rnd() * size, r, r);
		}
		g.fillStyle = "rgba(30,33,36,0.8)";
		g.fillRect(0, 0, size, 2);
		g.fillRect(0, 0, 2, size);
	}
	const t = new THREE.CanvasTexture(c);
	t.wrapS = THREE.RepeatWrapping;
	t.wrapT = THREE.RepeatWrapping;
	t.colorSpace = THREE.SRGBColorSpace;
	t.anisotropy = 8;
	return t;
}

function Slab() {
	const w = MAX_X - MIN_X + 100;
	const d = MAX_Z - MIN_Z + 80;
	const mat = useMemo(() => {
		const map = concreteTexture();
		map.repeat.set(w / 4, d / 4);
		return new THREE.MeshStandardMaterial({
			map,
			color: "#8a9199",
			roughness: 0.92,
			metalness: 0,
		});
	}, [w, d]);
	return (
		<mesh
			rotation={[-Math.PI / 2, 0, 0]}
			position={[(MIN_X + MAX_X) / 2, 0, (MIN_Z + MAX_Z) / 2]}
			material={mat}
			receiveShadow
		>
			<planeGeometry args={[w, d]} />
		</mesh>
	);
}

const LINE = 0.08;

/** A painted rectangle outline on the floor. */
function FloorBox({
	x,
	z,
	w,
	d,
}: {
	x: number;
	z: number;
	w: number;
	d: number;
}) {
	const y = 0.006;
	return (
		<group position={[x, y, z]}>
			<M
				g={G.box(w, 0.004, LINE)}
				m={MAT.accent}
				p={[0, 0, -d / 2]}
				shadow={false}
			/>
			<M
				g={G.box(w, 0.004, LINE)}
				m={MAT.accent}
				p={[0, 0, d / 2]}
				shadow={false}
			/>
			<M
				g={G.box(LINE, 0.004, d)}
				m={MAT.accent}
				p={[-w / 2, 0, 0]}
				shadow={false}
			/>
			<M
				g={G.box(LINE, 0.004, d)}
				m={MAT.accent}
				p={[w / 2, 0, 0]}
				shadow={false}
			/>
		</group>
	);
}

function Markings() {
	const aisleZ = MAX_Z + 1.3;
	return (
		<group>
			{Object.values(STATION_POS).map(([x, z]) => (
				<FloorBox
					key={`${x},${z}`}
					x={x}
					z={z}
					w={CELL_HALF_W * 2 + 0.5}
					d={CELL_HALF_D * 2 + 0.5}
				/>
			))}
			{/* Forklift aisle along the front, with a zebra crossing. */}
			{[aisleZ - 1.2, aisleZ + 1.2].map((z) => (
				<M
					key={z}
					g={G.box(MAX_X - MIN_X, 0.004, 0.1)}
					m={MAT.accent}
					p={[(MIN_X + MAX_X) / 2, 0.006, z]}
					shadow={false}
				/>
			))}
			{Array.from({ length: 6 }, (_, i) => (
				<M
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					key={i}
					g={G.box(0.3, 0.004, 2.2)}
					m={MAT.paintWhite}
					p={[-0.5 + i * 0.6, 0.006, aisleZ]}
					shadow={false}
				/>
			))}
		</group>
	);
}

function BackWall() {
	const len = MAX_X - MIN_X + 4;
	const cx = (MIN_X + MAX_X) / 2;
	const columns = Array.from(
		{ length: Math.floor(len / 6) + 1 },
		(_, i) => MIN_X - 2 + i * 6,
	);
	return (
		<group>
			<M
				g={G.box(len, WALL_H, 0.3)}
				m={MAT.wall}
				p={[cx, WALL_H / 2, WALL_Z - 0.3]}
			/>
			{/* Painted dado band and a clerestory window strip. */}
			<M
				g={G.box(len, 1.1, 0.02)}
				m={tinted("#3d4852")}
				p={[cx, 0.55, WALL_Z - 0.14]}
				shadow={false}
			/>
			<M
				g={G.box(len, 0.9, 0.02)}
				m={MAT.window}
				p={[cx, 3.3, WALL_Z - 0.14]}
				shadow={false}
			/>
			{columns.map((x) => (
				<group key={x} position={[x, 0, WALL_Z]}>
					{/* I-beam column: two flanges and a web. */}
					<M
						g={G.box(0.36, WALL_H + 0.4, 0.05)}
						m={MAT.column}
						p={[0, (WALL_H + 0.4) / 2, 0.02]}
					/>
					<M
						g={G.box(0.36, WALL_H + 0.4, 0.05)}
						m={MAT.column}
						p={[0, (WALL_H + 0.4) / 2, 0.34]}
					/>
					<M
						g={G.box(0.05, WALL_H + 0.4, 0.3)}
						m={MAT.column}
						p={[0, (WALL_H + 0.4) / 2, 0.18]}
					/>
					<M g={G.box(0.6, 0.06, 0.6)} m={MAT.steelDark} p={[0, 0.03, 0.18]} />
				</group>
			))}
		</group>
	);
}

/** Pallet racking: blue uprights, orange beams, most bays stocked. */
function Racks({ racks }: { racks: { x: number; z: number; bays: number }[] }) {
	const set = useMemo(() => {
		const bay = 2.4;
		const levels = [0.05, 1.3, 2.55];
		const out: Record<
			"up" | "beam" | "deck" | "runner" | "box" | "tape",
			Xform[]
		> = {
			up: [],
			beam: [],
			deck: [],
			runner: [],
			box: [],
			tape: [],
		};
		for (const { x, z, bays } of racks) {
			for (let i = 0; i <= bays; i++)
				for (const dz of [-0.5, 0.5])
					out.up.push({ p: [x + i * bay, 1.7, z + dz] });
			for (let b = 0; b < bays; b++)
				levels.forEach((y, l) => {
					const cx = x + b * bay + bay / 2;
					if (l > 0)
						for (const dz of [-0.5, 0.5]) out.beam.push({ p: [cx, y, z + dz] });
					if ((b + l) % 3 === 2) return;
					for (const px of [-0.5, 0.5]) {
						const n = 3 + ((b * 7 + l * 5 + (px > 0 ? 3 : 0)) % 6);
						out.deck.push({ p: [cx + px, y + 0.18, z] });
						for (const rz of [-0.3, 0, 0.3])
							out.runner.push({ p: [cx + px, y + 0.11, z + rz] });
						for (let k = 0; k < n; k++) {
							const bx = cx + px + ((k % 4) % 2) * 0.36 - 0.18;
							const bz = z + Math.floor((k % 4) / 2) * 0.36 - 0.18;
							const by = y + 0.36 + Math.floor(k / 4) * 0.3;
							out.box.push({ p: [bx, by, bz] });
							out.tape.push({ p: [bx, by + 0.142, bz] });
						}
					}
				});
		}
		return out;
	}, [racks]);
	return (
		<group>
			<Static g={G.box(0.08, 3.4, 0.08)} m={MAT.rackBlue} items={set.up} />
			<Static g={G.box(2.4, 0.12, 0.06)} m={MAT.rackOrange} items={set.beam} />
			<Static g={G.box(0.8, 0.03, 0.8)} m={MAT.wood} items={set.deck} />
			<Static g={G.box(0.8, 0.1, 0.1)} m={MAT.wood} items={set.runner} />
			<Static g={G.box(0.34, 0.28, 0.34)} m={MAT.cardboard} items={set.box} />
			<Static g={TAPE} m={MAT.tape} items={set.tape} />
		</group>
	);
}

const RACKS = [
	{ x: 8, z: -10.3, bays: 6 },
	{ x: 8, z: -6.4, bays: 6 },
	{ x: 8, z: 6.4, bays: 6 },
];

function Forklift({ x, z, angle }: { x: number; z: number; angle: number }) {
	const wheel = G.cyl(0.2, 0.2, 0.16, 24);
	return (
		<group position={[x, 0, z]} rotation={[0, angle, 0]}>
			<M g={G.rbox(1.3, 0.6, 0.9, 0.08)} m={MAT.accent} p={[0, 0.5, 0]} />
			<M g={G.rbox(0.5, 0.35, 0.86, 0.06)} m={MAT.frame} p={[-0.45, 0.95, 0]} />
			{/* Overhead guard. */}
			{[
				[0.3, 0.38],
				[0.3, -0.38],
				[-0.35, 0.38],
				[-0.35, -0.38],
			].map(([px, pz]) => (
				<M
					key={`${px},${pz}`}
					g={G.box(0.05, 1.1, 0.05)}
					m={MAT.frame}
					p={[px, 1.35, pz]}
				/>
			))}
			<M g={G.box(0.75, 0.05, 0.85)} m={MAT.frame} p={[-0.02, 1.9, 0]} />
			<M g={G.rbox(0.3, 0.3, 0.3, 0.05)} m={MAT.rubber} p={[-0.1, 1.0, 0]} />
			{/* Mast and forks. */}
			<M g={G.box(0.08, 2.0, 0.7)} m={MAT.steelDark} p={[0.72, 1.1, 0]} />
			{[-0.22, 0.22].map((fz) => (
				<M
					key={fz}
					g={G.box(0.9, 0.04, 0.1)}
					m={MAT.steelDark}
					p={[1.2, 0.12, fz]}
				/>
			))}
			{[
				[0.45, 0.46],
				[0.45, -0.46],
				[-0.4, 0.46],
				[-0.4, -0.46],
			].map(([wx, wz]) => (
				<group
					key={`${wx},${wz}`}
					position={[wx, 0.2, wz]}
					rotation={[Math.PI / 2, 0, 0]}
				>
					<M g={wheel} m={MAT.tire} />
				</group>
			))}
		</group>
	);
}

export function Building() {
	return (
		<group>
			<Slab />
			<Markings />
			<BackWall />
			<Racks racks={RACKS} />
			<Forklift x={11} z={-8.35} angle={0.2} />
			<Forklift x={21} z={9.3} angle={Math.PI + 0.3} />
		</group>
	);
}
