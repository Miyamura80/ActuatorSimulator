// Assembly and test: the six-axis robot cell and the end-of-line tester.
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { BEACON, type BeaconState } from "../palette";
import { G, M, MAT, Plinth, useSpin } from "./kit";

/** Six-axis arm on a pedestal, loading a fixture. `product` is what's on it. */
export function RobotCell({
	busy,
	product,
}: {
	busy: boolean;
	product: "motor" | "actuator";
}) {
	const turret = useRef<THREE.Group>(null);
	const shoulder = useRef<THREE.Group>(null);
	const elbow = useRef<THREE.Group>(null);
	const wrist = useRef<THREE.Group>(null);
	useFrame(({ clock }) => {
		if (
			!turret.current ||
			!shoulder.current ||
			!elbow.current ||
			!wrist.current
		)
			return;
		const t = busy ? clock.elapsedTime : 0;
		const k = busy ? 1 : 0;
		turret.current.rotation.y = -0.6 + Math.sin(t * 1.1) * 0.9 * k;
		shoulder.current.rotation.z = -0.35 + Math.sin(t * 2.2) * 0.18 * k;
		elbow.current.rotation.z = -1.1 + Math.sin(t * 2.2 + 0.8) * 0.3 * k;
		wrist.current.rotation.z = -0.4 + Math.sin(t * 4.4) * 0.3 * k;
	});
	const joint = G.cyl(0.1, 0.1, 0.26, 32);
	return (
		<group>
			<Plinth />
			{/* Pedestal. */}
			<M
				g={G.cyl(0.24, 0.3, 0.3, 40)}
				m={MAT.steelDark}
				p={[-0.38, 0.35, -0.3]}
			/>
			<group ref={turret} position={[-0.38, 0.5, -0.3]}>
				<M g={G.cyl(0.22, 0.24, 0.14, 40)} m={MAT.accent} p={[0, 0.07, 0]} />
				<M g={G.rbox(0.3, 0.26, 0.28, 0.06)} m={MAT.accent} p={[0, 0.26, 0]} />
				<group ref={shoulder} position={[0, 0.32, 0]}>
					<M g={joint} m={MAT.steelDark} r={[Math.PI / 2, 0, 0]} />
					<M
						g={G.rbox(0.16, 0.62, 0.18, 0.06)}
						m={MAT.accent}
						p={[0, 0.3, 0]}
					/>
					<group ref={elbow} position={[0, 0.6, 0]}>
						<M g={joint} m={MAT.steelDark} r={[Math.PI / 2, 0, 0]} />
						<M
							g={G.rbox(0.5, 0.13, 0.14, 0.05)}
							m={MAT.accent}
							p={[0.25, 0, 0]}
						/>
						<M
							g={G.cyl(0.07, 0.07, 0.16, 24)}
							m={MAT.steelDark}
							p={[-0.1, 0, 0]}
							r={[Math.PI / 2, 0, 0]}
						/>
						<group ref={wrist} position={[0.52, 0, 0]}>
							<M
								g={G.cyl(0.06, 0.06, 0.16, 24)}
								m={MAT.steel}
								r={[Math.PI / 2, 0, 0]}
							/>
							<M
								g={G.cyl(0.05, 0.05, 0.1, 24)}
								m={MAT.chrome}
								p={[0.07, 0, 0]}
								r={[0, 0, Math.PI / 2]}
							/>
							{/* Two-finger gripper. */}
							<M
								g={G.box(0.03, 0.14, 0.12)}
								m={MAT.steelDark}
								p={[0.13, 0, 0]}
							/>
							<M
								g={G.box(0.08, 0.03, 0.03)}
								m={MAT.chrome}
								p={[0.18, 0.05, 0]}
							/>
							<M
								g={G.box(0.08, 0.03, 0.03)}
								m={MAT.chrome}
								p={[0.18, -0.05, 0]}
							/>
						</group>
					</group>
				</group>
			</group>
			{/* Cable dress along the arm base. */}
			<M
				g={G.torus(0.16, 0.025, 10, 32)}
				m={MAT.rubber}
				p={[-0.38, 0.62, -0.3]}
				r={[Math.PI / 2, 0, 0]}
			/>
			{/* Fixture table with the part being built. */}
			<M g={G.rbox(0.7, 0.08, 0.6, 0.02)} m={MAT.steel} p={[0.35, 0.72, 0.3]} />
			{(
				[
					[0.05, 0.05],
					[0.65, 0.05],
					[0.05, 0.55],
					[0.65, 0.55],
				] as const
			).map(([x, z]) => (
				<M
					key={`${x},${z}`}
					g={G.box(0.05, 0.52, 0.05)}
					m={MAT.frame}
					p={[x, 0.44, z]}
				/>
			))}
			<M g={G.box(0.3, 0.06, 0.3)} m={MAT.steelDark} p={[0.35, 0.79, 0.3]} />
			{product === "motor" ? (
				<group position={[0.35, 0.94, 0.3]}>
					<M g={G.cyl(0.11, 0.11, 0.24, 40)} m={MAT.motor} />
					<M g={G.cyl(0.03, 0.03, 0.1, 16)} m={MAT.chrome} p={[0, 0.16, 0]} />
				</group>
			) : (
				<group position={[0.35, 0.92, 0.3]}>
					<M g={G.rbox(0.2, 0.2, 0.2, 0.04)} m={MAT.accent} />
					<M g={G.cyl(0.08, 0.08, 0.06, 32)} m={MAT.chrome} p={[0, 0.13, 0]} />
				</group>
			)}
			{/* Light-curtain posts guarding the front. */}
			{[-0.72, 0.72].map((x) => (
				<M
					key={x}
					g={G.rbox(0.06, 1.2, 0.06, 0.015)}
					m={MAT.accent}
					p={[x, 0.8, 0.7]}
				/>
			))}
			{/* Parts tote. */}
			<M
				g={G.rbox(0.34, 0.16, 0.26, 0.02)}
				m={MAT.tote}
				p={[0.45, 0.3, -0.45]}
			/>
		</group>
	);
}

