// Electrical cells: the stator winder and the SMT pick-and-place line.
import { G, M, MAT, Plinth, tinted, useMotion, useSpin } from "./kit";

const REEL_COLORS = ["#2b2f35", "#e6e9ec", "#3a6fd1", "#2b2f35", "#d8453b"];

/** Needle winder: two stators turning under wire guides fed from spools. */
export function Winder({ busy }: { busy: boolean }) {
	const a = useSpin(busy, 7);
	const b = useSpin(busy, 7);
	const spools = useSpin(busy, 3, "x");
	const guide = useMotion(
		busy,
		(g, t) => {
			g.position.y = 1.35 + Math.sin(t * 9) * 0.05;
		},
		(g) => {
			g.position.y = 1.35;
		},
	);
	return (
		<group>
			<Plinth />
			<M g={G.rbox(1.5, 0.6, 1.3, 0.05)} m={MAT.paint} p={[0, 0.5, 0]} />
			<M g={G.box(1.3, 0.04, 1.1)} m={MAT.steelDark} p={[0, 0.82, 0.02]} />
			{/* Two stators on spindles, copper building up on their teeth. */}
			{([-0.36, 0.36] as const).map((x, i) => (
				<group key={x} ref={i === 0 ? a : b} position={[x, 0.98, 0.15]}>
					<M g={G.cyl(0.05, 0.05, 0.2, 16)} m={MAT.chrome} p={[0, -0.08, 0]} />
					<M g={G.gear(0.22, 12, 0.16)} m={MAT.steelDark} />
					<M
						g={G.torus(0.15, 0.06, 16, 48)}
						m={MAT.copper}
						p={[0, 0.06, 0]}
						r={[Math.PI / 2, 0, 0]}
					/>
				</group>
			))}
			{/* Wire guide bridge over both stations. */}
			<M
				g={G.rbox(0.12, 0.9, 0.12, 0.02)}
				m={MAT.paint}
				p={[-0.7, 1.2, -0.3]}
			/>
			<M g={G.rbox(0.12, 0.9, 0.12, 0.02)} m={MAT.paint} p={[0.7, 1.2, -0.3]} />
			<group ref={guide}>
				<M g={G.rbox(1.5, 0.12, 0.16, 0.03)} m={MAT.accent} p={[0, 0, -0.3]} />
				{([-0.36, 0.36] as const).map((x) => (
					<group key={x}>
						<M g={G.box(0.08, 0.08, 0.4)} m={MAT.steel} p={[x, 0, -0.1]} />
						<M
							g={G.cyl(0.018, 0.012, 0.22, 10)}
							m={MAT.chrome}
							p={[x, -0.14, 0.12]}
						/>
					</group>
				))}
			</group>
			{/* Spool rack at the back. */}
			<M g={G.box(1.3, 0.05, 0.3)} m={MAT.steelDark} p={[0, 1.72, -0.5]} />
			<group ref={spools} position={[0, 1.88, -0.5]}>
				<M
					g={G.cyl(0.03, 0.03, 1.3, 12)}
					m={MAT.chrome}
					r={[0, 0, Math.PI / 2]}
				/>
				{([-0.4, 0, 0.4] as const).map((x) => (
					<group key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
						<M g={G.cyl(0.13, 0.13, 0.03, 32)} m={MAT.frame} p={[0, 0.1, 0]} />
						<M g={G.cyl(0.13, 0.13, 0.03, 32)} m={MAT.frame} p={[0, -0.1, 0]} />
						<M g={G.cyl(0.1, 0.1, 0.17, 32)} m={MAT.copper} />
					</group>
				))}
			</group>
			{/* Operator panel. */}
			<M
				g={G.rbox(0.36, 0.26, 0.05, 0.02)}
				m={MAT.frame}
				p={[0.45, 0.55, 0.67]}
				r={[-0.3, 0, 0]}
			/>
			<M
				g={G.box(0.24, 0.14, 0.01)}
				m={busy ? MAT.screenOn : MAT.screenOff}
				p={[0.45, 0.56, 0.7]}
				r={[-0.3, 0, 0]}
			/>
		</group>
	);
}

