// Guided first run: each step waits for the player to do the thing it
// describes, then moves on.
import { useEffect, useState } from "react";
import type { View } from "../sim/types";
import type { Speed } from "../sim/useGame";
import type { Tab } from "./Sidebar";

interface UiState {
	view: View;
	tab: Tab;
	speed: Speed;
	selected: string | null;
}

interface Step {
	title: string;
	body: string;
	/** When the step is complete. Steps without one show a Next button. */
	done?: (s: UiState) => boolean;
}

const STEPS: Step[] = [
	{
		title: "Welcome to Actuator Works",
		body: "You run a small plant that builds robot joint actuators: a motor, an encoder, a harmonic gearbox and a driver board in one housing. Parts come in on the left, finished actuators ship on the right.",
	},
	{
		title: "Your line",
		body: "Seven stations turn parts into actuators. Click any machine (or a name in the strip at the bottom) to see its condition, maintenance and SPC chart.",
		done: (s) => s.selected !== null,
	},
	{
		title: "Win some work",
		body: "Customers post contracts on the right. Check the quantity against the deadline, then accept one. Late deliveries cost money and reputation.",
		done: (s) => s.view.contracts.some((c) => c.status === "active"),
	},
	{
		title: "Keep parts coming",
		body: "Open the Supply tab. Each part has a supplier, an inspection plan and a reorder point. Cheap suppliers are tempting; their bad lots are not.",
		done: (s) => s.tab === "supply",
	},
	{
		title: "Start the clock",
		body: "Press Space or 1× to run time. 2× and 4× speed things up. The line runs one shift (08:00 to 16:00) until you add more.",
		done: (s) => s.speed > 0,
	},
	{
		title: "First shipment",
		body: "Finished actuators ship to your active contracts every day at 17:00. Watch cash in the top bar.",
		done: (s) => s.view.history.some((d) => d.shipped > 0),
	},
	{
		title: "Quality is the game",
		body: "Open the Quality tab. SPC charts flag drifting machines before they make scrap. Defects that escape come back weeks later as returns; trace the lot and recall it before more fail.",
		done: (s) => s.tab === "quality",
	},
	{
		title: "You're on your own",
		body: "Stay above the overdraft limit, keep reputation up to win bigger contracts, and keep an eye on the red cards. Good luck.",
	},
];

interface Props extends UiState {
	onFinish: () => void;
}

export function Tutorial({ onFinish, ...ui }: Props) {
	const [i, setI] = useState(0);
	const step = STEPS[i];
	const last = i === STEPS.length - 1;
	const complete = step.done?.(ui) ?? false;

	useEffect(() => {
		if (complete && !last) setI((n) => n + 1);
	}, [complete, last]);

	return (
		<div className="tutorial" role="dialog" aria-label="Tutorial">
			<div className="hazard" />
			<div className="tut-body">
				<span className="muted small">
					Step {i + 1} of {STEPS.length}
				</span>
				<h2>{step.title}</h2>
				<p>{step.body}</p>
				<div className="actions">
					{!step.done && (
						<button
							type="button"
							className="primary"
							onClick={() => (last ? onFinish() : setI(i + 1))}
						>
							{last ? "Finish" : "Next"}
						</button>
					)}
					{step.done && <span className="muted small">Waiting for you…</span>}
					{!last && (
						<button type="button" className="ghost" onClick={onFinish}>
							Skip tutorial
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