let wave: THREE.CanvasTexture | null = null;

/** Oscilloscope-style trace for the tester's monitor. */
function waveTexture() {
	if (wave) return wave;
	const c = document.createElement("canvas");
	c.width = 256;
	c.height = 128;
	const g = c.getContext("2d");
	if (g) {
		g.fillStyle = "#07140d";
		g.fillRect(0, 0, 256, 128);
		g.strokeStyle = "#16402a";
		for (let x = 0; x <= 256; x += 32) g.strokeRect(x, 0, 0, 128);
		for (let y = 0; y <= 128; y += 32) g.strokeRect(0, y, 256, 0);
		g.strokeStyle = "#5dfca0";
		g.lineWidth = 3;
		g.beginPath();
		for (let x = 0; x <= 256; x++) {
			const y = 64 + Math.sin((x / 256) * Math.PI * 4) * 34;
			if (x === 0) g.moveTo(x, y);
			else g.lineTo(x, y);
		}
		g.stroke();
	}
	wave = new THREE.CanvasTexture(c);
	wave.wrapS = THREE.RepeatWrapping;
	wave.colorSpace = THREE.SRGBColorSpace;
	return wave;
}

/** End-of-line tester: fixture spinning the unit, rack, and a live trace. */
export function TestBench({
	busy,
	beacon,
}: {
	busy: boolean;
	beacon: BeaconState;
}) {
	const dut = useSpin(busy, 4);
	const screen = useRef<THREE.MeshBasicMaterial>(null);
	// The trace texture is shared by every tester, so derive its scroll from
	// the clock rather than adding per-screen deltas.
	useFrame(({ clock }) => {
		if (busy && screen.current?.map)
			screen.current.map.offset.x = clock.elapsedTime * 0.25;
	});
	const failed = beacon === "broken";
	return (
		<group>
			<Plinth />
			{/* Rack cabinet with status LEDs. */}
			<M
				g={G.rbox(0.5, 1.35, 0.6, 0.03)}
				m={MAT.frame}
				p={[-0.48, 0.88, -0.35]}
			/>
			{[0.5, 0.7, 0.9, 1.1, 1.3].map((y) => (
				<group key={y}>
					<M
						g={G.box(0.42, 0.14, 0.02)}
						m={MAT.steelDark}
						p={[-0.48, y, -0.04]}
					/>
					<M
						g={G.box(0.03, 0.03, 0.01)}
						m={busy ? MAT.ledOn : MAT.screenOff}
						p={[-0.34, y, -0.025]}
					/>
				</group>
			))}
			{/* Bench with the unit under test on a torque fixture. */}
			<M g={G.rbox(1.0, 0.07, 0.8, 0.02)} m={MAT.steel} p={[0.25, 0.8, 0.2]} />
			{(
				[
					[-0.2, -0.15],
					[0.7, -0.15],
					[-0.2, 0.55],
					[0.7, 0.55],
				] as const
			).map(([x, z]) => (
				<M
					key={`${x},${z}`}
					g={G.box(0.05, 0.6, 0.05)}
					m={MAT.frame}
					p={[x, 0.48, z]}
				/>
			))}
			<M
				g={G.rbox(0.3, 0.1, 0.24, 0.02)}
				m={MAT.steelDark}
				p={[0.2, 0.89, 0.35]}
			/>
			<group ref={dut} position={[0.2, 1.04, 0.35]}>
				<M g={G.rbox(0.18, 0.18, 0.18, 0.04)} m={MAT.accent} />
				<M g={G.cyl(0.07, 0.07, 0.05, 32)} m={MAT.chrome} p={[0, 0.11, 0]} />
				<M g={G.box(0.2, 0.02, 0.03)} m={MAT.steelDark} p={[0, 0.14, 0]} />
			</group>
			{/* Monitor on a stand. */}
			<M
				g={G.cyl(0.03, 0.03, 0.3, 16)}
				m={MAT.steelDark}
				p={[0.45, 0.98, -0.05]}
			/>
			<M
				g={G.rbox(0.62, 0.4, 0.05, 0.02)}
				m={MAT.frame}
				p={[0.45, 1.3, -0.05]}
			/>
			<mesh position={[0.45, 1.3, -0.02]}>
				<planeGeometry args={[0.56, 0.34]} />
				{busy ? (
					<meshBasicMaterial
						ref={screen}
						map={waveTexture()}
						toneMapped={false}
					/>
				) : (
					<meshStandardMaterial
						color={failed ? "#2a0c0c" : "#0e1418"}
						emissive={failed ? BEACON.broken : "#000000"}
						emissiveIntensity={failed ? 0.8 : 0}
					/>
				)}
			</mesh>
			{/* Keyboard. */}
			<M
				g={G.rbox(0.36, 0.02, 0.12, 0.01)}
				m={MAT.chip}
				p={[0.6, 0.845, 0.35]}
			/>
		</group>
	);
}

