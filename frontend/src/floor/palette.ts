import * as THREE from "three";
import type { Item } from "../sim/types";
import { BEACON, type BeaconState, ITEM_COLOR } from "../ui/visual/colors";

export { BEACON, type BeaconState };

const COLORS = {
	floor: "#3a3f45",
	pad: "#2f3a3c",
	padHover: "#3a4a4d",
	walkway: "#f2b705",
	steel: "#9aa4ae",
	steelDark: "#434a52",
	body: "#dfe3e7",
	accent: "#f2b705",
	glass: "#8fc3e0",
	belt: "#1b1e21",
	rail: "#7d8791",
	dock: "#50575f",
	crate: "#b07a44",
	pallet: "#8a6a45",
	wall: "#5a6068",
};

// Shared PBR materials. Machines reuse these instead of making one per mesh.
const std = (color: string, metalness: number, roughness: number) =>
	new THREE.MeshStandardMaterial({ color, metalness, roughness });

export const MAT = {
	/** Painted sheet metal, the machine enclosures. */
	paint: std(COLORS.body, 0.15, 0.45),
	/** Safety-yellow paint for moving parts and guards. */
	accent: std(COLORS.accent, 0.2, 0.4),
	steel: std(COLORS.steel, 0.85, 0.3),
	steelDark: std(COLORS.steelDark, 0.7, 0.45),
	chrome: std("#e8edf2", 1, 0.12),
	rubber: std("#16181a", 0, 0.85),
	copper: std("#c46a2a", 0.9, 0.3),
	pcb: std("#1f7a44", 0.1, 0.5),
	chip: std("#202328", 0.2, 0.4),
	glass: new THREE.MeshPhysicalMaterial({
		color: COLORS.glass,
		metalness: 0,
		roughness: 0.05,
		transmission: 0,
		transparent: true,
		opacity: 0.35,
	}),
	screenOff: std("#0e1418", 0.3, 0.25),
	screenOn: new THREE.MeshStandardMaterial({
		color: "#0d2a1c",
		emissive: "#3ec27a",
		emissiveIntensity: 1.4,
		roughness: 0.3,
	}),
	ledOn: new THREE.MeshStandardMaterial({
		color: "#3ec27a",
		emissive: "#3ec27a",
		emissiveIntensity: 2,
		toneMapped: false,
	}),
	lamp: new THREE.MeshStandardMaterial({
		color: "#fff6d8",
		emissive: "#fff2c0",
		emissiveIntensity: 1.5,
	}),
	paintWhite: std("#e9ecef", 0, 0.7),
	window: new THREE.MeshStandardMaterial({
		color: "#9fc4dc",
		emissive: "#8fb8d6",
		emissiveIntensity: 0.6,
		roughness: 0.1,
	}),
	column: std("#3f5f7f", 0.5, 0.5),
	rackBlue: std("#2f5fa3", 0.4, 0.5),
	rackOrange: std("#e0701f", 0.3, 0.5),
	selectGlow: new THREE.MeshBasicMaterial({
		color: "#f2b705",
		toneMapped: false,
	}),
	hoverGlow: new THREE.MeshBasicMaterial({
		color: "#8a7a3a",
		toneMapped: false,
	}),
	bay: new THREE.MeshStandardMaterial({
		color: "#3b4a4c",
		roughness: 0.9,
	}),
	motor: std("#4f79c7", 0.6, 0.35),
	tote: std("#2f6fb3", 0, 0.6),
	rail: std(COLORS.rail, 0.8, 0.35),
	frame: std("#2d3237", 0.6, 0.5),
	wood: std(COLORS.pallet, 0, 0.85),
	cardboard: std(COLORS.crate, 0, 0.9),
	tape: std("#d9c7a0", 0, 0.7),
	concrete: std(COLORS.dock, 0, 0.9),
	wall: std(COLORS.wall, 0.1, 0.8),
	truckCab: std("#c9362c", 0.3, 0.35),
	tire: std("#111214", 0, 0.9),
};

const itemMats = new Map<Item, THREE.MeshStandardMaterial>();

/** One shared material per belt item. */
export function itemMaterial(item: Item): THREE.MeshStandardMaterial {
	let m = itemMats.get(item);
	if (!m) {
		m = std(ITEM_COLOR[item], 0.5, 0.4);
		itemMats.set(item, m);
	}
	return m;
}

const tints = new Map<string, THREE.MeshStandardMaterial>();

/** A shared plastic material in any color. */
export function tinted(color: string): THREE.MeshStandardMaterial {
	let m = tints.get(color);
	if (!m) {
		m = std(color, 0.05, 0.5);
		tints.set(color, m);
	}
	return m;
}
