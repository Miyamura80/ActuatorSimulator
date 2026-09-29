// Procedural, cel-shaded machine models. One model per station kind; moving
// parts animate only while the station is busy.
import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type ReactNode, useRef } from "react";
import type * as THREE from "three";
import type { StationKind } from "../sim/types";
import { BEACON, type BeaconState, COLORS, toonGradient } from "./palette";

type V3 = [number, number, number];

interface PartProps {
	pos?: V3;
	rot?: V3;
	color: string;
	emissive?: string;
	outline?: boolean;
	children: ReactNode;
}

/** A cel-shaded mesh with an ink outline. `children` is the geometry. */
export function Part({
	pos,
	rot,
	color,
	emissive,
	outline = true,
	children,
}: PartProps) {
	return (
		<mesh position={pos} rotation={rot} castShadow receiveShadow>
			{children}
			<meshToonMaterial
				color={color}
				gradientMap={toonGradient()}
				emissive={emissive ?? "#000000"}
				emissiveIntensity={emissive ? 1.2 : 0}
			/>
			{outline && <Outlines thickness={0.035} color={COLORS.outline} />}
		</mesh>
	);
}

/** Spin a group around y (or another axis) while `active`. */
function useSpin(active: boolean, speed: number, axis: "x" | "y" | "z" = "y") {
	const ref = useRef<THREE.Group>(null);
	useFrame((_, dt) => {
		if (active && ref.current) ref.current.rotation[axis] += dt * speed;
	});
	return ref;
}

/** Bob a group up and down while `active` (spindles, pick heads). */
function useBob(active: boolean, amp: number, rate: number, base: number) {
	const ref = useRef<THREE.Group>(null);
	useFrame(({ clock }) => {
		if (!ref.current) return;
		ref.current.position.y = active
			? base + Math.sin(clock.elapsedTime * rate) * amp
			: base;
	});
	return ref;
}

function Base() {
	return (
		<Part pos={[0, 0.15, 0]} color={COLORS.steelDark}>
			<boxGeometry args={[1.5, 0.3, 1.5]} />
		</Part>
	);
}

function Mill({ busy }: { busy: boolean }) {
	const head = useBob(busy, 0.12, 6, 1.45);
	return (
		<group>
			<Base />
			<Part pos={[0, 0.6, 0.1]} color={COLORS.body}>
				<boxGeometry args={[1.3, 0.6, 1.1]} />
			</Part>
			<Part pos={[0, 1.25, -0.45]} color={COLORS.body}>
				<boxGeometry args={[0.5, 1.3, 0.3]} />
			</Part>
			<group ref={head}>
				<Part pos={[0, 0, -0.1]} color={COLORS.accent}>
					<boxGeometry args={[0.45, 0.35, 0.5]} />
				</Part>
				<Part pos={[0, -0.3, 0]} color={COLORS.steel}>
					<cylinderGeometry args={[0.06, 0.06, 0.3, 10]} />
				</Part>
			</group>
		</group>
	);
}

function GearCut({ busy }: { busy: boolean }) {
	const hob = useSpin(busy, 6, "x");
	return (
		<group>
			<Base />
			<Part pos={[0, 0.55, 0]} color={COLORS.body}>
				<boxGeometry args={[1.3, 0.5, 1.2]} />
			</Part>
			<group ref={hob} position={[0, 1.1, 0]}>
				<Part rot={[0, 0, Math.PI / 2]} color={COLORS.accent}>
					<cylinderGeometry args={[0.28, 0.28, 0.9, 12]} />
				</Part>
			</group>
			<Part pos={[0.55, 1.05, 0]} color={COLORS.body}>
				<boxGeometry args={[0.2, 0.7, 0.5]} />
			</Part>
		</group>
	);
}

function Winder({ busy }: { busy: boolean }) {
	const a = useSpin(busy, 8, "x");
	const b = useSpin(busy, 8, "x");
	return (
		<group>
			<Base />
			<Part pos={[0, 0.5, 0]} color={COLORS.body}>
				<boxGeometry args={[1.3, 0.4, 1.1]} />
			</Part>
			<group ref={a} position={[-0.35, 0.95, 0]}>
				<Part rot={[0, 0, Math.PI / 2]} color="#c46a2a">
					<cylinderGeometry args={[0.25, 0.25, 0.4, 14]} />
				</Part>
			</group>
			<group ref={b} position={[0.35, 0.95, 0]}>
				<Part rot={[0, 0, Math.PI / 2]} color="#c46a2a">
					<cylinderGeometry args={[0.25, 0.25, 0.4, 14]} />
				</Part>
			</group>
		</group>
	);
}