/** Pick-and-place: glass hood, feeder bank, moving gantry and head. */
export function Smt({ busy }: { busy: boolean }) {
	const gantry = useMotion(
		busy,
		(g, t) => {
			g.position.z = Math.sin(t * 2.2) * 0.3;
		},
		(g) => {
			g.position.z = 0;
		},
	);
	const head = useMotion(
		busy,
		(g, t) => {
			g.position.x = Math.sin(t * 3.1) * 0.45;
			g.position.y = 1.2 + Math.max(0, Math.sin(t * 12)) * -0.08;
		},
		(g) => {
			g.position.x = 0;
			g.position.y = 1.2;
		},
	);
	return (
		<group>
			<Plinth />
			<M g={G.rbox(1.5, 0.75, 1.3, 0.05)} m={MAT.paint} p={[0, 0.57, 0]} />
			{/* Board transport and a board under the head. */}
			<M g={G.box(1.5, 0.05, 0.3)} m={MAT.steelDark} p={[0, 0.97, 0]} />
			<M g={G.box(0.45, 0.02, 0.26)} m={MAT.pcb} p={[0, 1.0, 0]} />
			{[-0.12, -0.04, 0.04, 0.12].map((x) => (
				<M
					key={x}
					g={G.box(0.05, 0.02, 0.05)}
					m={MAT.chip}
					p={[x, 1.02, 0.05]}
				/>
			))}
			{/* Gantry beam and head with nozzles. */}
			<group ref={gantry}>
				<M g={G.rbox(1.4, 0.1, 0.14, 0.03)} m={MAT.accent} p={[0, 1.36, 0]} />
				<group ref={head}>
					<M
						g={G.rbox(0.22, 0.18, 0.2, 0.03)}
						m={MAT.steelDark}
						p={[0, 0.06, 0]}
					/>
					{[-0.06, 0, 0.06].map((x) => (
						<M
							key={x}
							g={G.cyl(0.012, 0.008, 0.14, 10)}
							m={MAT.chrome}
							p={[x, -0.08, 0.04]}
						/>
					))}
				</group>
			</group>
			{/* Hood: frame posts and glass. */}
			{(
				[
					[-0.72, -0.62],
					[0.72, -0.62],
					[-0.72, 0.62],
					[0.72, 0.62],
				] as const
			).map(([x, z]) => (
				<M
					key={`${x},${z}`}
					g={G.box(0.05, 0.62, 0.05)}
					m={MAT.frame}
					p={[x, 1.25, z]}
				/>
			))}
			<M
				g={G.box(1.42, 0.02, 1.22)}
				m={MAT.glass}
				p={[0, 1.57, 0]}
				shadow={false}
			/>
			{(
				[
					[0, -0.62, 1.5, 0.05],
					[0, 0.62, 1.5, 0.05],
					[-0.72, 0, 0.05, 1.3],
					[0.72, 0, 0.05, 1.3],
				] as const
			).map(([x, z, w, d]) => (
				<M
					key={`${x},${z}`}
					g={G.box(w, 0.05, d)}
					m={MAT.frame}
					p={[x, 1.58, z]}
				/>
			))}
			<M
				g={G.box(1.42, 0.56, 0.02)}
				m={MAT.glass}
				p={[0, 1.25, 0.63]}
				shadow={false}
			/>
			<M
				g={G.box(0.02, 0.56, 1.22)}
				m={MAT.glass}
				p={[0.73, 1.25, 0]}
				shadow={false}
			/>
			<M
				g={G.box(0.02, 0.56, 1.22)}
				m={MAT.glass}
				p={[-0.73, 1.25, 0]}
				shadow={false}
			/>
			{/* Feeder bank of component reels along the front. */}
			<M g={G.box(1.3, 0.3, 0.16)} m={MAT.steelDark} p={[0, 0.75, 0.73]} />
			{Array.from({ length: 10 }, (_, i) => {
				const x = -0.58 + i * 0.13;
				return (
					<M
						key={x}
						g={G.cyl(0.1, 0.1, 0.04, 32)}
						m={
							i % 3 === 0
								? MAT.chip
								: tinted(REEL_COLORS[i % REEL_COLORS.length])
						}
						p={[x, 1.0, 0.78]}
						r={[0, 0, Math.PI / 2]}
					/>
				);
			})}
		</group>
	);
}
