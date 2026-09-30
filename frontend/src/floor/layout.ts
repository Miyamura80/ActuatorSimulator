// Floor plan in world units (x right, z toward the camera, y up).
// Material flows left to right: receiving, feeder cells, assembly, test,
// shipping. Every belt runs along x or z so corners and junctions line up.
//
//   receiving   feeders        sub-asm     spine  final      test      shipping
//   |=|  ---->  [ mill   ]  ------------------+
//   |=|  ---->  [ gear   ]  ------------------+
//   |=|                                       +--> [ final ] -> [ eol ] -> |=|
//   |=|  ---->  [ winding]  -+-> [ motor ] ---+
//   |=|  ------------------- +                |
//   |=|  ---->  [ smt    ]  ------------------+

import type { Item, StationKind } from "../sim/types";

export type Vec2 = [number, number];

/** Machine slots in a cell: 3 columns either side of a center belt. */
const SLOT_X = 1.9;
const SLOT_Z = 1.15;
/** Cell half extents; machines fill a fixed footprint so belts never move. */
export const CELL_HALF_W = 3.1;
export const CELL_HALF_D = 2.2;

const COL_FEED = -10;
const COL_SUB = -0.5;
const COL_FINAL = 10;
const COL_TEST = 19.5;
const ROW = 5.6;

export const STATION_POS: Record<StationKind, Vec2> = {
	mill: [COL_FEED, -1.5 * ROW],
	gear_cut: [COL_FEED, -0.5 * ROW],
	winding: [COL_FEED, 0.5 * ROW],
	smt: [COL_FEED, 1.5 * ROW],
	motor_asm: [COL_SUB, 0.5 * ROW],
	final_asm: [COL_FINAL, 0],
	eol_test: [COL_TEST, 0],
};

export const RECEIVING: Vec2 = [-19.5, 0];
export const SHIPPING: Vec2 = [26.5, 0];
/** Half depth of the receiving dock, which spans every feeder row. */
export const RECEIVING_HALF_D = 10;
const RECEIVING_EDGE = RECEIVING[0] + 2;
const SHIPPING_EDGE = SHIPPING[0] - 2;
/** x of the collector belt that feeds final assembly. */
const SPINE_X = 4.5;
/** x where the bearings/magnets belt turns up into the stator line. */
const MOTOR_FEED_X = -5.2;

/** Columns fill from the middle out, so small cells look balanced. */
const COL_ORDER = [0, -1, 1];

/** Machine `i` of a cell, relative to the cell center. Row 0 is behind the belt. */
export function machineSlot(i: number): { x: number; z: number; row: 0 | 1 } {
	const col = COL_ORDER[Math.floor(i / 2)];
	const row = (i % 2) as 0 | 1;
	return { x: col * SLOT_X, z: row === 0 ? -SLOT_Z : SLOT_Z, row };
}

/** Every machine bay a cell has, filled or not. */
export const MAX_SLOTS = COL_ORDER.length * 2;

/** Output buffer pallet, just past the cell's output end. */
export const BUFFER_OFFSET: Vec2 = [CELL_HALF_W + 0.55, 1.35];

export interface Conveyor {
	id: string;
	/** Station whose activity drives this belt (its consumer or producer). */
	driver: StationKind;
	/** Items riding the belt, cycled in order. */
	items: Item[];
	points: Vec2[];
	/** The belt starts in the side of another belt (no end roller). */
	fromJunction?: boolean;
	/** The belt ends in the side of another belt (no end roller). */
	intoJunction?: boolean;
}

const at = (k: StationKind) => STATION_POS[k];
const inp = (k: StationKind): Vec2 => [at(k)[0] - CELL_HALF_W, at(k)[1]];
const out = (k: StationKind): Vec2 => [at(k)[0] + CELL_HALF_W, at(k)[1]];
const raw = (k: StationKind): Vec2 => [RECEIVING_EDGE, at(k)[1]];

/** The belt running through each cell, between its two rows of machines. */
const cellLines: Conveyor[] = (
	[
		["mill", ["alu_billet", "housing"]],
		["gear_cut", ["steel_blank", "gear_set"]],
		["winding", ["copper_wire", "stator"]],
		["smt", ["pcb_blank", "driver_board"]],
		["motor_asm", ["stator", "motor"]],
		["final_asm", ["housing", "actuator"]],
		["eol_test", ["actuator", "finished_good"]],
	] as [StationKind, Item[]][]
).map(([k, items]) => ({
	id: `${k}-cell`,
	driver: k,
	items,
	points: [inp(k), out(k)],
}));

export const CONVEYORS: Conveyor[] = [
	// Receiving to each feeder cell, one straight run per row.
	{
		id: "r-mill",
		driver: "mill",
		items: ["alu_billet"],
		points: [raw("mill"), inp("mill")],
	},
	{
		id: "r-gear",
		driver: "gear_cut",
		items: ["steel_blank"],
		points: [raw("gear_cut"), inp("gear_cut")],
	},
	{
		id: "r-wind",
		driver: "winding",
		items: ["copper_wire", "laminations"],
		points: [raw("winding"), inp("winding")],
	},
	{
		id: "r-smt",
		driver: "smt",
		items: ["pcb_blank", "encoder_ic"],
		points: [raw("smt"), inp("smt")],
	},
	// Bearings and magnets run between the winding and SMT cells, then join
	// the stator line into motor assembly.
	{
		id: "r-motor",
		driver: "motor_asm",
		items: ["bearing", "magnets"],
		points: [
			[RECEIVING_EDGE, ROW],
			[MOTOR_FEED_X, ROW],
			[MOTOR_FEED_X, at("motor_asm")[1]],
		],
		intoJunction: true,
	},
	{
		id: "wind-motor",
		driver: "winding",
		items: ["stator"],
		points: [out("winding"), inp("motor_asm")],
	},
	// The spine: feeders merge from both sides into the line to final assembly.
	{
		id: "mill-spine",
		driver: "mill",
		items: ["housing"],
		points: [out("mill"), [SPINE_X, at("mill")[1]], [SPINE_X, 0]],
		intoJunction: true,
	},
	{
		id: "gear-spine",
		driver: "gear_cut",
		items: ["gear_set"],
		points: [out("gear_cut"), [SPINE_X, at("gear_cut")[1]]],
		intoJunction: true,
	},
	{
		id: "smt-spine",
		driver: "smt",
		items: ["driver_board"],
		points: [out("smt"), [SPINE_X, at("smt")[1]], [SPINE_X, 0]],
		intoJunction: true,
	},
	{
		id: "motor-spine",
		driver: "motor_asm",
		items: ["motor"],
		points: [out("motor_asm"), [SPINE_X, at("motor_asm")[1]]],
		intoJunction: true,
	},
	{
		id: "spine-final",
		driver: "final_asm",
		items: ["housing", "gear_set", "motor", "driver_board"],
		points: [[SPINE_X, 0], inp("final_asm")],
		fromJunction: true,
	},
	{
		id: "final-eol",
		driver: "final_asm",
		items: ["actuator"],
		points: [out("final_asm"), inp("eol_test")],
	},
	{
		id: "eol-ship",
		driver: "eol_test",
		items: ["finished_good"],
		points: [out("eol_test"), [SHIPPING_EDGE, 0]],
	},
	...cellLines,
];

/** Plant bounds for fitting the camera: [minX, maxX, minZ, maxZ]. */
export const PLANT_BOUNDS = [-27, 34, -12.5, 11] as const;
