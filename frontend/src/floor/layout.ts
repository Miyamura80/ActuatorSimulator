// Floor plan in world units (x right, z toward the camera, y up).
// Material flows left to right: receiving, feeder cells, assembly, test, shipping.
import type { Item, StationKind } from "../sim/types";

export type Vec2 = [number, number];

export const STATION_POS: Record<StationKind, Vec2> = {
	mill: [-6, -7],
	gear_cut: [-6, -2.5],
	winding: [-6, 2],
	smt: [-6, 6.5],
	motor_asm: [0.5, 2],
	final_asm: [6, -0.5],
	eol_test: [11.5, -0.5],
};

export const RECEIVING: Vec2 = [-15, 0];
export const SHIPPING: Vec2 = [17, -0.5];

/** Where machine `i` of `n` sits relative to its station anchor. */
export function machineOffset(i: number): Vec2 {
	const col = Math.floor(i / 2);
	const row = i % 2;
	return [-col * 1.9, row === 0 ? -0.9 : 0.9];
}

/** Where the output buffer crates sit relative to the station anchor. */
export const BUFFER_OFFSET: Vec2 = [1.8, 1.4];

export interface Conveyor {
	id: string;
	/** Station whose activity drives this belt (null: receiving). */
	driver: StationKind | null;
	item: Item;
	points: Vec2[];
}

const out = (k: StationKind): Vec2 => [
	STATION_POS[k][0] + 1.3,
	STATION_POS[k][1],
];
const inp = (k: StationKind): Vec2 => [
	STATION_POS[k][0] - 1.5,
	STATION_POS[k][1],
];

export const CONVEYORS: Conveyor[] = [
	// Receiving feeds every raw-material consumer.
	{
		id: "r-mill",
		driver: "mill",
		item: "alu_billet",
		points: [[-12.5, -1], [-10, -7], inp("mill")],
	},
	{
		id: "r-gear",
		driver: "gear_cut",
		item: "steel_blank",
		points: [[-12.5, -0.5], [-10, -2.5], inp("gear_cut")],
	},
	{
		id: "r-wind",
		driver: "winding",
		item: "copper_wire",
		points: [[-12.5, 0.5], [-10, 2], inp("winding")],
	},
	{
		id: "r-smt",
		driver: "smt",
		item: "pcb_blank",
		points: [[-12.5, 1], [-10, 6.5], inp("smt")],
	},
	{
		id: "r-motor",
		driver: "motor_asm",
		item: "magnets",
		points: [
			[-12.5, 1.5],
			[-9.5, 4.3],
			[-2.5, 4.3],
			[-1.2, 2.6],
		],
	},
	// Feeder cells to assembly.
	{
		id: "mill-final",
		driver: "mill",
		item: "housing",
		points: [out("mill"), [3, -7], [3, -1.2], inp("final_asm")],
	},
	{
		id: "gear-final",
		driver: "gear_cut",
		item: "gear_set",
		points: [out("gear_cut"), [3.2, -2.5], [3.8, -0.8]],
	},
	{
		id: "wind-motor",
		driver: "winding",
		item: "stator",
		points: [out("winding"), inp("motor_asm")],
	},
	{
		id: "smt-final",
		driver: "smt",
		item: "driver_board",
		points: [out("smt"), [3.5, 6.5], [3.5, 0.5], [4.4, 0]],
	},
	{
		id: "motor-final",
		driver: "motor_asm",
		item: "motor",
		points: [out("motor_asm"), [3, 2], [4.4, 0.3]],
	},
	// Assembly to test to shipping.
	{
		id: "final-eol",
		driver: "final_asm",
		item: "actuator",
		points: [out("final_asm"), inp("eol_test")],
	},
	{
		id: "eol-ship",
		driver: "eol_test",
		item: "finished_good",
		points: [out("eol_test"), [15, -0.5]],
	},
];