function Smt({ busy }: { busy: boolean }) {
	const head = useBob(busy, 0.08, 14, 0.95);
	return (
		<group>
			<Base />
			<Part pos={[0, 0.55, 0]} color={COLORS.body}>
				<boxGeometry args={[1.4, 0.5, 1.2]} />
			</Part>
			<Part pos={[0, 0.9, 0]} color={COLORS.glass} outline={false}>
				<boxGeometry args={[1.2, 0.2, 1.0]} />
			</Part>
			<group ref={head}>
				<Part pos={[0, 0.2, 0]} color={COLORS.accent}>
					<boxGeometry args={[0.35, 0.2, 0.9]} />
				</Part>
			</group>
		</group>
	);
}

function RobotCell({ busy }: { busy: boolean }) {
	const arm = useSpin(busy, 1.6, "y");
	return (
		<group>
			<Base />
			<Part pos={[0.2, 0.55, 0.2]} color={COLORS.body}>
				<boxGeometry args={[1.1, 0.5, 0.9]} />
			</Part>
			<group ref={arm} position={[-0.45, 0.3, -0.45]}>
				<Part pos={[0, 0.35, 0]} color={COLORS.steel}>
					<cylinderGeometry args={[0.18, 0.22, 0.5, 12]} />
				</Part>
				<Part pos={[0.25, 0.75, 0]} rot={[0, 0, -0.9]} color={COLORS.accent}>
					<boxGeometry args={[0.14, 0.7, 0.14]} />
				</Part>
				<Part pos={[0.6, 0.85, 0]} rot={[0, 0, 0.6]} color={COLORS.accent}>
					<boxGeometry args={[0.12, 0.5, 0.12]} />
				</Part>
			</group>
		</group>
	);
}

function TestBench({ busy, beacon }: { busy: boolean; beacon: BeaconState }) {
	const screen = busy
		? BEACON.running
		: beacon === "broken"
			? BEACON.broken
			: "#2a3a44";
	return (
		<group>
			<Base />
			<Part pos={[0, 0.9, -0.2]} color={COLORS.body}>
				<boxGeometry args={[1.2, 1.2, 0.8]} />
			</Part>
			<Part
				pos={[0, 1.05, 0.21]}
				color={screen}
				emissive={busy ? screen : undefined}
				outline={false}
			>
				<boxGeometry args={[0.8, 0.45, 0.02]} />
			</Part>
			<Part pos={[0, 0.45, 0.45]} color={COLORS.steel}>
				<boxGeometry args={[1.2, 0.1, 0.5]} />
			</Part>
		</group>
	);
}

export function MachineModel({
	kind,
	busy,
	beacon,
}: {
	kind: StationKind;
	busy: boolean;
	beacon: BeaconState;
}) {
	switch (kind) {
		case "mill":
			return <Mill busy={busy} />;
		case "gear_cut":
			return <GearCut busy={busy} />;
		case "winding":
			return <Winder busy={busy} />;
		case "smt":
			return <Smt busy={busy} />;
		case "motor_asm":
		case "final_asm":
			return <RobotCell busy={busy} />;
		case "eol_test":
			return <TestBench busy={busy} beacon={beacon} />;
	}
}

/** Stack-light beacon. Alarm and breakdown states flash. */
export function Beacon({ state, pos }: { state: BeaconState; pos: V3 }) {
	const mat = useRef<THREE.MeshToonMaterial>(null);
	const flashing = state === "alarm" || state === "broken";
	useFrame(({ clock }) => {
		if (!mat.current) return;
		const on = !flashing || Math.sin(clock.elapsedTime * 8) > 0;
		mat.current.emissiveIntensity = on && state !== "off" ? 1.6 : 0.1;
	});
	return (
		<group position={pos}>
			<Part pos={[0, 0, 0]} color={COLORS.steelDark}>
				<cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
			</Part>
			<mesh position={[0, 0.35, 0]}>
				<cylinderGeometry args={[0.14, 0.14, 0.24, 14]} />
				<meshToonMaterial
					ref={mat}
					color={BEACON[state]}
					emissive={BEACON[state]}
					gradientMap={toonGradient()}
				/>
				<Outlines thickness={0.03} color={COLORS.outline} />
			</mesh>
		</group>
	);
}
