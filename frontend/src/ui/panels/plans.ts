import type { InspectionPlan } from "../../sim/types";

const PLAN_OPTIONS: {
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
	return `s${p.percent}`;
}

/** The preset options, plus the current plan if it is not one of them. */
export function planOptions(current: InspectionPlan | undefined) {
	const key = planKey(current);
	if (current?.mode !== "sample" || PLAN_OPTIONS.some((o) => o.key === key)) {
		return PLAN_OPTIONS;
	}
	return [
		...PLAN_OPTIONS,
		{ key, label: `Sample ${current.percent}%`, plan: current },
	];
}

export function planFromKey(key: string): InspectionPlan {
	const preset = PLAN_OPTIONS.find((o) => o.key === key)?.plan;
	if (preset) return preset;
	const percent = Number(key.slice(1));
	return key.startsWith("s") && Number.isInteger(percent) && percent > 0
		? { mode: "sample", percent }
		: { mode: "skip" };
}
