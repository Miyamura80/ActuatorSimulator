// Isometric 3D view of the plant, driven entirely by the sim View.
import {
	Environment,
	Lightformer,
	OrbitControls,
	OrthographicCamera,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import * as THREE from "three";
import type { GameEvent, StationKind, StationView, View } from "../sim/types";
import { Glyph } from "../ui/visual/glyphs";
import { ItemIcon } from "../ui/visual/icons";
import { Building } from "./Building";
import { Conveyors } from "./Conveyors";
import { CrateStack, Dock } from "./Docks";
import { type Label, LabelLayer, LabelProjector } from "./Labels";
import {
	BUFFER_OFFSET,
	CELL_HALF_D,
	CELL_HALF_W,
	type Conveyor,
	MAX_SLOTS,
	machineSlot,
	PLANT_BOUNDS,
	RECEIVING,
	RECEIVING_HALF_D,
	SHIPPING,
	STATION_POS,
} from "./layout";
import { Beacon, MachineModel } from "./models";
import { G, M, MAT, Static, type Xform } from "./models/kit";
import { tinted } from "./palette";
import { type Pop, popFor } from "./pops";
import { beaconState } from "./status";

const [MIN_X, MAX_X, MIN_Z, MAX_Z] = PLANT_BOUNDS;
/** Iso view direction: from the front right, looking down. */
const VIEW_DIR = new THREE.Vector3(7, 26, 30);
const TOP_Y = 4.2;
const OPEN_ZOOM = 1.25;

/** The plant's corners in the view space of `camera`. */
function viewCorners(camera: THREE.Camera): THREE.Vector3[] {
	camera.updateMatrixWorld();
	const out: THREE.Vector3[] = [];
	for (const x of [MIN_X, MAX_X])
		for (const y of [0, TOP_Y])
			for (const z of [MIN_Z, MAX_Z])
				out.push(
					new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse),
				);
	return out;
}

/** Orbit target that puts the plant's projected box in the middle of the view. */
const TARGET = (() => {
	const guess = new THREE.Vector3((MIN_X + MAX_X) / 2, 0, (MIN_Z + MAX_Z) / 2);
	const cam = new THREE.OrthographicCamera();
	cam.position.copy(guess).add(VIEW_DIR);
	cam.lookAt(guess);
	const pts = viewCorners(cam);
	const mid = (k: "x" | "y") =>
		(Math.min(...pts.map((p) => p[k])) + Math.max(...pts.map((p) => p[k]))) / 2;
	// Slide along the view plane, then drop back onto the floor.
	const shift = new THREE.Vector3(mid("x"), mid("y"), 0).applyQuaternion(
		cam.quaternion,
	);
	const p = guess.clone().add(shift);
	const dir = VIEW_DIR.clone().normalize();
	return p.sub(dir.multiplyScalar(p.y / dir.y));
})();
const CAMERA_POS = TARGET.clone().add(VIEW_DIR).toArray();

/** Zoom at which the plant's bounding box fills the canvas. */
function fitZoom(camera: THREE.Camera, width: number, height: number) {
	camera.updateMatrixWorld();
	const center = TARGET.clone().applyMatrix4(camera.matrixWorldInverse);
	let dx = 0;
	let dy = 0;
	for (const c of viewCorners(camera)) {
		dx = Math.max(dx, Math.abs(c.x - center.x));
		dy = Math.max(dy, Math.abs(c.y - center.y));
	}
	return Math.min(width / (2 * dx), height / (2 * dy));
}

/** Fit the whole plant on screen, and let the user zoom back out to that. */
function CameraRig() {
	const { camera, size } = useThree();
	const [fit, setFit] = useState(20);
	useLayoutEffect(() => {
		camera.lookAt(TARGET);
		const z = fitZoom(camera, size.width, size.height);
		// Open a little closer than the full fit; the edges are set dressing.
		camera.zoom = z * OPEN_ZOOM;
		camera.updateProjectionMatrix();
		setFit(z);
	}, [camera, size.width, size.height]);
	return (
		<OrbitControls
			makeDefault
			target={TARGET}
			enableRotate
			minPolarAngle={0.5}
			maxPolarAngle={1.1}
			minZoom={fit * 0.9}
			maxZoom={120}
		/>
	);
}

