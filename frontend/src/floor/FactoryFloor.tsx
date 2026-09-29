// Isometric 3D view of the plant, driven entirely by the sim View.
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { StationKind, StationView, View } from "../sim/types";
import { Conveyors, CrateStack, Dock } from "./Conveyors";
import { type Label, LabelLayer, LabelProjector } from "./Labels";
import {
	BUFFER_OFFSET,
	type Conveyor,
	machineOffset,
	RECEIVING,
	SHIPPING,
	STATION_POS,
} from "./layout";
import { Beacon, MachineModel, Part } from "./Machines";
import { COLORS } from "./palette";
import { beaconState } from "./status";

/** Plant footprint as seen from the iso camera, in world units. */
const VIEW_WIDTH = 35;
const VIEW_HEIGHT = 19;

/** Zoom that fits the whole plant in a canvas of this size. */
function fitZoom(width: number, height: number) {
	return Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
}

/** Fit the whole plant on screen whenever the canvas is resized. */
function FitCamera() {
	const { camera, size } = useThree();
	useEffect(() => {
		camera.zoom = fitZoom(size.width, size.height);
		camera.updateProjectionMatrix();
	}, [camera, size.width, size.height]);
	return null;
}

/** Orbit controls that can always zoom back out to the fitted view. */
function Controls() {
	const { size } = useThree();
	return (
		<OrbitControls
			target={[1.5, 0, -0.5]}
			enableRotate
			minPolarAngle={0.5}
			maxPolarAngle={1.1}
			minZoom={Math.min(16, fitZoom(size.width, size.height))}
			maxZoom={80}
		/>
	);
}

function Floor() {
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
				<planeGeometry args={[48, 26]} />
				<meshToonMaterial color={COLORS.floor} />
			</mesh>
			<gridHelper
				args={[48, 24, COLORS.floorLine, COLORS.floorLine]}
				position={[0, 0.01, 0]}
			/>
			{/* Hazard-striped walkway along the front of the line. */}
			{Array.from({ length: 22 }, (_, i) => (
				<mesh
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					key={i}
					position={[-21 + i * 2, 0.02, 10.5]}
					rotation={[-Math.PI / 2, 0, 0.6]}
				>
					<planeGeometry args={[0.5, 1.6]} />
					<meshBasicMaterial color={COLORS.walkway} />
				</mesh>
			))}
		</group>
	);
}

interface StationProps {
	st: StationView;
	view: View;
	selected: boolean;
	onSelect: (k: StationKind) => void;
}

function Station({ st, view, selected, onSelect }: StationProps) {
	const [hover, setHover] = useState(false);
	const [x, z] = STATION_POS[st.kind];
	const beacon = beaconState(st, view.operating);
	const buffer = view.stock.find((s) => s.item === st.output)?.qty ?? 0;
	const cols = Math.ceil(st.machines.length / 2);
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
			{/* Cell pad; highlighted when selected or hovered. */}
			<Part
				pos={[-(cols - 1) * 0.95, 0.03, 0]}
				color={selected ? COLORS.accent : hover ? "#3d444c" : "#30363d"}
				outline={false}
			>
				<boxGeometry args={[cols * 1.9 + 0.6, 0.06, 4]} />
			</Part>
			{st.machines.map((m, i) => {
				const [ox, oz] = machineOffset(i);
				const down = m.down_reason !== null;
				return (
					<group
						key={m.id}
						position={[ox, 0.06, oz]}
						rotation={[0, 0, down ? 0.05 : 0]}
					>
						<group scale={1.2}>
							<MachineModel
								kind={st.kind}
								busy={st.busy && !down}
								beacon={beacon}
							/>
						</group>
					</group>
				);
			})}
			<group scale={1.8} position={[0.9, 0, -1.6]}>
				<Beacon state={beacon} pos={[0, 1.2, 0]} />
			</group>
			<CrateStack pos={BUFFER_OFFSET} qty={buffer} />
		</group>
	);
}

interface Props {
	view: View;
	selected: StationKind | null;
	onSelect: (k: StationKind | null) => void;
}

export function FactoryFloor({ view, selected, onSelect }: Props) {
	const byKind = new Map(view.stations.map((s) => [s.kind, s]));
	const isBusy = (c: Conveyor) => Boolean(byKind.get(c.driver)?.busy);
	const labelRefs = useRef(new Map<string, HTMLDivElement>());
	const labels: Label[] = [
		...view.stations.map((st) => {
			const [x, z] = STATION_POS[st.kind];
			const beacon = beaconState(st, view.operating);
			return {
				id: st.kind,
				text: st.label,
				anchor: [x - 0.5, 3.4, z - 1.4] as [number, number, number],
				className: `beacon-${beacon}${selected === st.kind ? " selected" : ""}`,
			};
		}),
		{
			id: "receiving",
			text: "Receiving",
			anchor: [RECEIVING[0], 2.6, RECEIVING[1] - 4.2],
			className: "dock",
		},
		{
			id: "shipping",
			text: "Shipping",
			anchor: [SHIPPING[0], 2.6, SHIPPING[1] - 4.2],
			className: "dock",
		},
	];
	return (
		<div className="floor-canvas">
			<Canvas shadows dpr={[1, 2]} onPointerMissed={() => onSelect(null)}>
				<LabelProjector labels={labels} refs={labelRefs} />
				<FitCamera />
				<color attach="background" args={["#15181b"]} />
				<OrthographicCamera
					makeDefault
					position={[22, 24, 26]}
					zoom={34}
					near={-100}
					far={200}
				/>
				<Controls />
				<hemisphereLight args={["#dfe7ef", "#20242a", 0.9]} />
				<directionalLight
					position={[12, 20, 8]}
					intensity={1.6}
					castShadow
					shadow-mapSize={[2048, 2048]}
					shadow-camera-left={-26}
					shadow-camera-right={26}
					shadow-camera-top={16}
					shadow-camera-bottom={-16}
				/>
				<Floor />
				<Dock pos={RECEIVING} label="Receiving" facing={1} />
				<Dock pos={SHIPPING} label="Shipping" facing={-1} />
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