const LENSES: BeaconState[] = ["broken", "starved", "running", "maintenance"];

/** Four-tier stack light. The tier for the current state lights; alarms flash. */
export function Beacon({ state }: { state: BeaconState }) {
	const lit = useRef<THREE.MeshStandardMaterial>(null);
	const flashing = state === "alarm" || state === "broken";
	useFrame(({ clock }) => {
		if (!lit.current) return;
		const on = !flashing || Math.sin(clock.elapsedTime * 8) > 0;
		lit.current.emissiveIntensity = on ? 2.4 : 0.15;
	});
	// Alarm and degraded share the amber and red lenses.
	const tier: BeaconState =
		state === "alarm" ? "starved" : state === "degraded" ? "broken" : state;
	return (
		<group>
			<M g={G.cyl(0.035, 0.035, 1.2, 16)} m={MAT.steelDark} p={[0, 0.6, 0]} />
			<M g={G.cyl(0.08, 0.1, 0.06, 24)} m={MAT.steelDark} p={[0, 0.03, 0]} />
			{LENSES.map((lens, i) => {
				const y = 1.68 - i * 0.14;
				const color =
					state === "alarm" && lens === "starved" ? BEACON.alarm : BEACON[lens];
				return (
					<mesh key={lens} position={[0, y, 0]}>
						<cylinderGeometry args={[0.075, 0.075, 0.13, 32]} />
						{lens === tier ? (
							<meshStandardMaterial
								ref={lit}
								color={color}
								emissive={color}
								emissiveIntensity={2.4}
								toneMapped={false}
							/>
						) : (
							<meshStandardMaterial
								color={color}
								roughness={0.3}
								transparent
								opacity={0.45}
							/>
						)}
					</mesh>
				);
			})}
			<M g={G.cyl(0.08, 0.08, 0.04, 32)} m={MAT.steelDark} p={[0, 1.17, 0]} />
			<M g={G.cyl(0.06, 0.08, 0.04, 32)} m={MAT.steelDark} p={[0, 1.77, 0]} />
		</group>
	);
}