/** Image-based lighting from soft area lights, built once in the scene. */
function Lighting() {
	return (
		<>
			<hemisphereLight args={["#dfe7ef", "#2a2e33", 0.35]} />
			<directionalLight
				position={[TARGET.x + 14, 26, TARGET.z + 12]}
				intensity={2.2}
				castShadow
				shadow-mapSize={[4096, 4096]}
				shadow-bias={-0.0003}
				shadow-normalBias={0.02}
				shadow-camera-left={-36}
				shadow-camera-right={36}
				shadow-camera-top={24}
				shadow-camera-bottom={-24}
				shadow-camera-near={1}
				shadow-camera-far={80}
			/>
			<directionalLight
				position={[-20, 12, 18]}
				intensity={0.35}
				color="#b8d0ff"
			/>
			<Environment resolution={256} frames={1}>
				<color attach="background" args={["#1a1d21"]} />
				<Lightformer
					intensity={2.5}
					position={[0, 10, 0]}
					rotation-x={Math.PI / 2}
					scale={[40, 10, 1]}
				/>
				<Lightformer
					intensity={1.2}
					position={[-12, 4, -6]}
					rotation-y={Math.PI / 2}
					scale={[20, 3, 1]}
				/>
				<Lightformer
					intensity={1.2}
					position={[12, 4, 6]}
					rotation-y={-Math.PI / 2}
					scale={[20, 3, 1]}
					color="#ffe9c4"
				/>
			</Environment>
		</>
	);
}

interface StationProps {
	st: StationView;
	view: View;
	selected: boolean;
	onSelect: (k: StationKind) => void;
}

const PAD_W = CELL_HALF_W * 2;
const PAD_D = CELL_HALF_D * 2;

function Station({ st, view, selected, onSelect }: StationProps) {
	const [hover, setHover] = useState(false);
	const [x, z] = STATION_POS[st.kind];
	const beacon = beaconState(st, view.operating);
	const buffer = view.stock.find((s) => s.item === st.output)?.qty ?? 0;
	const filled = st.machines.length;
	const emptyBays = useMemo(
		() =>
			Array.from({ length: MAX_SLOTS - filled }, (_, k): Xform => {
				const slot = machineSlot(filled + k);
				return { p: [slot.x, 0.064, slot.z] };
			}),
		[filled],
	);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: an r3f scene object, not a DOM node; keyboard access comes from the station list in the UI
		<group
			position={[x, 0, z]}
			onClick={(e) => {
				e.stopPropagation();
				onSelect(st.kind);
			}}
			onPointerOver={(e) => {
				e.stopPropagation();
				setHover(true);
			}}
			onPointerOut={() => setHover(false)}
		>
			{/* Epoxy cell pad; a lit border marks the selected or hovered cell. */}
			<M
				g={G.rbox(PAD_W, 0.06, PAD_D, 0.02)}
				m={tinted(hover ? "#3a4a4d" : "#2f3a3c")}
				p={[0, 0.03, 0]}
				shadow={false}
			/>
			{(selected || hover) && (
				<group position={[0, 0.065, 0]}>
					{(
						[
							[0, -PAD_D / 2, PAD_W, 0.08],
							[0, PAD_D / 2, PAD_W, 0.08],
							[-PAD_W / 2, 0, 0.08, PAD_D],
							[PAD_W / 2, 0, 0.08, PAD_D],
						] as const
					).map(([bx, bz, w, d]) => (
						<M
							key={`${bx},${bz}`}
							g={G.box(w, 0.012, d)}
							m={selected ? MAT.selectGlow : MAT.hoverGlow}
							p={[bx, 0, bz]}
							shadow={false}
						/>
					))}
				</group>
			)}
			{/* Painted outlines on the bays that have no machine yet. */}
			<Static
				g={G.box(1.6, 0.004, 1.5)}
				m={MAT.bay}
				shadow={false}
				items={emptyBays}
			/>
			{st.machines.map((m, i) => {
				const slot = machineSlot(i);
				const down = m.down_reason !== null;
				return (
					<group
						key={m.id}
						position={[slot.x, 0.06, slot.z]}
						rotation={[0, slot.row === 1 ? Math.PI : 0, down ? 0.04 : 0]}
					>
						<MachineModel
							kind={st.kind}
							busy={st.busy && !down}
							beacon={beacon}
						/>
					</group>
				);
			})}
			<group position={[CELL_HALF_W - 0.2, 0.06, -CELL_HALF_D + 0.2]}>
				<Beacon state={beacon} />
			</group>
			<CrateStack pos={BUFFER_OFFSET} qty={buffer} />
		</group>
	);
}

