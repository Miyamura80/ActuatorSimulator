import * as THREE from "three";
import type { Item } from "../sim/types";

export const COLORS = {
	floor: "#2a2e33",
	floorLine: "#3a4047",
	walkway: "#f2b705",
	steel: "#8c96a0",
	steelDark: "#4b535b",
	body: "#d9dde1",
	accent: "#f2b705",
	glass: "#7fb8d8",
	belt: "#1d2125",
	rail: "#6d7680",
	dock: "#3b4148",
	crate: "#b07a44",
	outline: "#0c0e10",
};

export const BEACON = {
	running: "#3ec27a",
	starved: "#f2b705",
	alarm: "#ff9f1a",
	degraded: "#ff7043",
	broken: "#ef5350",
	maintenance: "#64a8ff",
	off: "#59616a",
} as const;

export type BeaconState = keyof typeof BEACON;

/** Part colors on the belts, so flows are readable at a glance. */
export const ITEM_COLOR: Partial<Record<Item, string>> = {
	alu_billet: "#c9d1d9",
	steel_blank: "#7d8894",
	copper_wire: "#d9823b",
	pcb_blank: "#3aa35b",
	magnets: "#8a5cc2",
	housing: "#e6e9ec",
	gear_set: "#9aa6b2",
	stator: "#c46a2a",
	driver_board: "#1f7a44",
	motor: "#4f79c7",
	actuator: "#f2b705",
	finished_good: "#3ec27a",
};

let gradient: THREE.DataTexture | null = null;

/** Three-band ramp for the cel-shaded (toon) look. */
export function toonGradient(): THREE.DataTexture {
	if (gradient) return gradient;
	const data = new Uint8Array([90, 170, 255]);
	gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
	gradient.minFilter = THREE.NearestFilter;
	gradient.magFilter = THREE.NearestFilter;
	gradient.needsUpdate = true;
	return gradient;
}
