import type { StationView } from "../sim/types";
import type { BeaconState } from "./palette";

/** What a station's stack light shows. Kept free of three.js imports. */
export function beaconState(st: StationView, operating: boolean): BeaconState {
	const broken = st.machines.some((m) => m.down_reason === "breakdown");
	// "Broken" only when nothing at the station can run.
	if (broken && st.machines.every((m) => m.down_reason)) return "broken";
	if (broken) return "degraded";
	if (st.spc_alarm) return "alarm";
	if (st.machines.every((m) => m.down_reason === "maintenance"))
		return "maintenance";
	if (!operating) return "off";
	if (st.busy) return "running";
	if (st.starved_on) return "starved";
	return "off";
}