/** What a station label shows before its name: the reason it isn't running. */
function statusIcon(st: StationView, view: View): ReactNode {
	switch (beaconState(st, view.operating)) {
		case "starved":
			return st.starved_on ? (
				<span className="missing">
					<ItemIcon item={st.starved_on} size={16} />
				</span>
			) : null;
		case "broken":
		case "degraded":
			return <Glyph name="bolt" size={14} className="bad" />;
		case "maintenance":
			return <Glyph name="wrench" size={14} />;
		case "alarm":
			return <Glyph name="alert" size={14} />;
		default:
			return null;
	}
}

const POP_MS = 2600;
const MAX_POPS = 10;

/** Events from the last few seconds, as floor labels. */
function usePops(events: GameEvent[]): Pop[] {
	const [pops, setPops] = useState<Pop[]>([]);
	const last = useRef(events.length > 0 ? events[events.length - 1].seq : -1);
	const timers = useRef(new Set<number>());
	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const t of pending) window.clearTimeout(t);
		};
	}, []);
	useEffect(() => {
		const fresh: Pop[] = [];
		for (const e of events) {
			if (e.seq <= last.current) continue;
			const p = popFor(e);
			if (p) fresh.push({ ...p, id: `pop-${e.seq}` });
		}
		if (events.length > 0) last.current = events[events.length - 1].seq;
		if (fresh.length === 0) return;
		setPops((prev) => [...prev, ...fresh].slice(-MAX_POPS));
		const ids = new Set(fresh.map((p) => p.id));
		const t = window.setTimeout(() => {
			timers.current.delete(t);
			setPops((prev) => prev.filter((p) => !ids.has(p.id)));
		}, POP_MS);
		timers.current.add(t);
	}, [events]);
	return pops;
}

interface Props {
	view: View;
	events: GameEvent[];
	selected: StationKind | null;
	onSelect: (k: StationKind | null) => void;
}

export function FactoryFloor({ view, events, selected, onSelect }: Props) {
	const pops = usePops(events);
	const byKind = new Map(view.stations.map((s) => [s.kind, s]));
	const isBusy = (c: Conveyor) => Boolean(byKind.get(c.driver)?.busy);
	const labelRefs = useRef(new Map<string, HTMLDivElement>());
	const labels: Label[] = [
		...view.stations.map((st) => {
			const [x, z] = STATION_POS[st.kind];
			const beacon = beaconState(st, view.operating);
			const icon = statusIcon(st, view);
			return {
				id: st.kind,
				text: st.label,
				content: icon ? (
					<>
						{icon} {st.label}
					</>
				) : undefined,
				anchor: [x - 0.5, 2.9, z - CELL_HALF_D] as [number, number, number],
				className: `beacon-${beacon}${selected === st.kind ? " selected" : ""}`,
			};
		}),
		{
			id: "receiving",
			text: "Receiving",
			anchor: [RECEIVING[0], 3.6, RECEIVING[1] - RECEIVING_HALF_D + 1],
			className: "dock",
		},
		{
			id: "shipping",
			text: "Shipping",
			anchor: [SHIPPING[0], 3.6, SHIPPING[1] - 4],
			className: "dock",
		},
		// Stack pops that share an anchor so they don't sit on each other.
		...pops.map((p, i) => {
			const twins = pops.slice(0, i).filter((q) => q.anchor === p.anchor);
			const [x, y, z] = p.anchor;
			return {
				id: p.id,
				text: "",
				// The outer label is moved every frame; the inner span rises.
				content: <span className="rise">{p.content}</span>,
				anchor: [x, y + twins.length * 0.9, z] as [number, number, number],
				className: p.className,
			};
		}),
	];
	return (
		<div className="floor-canvas">
			<Canvas
				shadows
				dpr={[1, 2]}
				gl={{ antialias: true }}
				onPointerMissed={() => onSelect(null)}
			>
				<LabelProjector labels={labels} refs={labelRefs} />
				<color attach="background" args={["#15181b"]} />
				<OrthographicCamera
					makeDefault
					position={CAMERA_POS}
					zoom={20}
					near={-100}
					far={300}
				/>
				<CameraRig />
				<Lighting />
				<Building />
				<Dock pos={RECEIVING} halfDepth={RECEIVING_HALF_D} facing={1} />
				<Dock pos={SHIPPING} halfDepth={4} facing={-1} />
				<Conveyors isBusy={isBusy} />
				{view.stations.map((st) => (
					<Station
						key={st.kind}
						st={st}
						view={view}
						selected={selected === st.kind}
						onSelect={onSelect}
					/>
				))}
			</Canvas>
			<LabelLayer labels={labels} refs={labelRefs} />
		</div>
	);
}
