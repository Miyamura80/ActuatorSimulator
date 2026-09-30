// Loading docks, the trucks backed onto them, and pallets of boxes.
import { useMemo } from "react";
import type { Vec2 } from "./layout";
import { G, M, MAT, Static, type Xform } from "./models/kit";

/** Packing tape across the top of a box. */
export const TAPE = G.box(0.07, 0.006, 0.345);
const BOX = G.box(0.34, 0.28, 0.34);
const RUNNER = G.box(0.8, 0.1, 0.1);
const SLAT = G.box(0.1, 0.03, 0.8);

/** A pallet with boxes on it; roughly how full a buffer is (log scale). */
export function CrateStack({ pos, qty }: { pos: Vec2; qty: number }) {
	const n = qty <= 0 ? 0 : Math.min(12, Math.ceil(Math.log2(qty + 1) * 1.6));
	// Each shape is one instanced draw; only rebuilt when the box count changes.
	const set = useMemo(() => {
		const box: Xform[] = [];
		const tape: Xform[] = [];
		for (let i = 0; i < n; i++) {
			const slot = i % 4;
			const x = (slot % 2) * 0.36 - 0.18;
			const z = Math.floor(slot / 2) * 0.36 - 0.18;
			const y = 0.3 + Math.floor(i / 4) * 0.3;
			box.push({ p: [x, y, z] });
			tape.push({ p: [x, y + 0.142, z] });
		}
		return { box, tape };
	}, [n]);
	return (
		<group position={[pos[0], 0, pos[1]]}>
			<Static g={RUNNER} m={MAT.wood} items={PALLET.runners} />
			<Static g={SLAT} m={MAT.wood} items={PALLET.slats} />
			<Static g={BOX} m={MAT.cardboard} items={set.box} />
			<Static g={TAPE} m={MAT.tape} items={set.tape} shadow={false} />
		</group>
	);
}

const PALLET: { runners: Xform[]; slats: Xform[] } = {
	runners: [-0.3, 0, 0.3].map((z) => ({ p: [0, 0.05, z] })),
	slats: [-0.33, -0.2, -0.07, 0.07, 0.2, 0.33].map((x) => ({
		p: [x, 0.12, 0],
	})),
};

/** Box truck; the cargo doors face +x. */
function Truck() {
	const wheel = G.cyl(0.36, 0.36, 0.28, 32);
	const hub = G.cyl(0.18, 0.18, 0.3, 24);
	return (
		<group>
			{/* Chassis and cargo box. */}
			<M g={G.box(5.6, 0.25, 1.6)} m={MAT.frame} p={[-0.3, 0.55, 0]} />
			<M g={G.rbox(4.2, 2.3, 2.2, 0.06)} m={MAT.paint} p={[0.4, 1.85, 0]} />
			<M g={G.box(4.22, 0.2, 2.22)} m={MAT.accent} p={[0.4, 1.0, 0]} />
			{/* Rear doors with hinges and a bumper. */}
			<M g={G.box(0.04, 2.1, 2.0)} m={MAT.steel} p={[2.52, 1.85, 0]} />
			<M g={G.box(0.05, 2.1, 0.03)} m={MAT.steelDark} p={[2.54, 1.85, 0]} />
			<M g={G.box(0.1, 0.12, 2.1)} m={MAT.steelDark} p={[2.5, 0.55, 0]} />
			{/* Cab with windscreen, grille and lights. */}
			<group position={[-2.35, 0, 0]}>
				<M g={G.rbox(1.5, 1.8, 2.1, 0.12)} m={MAT.truckCab} p={[0, 1.45, 0]} />
				<M
					g={G.rbox(0.05, 0.6, 1.8, 0.02)}
					m={MAT.glass}
					p={[-0.76, 1.85, 0]}
				/>
				<M g={G.box(0.05, 0.4, 1.4)} m={MAT.steelDark} p={[-0.76, 0.95, 0]} />
				{[-0.8, 0.8].map((z) => (
					<M
						key={z}
						g={G.rbox(0.05, 0.14, 0.26, 0.02)}
						m={MAT.lamp}
						p={[-0.77, 0.95, z]}
					/>
				))}
				<M g={G.box(0.6, 0.45, 0.04)} m={MAT.glass} p={[0.1, 1.9, 1.06]} />
				<M g={G.box(0.6, 0.45, 0.04)} m={MAT.glass} p={[0.1, 1.9, -1.06]} />
			</group>
			{/* Wheels. */}
			{[-2.3, 0.9, 1.7].flatMap((x) =>
				[-0.9, 0.9].map((z) => (
					<group
						key={`${x},${z}`}
						position={[x, 0.36, z]}
						rotation={[Math.PI / 2, 0, 0]}
					>
						<M g={wheel} m={MAT.tire} />
						<M g={hub} m={MAT.steel} />
					</group>
				)),
			)}
		</group>
	);
}

/** A raised concrete dock with a leveler, bumpers, and a truck backed in. */
export function Dock({
	pos,
	halfDepth,
	facing,
}: {
	pos: Vec2;
	halfDepth: number;
	/** +1: the truck is on the -x side (receiving); -1: on +x (shipping). */
	facing: 1 | -1;
}) {
	const depth = halfDepth * 2;
	const edge = -facing * 2;
	return (
		<group position={[pos[0], 0, pos[1]]}>
			<M g={G.rbox(4, 0.3, depth, 0.04)} m={MAT.concrete} p={[0, 0.15, 0]} />
			{/* Yellow edge strip where forklifts must stop. */}
			<M
				g={G.box(0.12, 0.012, depth - 0.2)}
				m={MAT.accent}
				p={[edge + facing * 0.2, 0.306, 0]}
			/>
			{/* Leveler plate and rubber bumpers at the truck bay. */}
			<M
				g={G.box(0.7, 0.04, 2.0)}
				m={MAT.steel}
				p={[edge - facing * 0.3, 0.33, 0]}
			/>
			{[-1.25, 1.25].map((z) => (
				<M
					key={z}
					g={G.rbox(0.14, 0.3, 0.3, 0.03)}
					m={MAT.rubber}
					p={[edge - facing * 0.05, 0.2, z]}
				/>
			))}
			<group
				position={[edge - facing * 3.3, 0, 0]}
				rotation={[0, facing === 1 ? 0 : Math.PI, 0]}
			>
				<Truck />
			</group>
			<group position={[0, 0.3, 0]}>
				<CrateStack pos={[facing * 0.6, -2.2]} qty={200} />
				<CrateStack pos={[facing * 0.6, 2.2]} qty={20} />
				{halfDepth > 5 && (
					<>
						<CrateStack pos={[facing * 0.6, -halfDepth + 1.4]} qty={60} />
						<CrateStack pos={[facing * 0.6, halfDepth - 1.4]} qty={90} />
					</>
				)}
			</group>
		</group>
	);
}
