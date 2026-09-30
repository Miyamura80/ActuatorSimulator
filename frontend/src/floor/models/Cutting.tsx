// Metal-cutting machines: the CNC mill and the gear hobber.
import { G, M, MAT, Plinth, useMotion, useSpin } from "./kit";

/** Vertical machining center: enclosure, glass doors, bobbing spindle. */
export function Mill({ busy }: { busy: boolean }) {
	const head = useMotion(
		busy,
		(g, t) => {
			g.position.y = 1.18 + Math.sin(t * 5) * 0.1;
			g.position.x = Math.sin(t * 1.3) * 0.2;
		},
		(g) => {
			g.position.y = 1.28;
			g.position.x = 0;
		},
	);
	const tool = useSpin(busy, 40);
	return (
		<group>
			<Plinth />
			{/* Enclosure: base, pillars, roof, back. */}
			<M g={G.rbox(1.5, 0.45, 1.3, 0.05)} m={MAT.paint} p={[0, 0.42, 0]} />
			<M g={G.rbox(0.16, 1.05, 1.3, 0.03)} m={MAT.paint} p={[-0.67, 1.17, 0]} />
			<M g={G.rbox(0.16, 1.05, 1.3, 0.03)} m={MAT.paint} p={[0.67, 1.17, 0]} />
			<M g={G.rbox(1.5, 0.14, 1.3, 0.04)} m={MAT.paint} p={[0, 1.73, 0]} />
			<M g={G.box(1.2, 1.05, 0.06)} m={MAT.steelDark} p={[0, 1.17, -0.6]} />
			{/* Sliding doors with frames and a handle. */}
			<M
				g={G.box(0.58, 0.8, 0.02)}
				m={MAT.glass}
				p={[-0.29, 1.12, 0.62]}
				shadow={false}
			/>
			<M
				g={G.box(0.58, 0.8, 0.02)}
				m={MAT.glass}
				p={[0.29, 1.12, 0.6]}
				shadow={false}
			/>
			<M g={G.box(1.2, 0.05, 0.05)} m={MAT.accent} p={[0, 1.54, 0.62]} />
			<M g={G.box(1.2, 0.05, 0.05)} m={MAT.accent} p={[0, 0.7, 0.62]} />
			<M g={G.cyl(0.02, 0.02, 0.3, 12)} m={MAT.chrome} p={[0.05, 1.12, 0.66]} />
			{/* Work table with vise and a billet. */}
			<M g={G.box(1.0, 0.08, 0.6)} m={MAT.steel} p={[0, 0.69, 0.05]} />
			<M g={G.box(0.3, 0.12, 0.22)} m={MAT.steelDark} p={[0, 0.79, 0.05]} />
			<M g={G.box(0.2, 0.1, 0.16)} m={MAT.chrome} p={[0, 0.88, 0.05]} />
			{/* Spindle head (moves) with a spinning end mill. */}
			<group ref={head}>
				<M
					g={G.rbox(0.34, 0.36, 0.42, 0.04)}
					m={MAT.accent}
					p={[0, 0.25, -0.1]}
				/>
				<M g={G.cyl(0.09, 0.11, 0.18, 32)} m={MAT.steel} />
				<group ref={tool} position={[0, -0.15, 0]}>
					<M g={G.cyl(0.035, 0.035, 0.16, 16)} m={MAT.chrome} />
				</group>
			</group>
			{/* Spindle motor on the roof. */}
			<M
				g={G.cyl(0.16, 0.16, 0.34, 32)}
				m={MAT.steelDark}
				p={[0, 1.97, -0.25]}
			/>
			<M g={G.cyl(0.17, 0.17, 0.05, 32)} m={MAT.steel} p={[0, 2.15, -0.25]} />
			{/* Control pendant on an arm. */}
			<M g={G.box(0.05, 0.05, 0.3)} m={MAT.steelDark} p={[0.8, 1.35, 0.35]} />
			<M
				g={G.rbox(0.12, 0.5, 0.36, 0.03)}
				m={MAT.frame}
				p={[0.86, 1.35, 0.55]}
				r={[0, -0.5, 0]}
			/>
			<M
				g={G.box(0.02, 0.26, 0.24)}
				m={busy ? MAT.screenOn : MAT.screenOff}
				p={[0.93, 1.42, 0.59]}
				r={[0, -0.5, 0]}
			/>
			{/* Coolant tank and chip bin behind. */}
			<M
				g={G.rbox(0.5, 0.35, 0.3, 0.03)}
				m={MAT.steelDark}
				p={[-0.45, 0.38, -0.75]}
			/>
			<M g={G.cyl(0.04, 0.04, 0.9, 12)} m={MAT.steel} p={[-0.62, 0.9, -0.64]} />
		</group>
	);
}

/** Gear hobber: rotating gear blank and a spinning hob on a column. */
export function GearCut({ busy }: { busy: boolean }) {
	const blank = useSpin(busy, 1.2);
	const hob = useSpin(busy, 9, "x");
	const slide = useMotion(
		busy,
		(g, t) => {
			g.position.y = 1.02 + Math.sin(t * 0.8) * 0.06;
		},
		(g) => {
			g.position.y = 1.08;
		},
	);
	return (
		<group>
			<Plinth />
			<M g={G.rbox(1.5, 0.5, 1.3, 0.05)} m={MAT.paint} p={[0, 0.45, 0]} />
			{/* Rotary table and the gear being cut. */}
			<M
				g={G.cyl(0.4, 0.44, 0.12, 48)}
				m={MAT.steelDark}
				p={[-0.2, 0.76, 0.1]}
			/>
			<group ref={blank} position={[-0.2, 0.9, 0.1]}>
				<M g={G.gear(0.34, 28, 0.14)} m={MAT.steel} />
				<M g={G.cyl(0.06, 0.06, 0.4, 20)} m={MAT.chrome} p={[0, 0.1, 0]} />
			</group>
			{/* Column and hob carriage. */}
			<M
				g={G.rbox(0.42, 1.55, 0.6, 0.05)}
				m={MAT.paint}
				p={[0.5, 1.45, -0.1]}
			/>
			<M g={G.box(0.06, 1.3, 0.08)} m={MAT.chrome} p={[0.28, 1.4, 0.12]} />
			<group ref={slide}>
				<M g={G.rbox(0.3, 0.3, 0.4, 0.04)} m={MAT.accent} p={[0.2, 0, 0.1]} />
				<group ref={hob} position={[0.02, 0, 0.1]}>
					{/* The hob: a fluted cylinder, rings standing in for the thread. */}
					<M
						g={G.cyl(0.11, 0.11, 0.34, 32)}
						m={MAT.chrome}
						r={[0, 0, Math.PI / 2]}
					/>
					{[-0.12, -0.06, 0, 0.06, 0.12].map((x) => (
						<M
							key={x}
							g={G.torus(0.11, 0.022, 8, 32)}
							m={MAT.steel}
							p={[x, 0, 0]}
							r={[0, Math.PI / 2, 0]}
						/>
					))}
				</group>
			</group>
			{/* Coolant nozzle aimed at the cut. */}
			<M
				g={G.cyl(0.018, 0.018, 0.5, 10)}
				m={MAT.copper}
				p={[-0.05, 1.2, 0.35]}
				r={[0.5, 0, 0.9]}
			/>
			<M
				g={G.rbox(0.36, 0.3, 0.36, 0.03)}
				m={MAT.frame}
				p={[-0.52, 0.85, -0.42]}
			/>
		</group>
	);
}
