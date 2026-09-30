import type { StationKind } from "../../sim/types";
import type { BeaconState } from "../palette";
import { Beacon, RobotCell, TestBench } from "./Assembly";
import { GearCut, Mill } from "./Cutting";
import { Smt, Winder } from "./Electrical";

export { Beacon };

/** The model for one machine of a station. Faces +z. */
export function MachineModel({
	kind,
	busy,
	beacon,
}: {
	kind: StationKind;
	busy: boolean;
	beacon: BeaconState;
}) {
	switch (kind) {
		case "mill":
			return <Mill busy={busy} />;
		case "gear_cut":
			return <GearCut busy={busy} />;
		case "winding":
			return <Winder busy={busy} />;
		case "smt":
			return <Smt busy={busy} />;
		case "motor_asm":
			return <RobotCell busy={busy} product="motor" />;
		case "final_asm":
			return <RobotCell busy={busy} product="actuator" />;
		case "eol_test":
			return <TestBench busy={busy} beacon={beacon} />;
	}
}
