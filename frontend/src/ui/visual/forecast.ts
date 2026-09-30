// Rough delivery forecast for the contract board: the line's bottleneck rate
// works through contracts in deadline order, the way the sim ships them.
import type { Contract, View } from "../../sim/types";
import { capacity } from "./FlowMap";

/** Finished units per game hour, averaged over the day (shifts included). */
function hourlyOutput(view: View): number {
	const bottleneck = Math.min(...view.stations.map((s) => capacity(s, view)));
	const hoursPerDay = Math.min(3, view.policies.shifts) * 8;
	// The same 90% the autopilot plans with: lots, changeovers, small stalls.
	return (bottleneck * 0.9 * hoursPerDay) / 24;
}

/** Hour of day the sim ships finished goods (`SHIP_HOUR` in contracts.rs). */
const SHIP_HOUR = 17;

const dueTick = (view: View, c: Contract) =>
	c.deadline ?? view.tick + c.lead_days * 24;

/**
 * Hours from now until each contract would be fully delivered, if `extra`
 * (an offer) were accepted too. Infinity when nothing can be built.
 */
export function forecast(view: View, extra?: Contract): Map<number, number> {
	const queue = view.contracts.filter((c) => c.status === "active");
	if (extra && extra.status === "offered") queue.push(extra);
	queue.sort((a, b) => dueTick(view, a) - dueTick(view, b));
	const rate = hourlyOutput(view);
	let stock = view.stock.find((s) => s.item === "finished_good")?.qty ?? 0;
	let hours = 0;
	const out = new Map<number, number>();
	for (const c of queue) {
		let need = c.qty - c.delivered;
		const fromStock = Math.min(stock, need);
		stock -= fromStock;
		need -= fromStock;
		hours += need === 0 ? 0 : rate > 0 ? need / rate : Number.POSITIVE_INFINITY;
		out.set(c.id, shipsAfter(view, hours));
	}
	return out;
}

/**
 * Hours from now until goods finished `hours` from now leave on a truck:
 * the next 17:00 ship window, and never while auto-ship is off.
 */
function shipsAfter(view: View, hours: number): number {
	if (!view.policies.auto_ship || !Number.isFinite(hours))
		return Number.POSITIVE_INFINITY;
	const done = view.tick + Math.ceil(hours);
	const day = Math.floor(done / 24) + (done % 24 > SHIP_HOUR ? 1 : 0);
	return day * 24 + SHIP_HOUR - view.tick;
}

export function hoursUntilDue(view: View, c: Contract): number {
	return dueTick(view, c) - view.tick;
}
