import type { View } from "./sim/types";

export type Mode =
	| { kind: "sandbox" }
	| { kind: "tutorial" }
	| { kind: "daily"; date: string };

/** A daily challenge runs this many game days on Normal. */
export const DAILY_DAYS = 30;

export function todayUtc(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Everyone gets the same plant for a given date (FNV-1a of the date). */
export function dailySeed(date: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < date.length; i++) {
		h ^= date.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

/** Cash plus reputation, where each reputation point is worth $2,000. */
export function dailyScore(v: View): number {
	if (v.status.state === "bankrupt") return 0;
	return Math.max(0, Math.round(v.cash + v.reputation * 2000));
}

export function modeLabel(m: Mode): string {
	switch (m.kind) {
		case "daily":
			return `Daily ${m.date}`;
		case "tutorial":
			return "Tutorial";
		case "sandbox":
			return "Sandbox";
	}
}
