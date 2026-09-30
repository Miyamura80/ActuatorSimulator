// How fast the line can go, as the sim computes it. Plain functions, no
// React, so the flow map, station card and forecast share one definition.
import type { InspectionPlan, StationView, View } from "../../sim/types";

/** Share of units an inspection plan looks at, 0 to 1. */
export function inspectedShare(p: InspectionPlan | undefined): number {
	if (!p || p.mode === "skip") return 0;
	if (p.mode === "full") return 1;
	return p.percent / 100;
}

/** Worn machines run slower; mirrors `speed_factor` in the sim. */
const speed = (condition: number) => 0.7 + 0.3 * (condition / 100);
/** A unit the end-of-line bench skips costs this share of a tested one. */
const UNTESTED_COST = 0.15;

/**
 * Units per hour the station can make with the machines that are up, at
 * their current condition. The test bench goes faster the fewer units it
 * tests.
 */
export function capacity(st: StationView, view: View): number {
	const rate = st.machines
		.filter((m) => !m.down_reason)
		.reduce((a, m) => a + st.rate_per_hour * speed(m.condition), 0);
	if (st.kind !== "eol_test") return rate;
	const tested = inspectedShare(view.policies.eol);
	return rate / (tested + (1 - tested) * UNTESTED_COST);
}
