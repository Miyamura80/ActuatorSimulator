import type { InspectionPlan } from "../../sim/types";

export const PLAN_OPTIONS: {
	key: string;
	label: string;
	plan: InspectionPlan;
}[] = [
	{ key: "skip", label: "Skip", plan: { mode: "skip" } },
	{ key: "s5", label: "Sample 5%", plan: { mode: "sample", percent: 5 } },
	{ key: "s10", label: "Sample 10%", plan: { mode: "sample", percent: 10 } },
	{ key: "s25", label: "Sample 25%", plan: { mode: "sample", percent: 25 } },
	{ key: "full", label: "100%", plan: { mode: "full" } },
];

export function planKey(p: InspectionPlan | undefined): string {
	if (!p || p.mode === "skip") return "skip";
	if (p.mode === "full") return "full";
	const match = PLAN_OPTIONS.find(
		(o) => o.plan.mode === "sample" && o.plan.percent === p.percent,
	);
	return match?.key ?? "s5";
}

export function planFromKey(key: string): InspectionPlan {
	return PLAN_OPTIONS.find((o) => o.key === key)?.plan ?? { mode: "skip" };
}
