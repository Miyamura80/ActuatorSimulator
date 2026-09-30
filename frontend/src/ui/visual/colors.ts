// Colours shared by the 3D floor and the 2D UI, so a part looks the same on
// a belt, in a gauge and in the flow map. No three.js here: the UI loads it
// before the floor chunk.
import type { Item } from "../../sim/types";

export const ITEM_COLOR: Record<Item, string> = {
	alu_billet: "#c9d1d9",
	steel_blank: "#7d8894",
	copper_wire: "#d9823b",
	laminations: "#6f7a86",
	bearing: "#b8c2cc",
	encoder_ic: "#2b2f35",
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

/** Stack-light colours, one per station state. */
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

/** Green through amber to red as `t` goes from 1 (healthy) to 0. */
export function healthColor(t: number): string {
	if (t > 0.6) return "#3ec27a";
	if (t > 0.35) return "#f2b705";
	return "#ef5350";
}
