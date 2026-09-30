// Guided first run as coach marks: a pulsing ring on the thing to look at or
// press, a caption of a few words, and the step moves on when the player
// does it. The first step is a picture of the whole game loop.
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Item, View } from "../sim/types";
import type { Speed } from "../sim/useGame";
import type { Tab } from "./Sidebar";
import { Glyph } from "./visual/glyphs";
import { ItemIcon } from "./visual/icons";

interface UiState {
	view: View;
	tab: Tab;
	speed: Speed;
	selected: string | null;
}

interface Step {
	/** CSS selector of the element to ring; none centres the caption. */
	target?: string;
	caption: ReactNode;
	/** When the step is complete. Steps without one show a Next button. */
	done?: (s: UiState) => boolean;
}

const RAW: Item[] = ["alu_billet", "steel_blank", "copper_wire", "pcb_blank"];

/** Parts in, actuators out, trucks, cash. Everything moves. */
function GameLoop() {
	return (
		<div
			className="loop"
			role="img"
			aria-label="Buy parts, build actuators, ship them, get paid"
		>
			<span className="loop-stage">
				{RAW.map((item, i) => (
					<span
						key={item}
						className="drift"
						style={{ animationDelay: `${i * 0.25}s` }}
					>
						<ItemIcon item={item} size={22} />
					</span>
				))}
			</span>
			<span className="loop-arrow" />
			<span className="loop-stage">
				<Glyph name="wrench" size={26} className="spin" />
			</span>
			<span className="loop-arrow" />
			<span className="loop-stage">
				<ItemIcon item="actuator" size={30} />
			</span>
			<span className="loop-arrow" />
			<span className="loop-stage drive">
				<Glyph name="truck" size={30} />
			</span>
			<span className="loop-arrow" />
			<span className="loop-stage">
				<Glyph name="coin" size={28} className="gold bounce" />
			</span>
		</div>
	);
}

const STEPS: Step[] = [
	{
		caption: (
			<>
				<GameLoop />
				<p>Buy parts. Build actuators. Ship. Get paid.</p>
			</>
		),
	},
	{
		target: ".flow-map",
		caption: "Your line. Thin pipe = bottleneck. Tap a station.",
		done: (s) => s.selected !== null,
	},
	{
		target: ".station-card",
		caption: "Ring = machine health. + adds a machine.",
	},
	{
		target: ".contracts .primary",
		caption: "Truck left of the deadline = on time. Accept one.",
		done: (s) => s.view.contracts.some((c) => c.status === "active"),
	},
	{
		target: "#tab-supply",
		caption: "Parts on hand",
		done: (s) => s.tab === "supply",
	},
	{
		target: ".speed",
		caption: "Start the clock",
		done: (s) => s.speed > 0,
	},
	{
		target: ".stat.cash",
		caption: (
			<>
				<Glyph name="truck" size={16} /> 17:00{" "}
				<Glyph name="coin" size={16} className="gold" />
			</>
		),
		done: (s) => s.view.history.some((d) => d.shipped > 0),
	},
	{
		target: "#tab-quality",
		caption: "Defects",
		done: (s) => s.tab === "quality",
	},
	{
		target: ".gates",
		caption: "Catch it early: cheap. At the customer: costly.",
	},
];

/** How often the ring re-reads its target's box. */
const TRACK_MS = 200;

/** The target's box, re-read a few times a second as the layout moves. */
function useTargetBox(selector: string | undefined) {
	const [box, setBox] = useState<DOMRect | null>(null);
	useEffect(() => {
		if (!selector) {
			setBox(null);
			return;
		}
		let prev = "";
		const read = () => {
			const r =
				document.querySelector(selector)?.getBoundingClientRect() ?? null;
			const key = r
				? `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`
				: "";
			if (key !== prev) {
				prev = key;
				setBox(r);
			}
		};
		read();
		const id = window.setInterval(read, TRACK_MS);
		return () => window.clearInterval(id);
	}, [selector]);
	return box;
}

interface Props extends UiState {
	onFinish: () => void;
}

export function Tutorial({ onFinish, ...ui }: Props) {
	const [i, setI] = useState(0);
	const step = STEPS[i];
	const last = i === STEPS.length - 1;
	const complete = step.done?.(ui) ?? false;
	const box = useTargetBox(step.target);

	useEffect(() => {
		if (complete && !last) setI((n) => n + 1);
	}, [complete, last]);

	// Start keyboard users in the tutorial instead of at the top of the page.
	const panel = useRef<HTMLDivElement>(null);
	useEffect(() => panel.current?.focus(), []);

	// The caption sits under the target, or above it near the bottom.
	const pad = 8;
	const width = Math.min(320, window.innerWidth - 24);
	const below = box ? box.bottom + 170 < window.innerHeight : true;
	const style = box
		? {
				left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
				width,
				top: below ? box.bottom + pad + 6 : undefined,
				bottom: below ? undefined : window.innerHeight - box.top + pad + 6,
			}
		: undefined;

	return createPortal(
		<>
			{box && (
				<div
					className="coach-ring"
					aria-hidden="true"
					style={{
						left: box.left - pad,
						top: box.top - pad,
						width: box.width + pad * 2,
						height: box.height + pad * 2,
					}}
				/>
			)}
			<div
				ref={panel}
				className={`coach${box ? "" : " centre"}`}
				role="dialog"
				aria-label="Tutorial"
				tabIndex={-1}
				style={style}
			>
				<div className="caption" aria-live="polite">
					{step.caption}
				</div>
				<div className="coach-foot">
					<span
						className="steps"
						role="img"
						aria-label={`Step ${i + 1} of ${STEPS.length}`}
					>
						{STEPS.map((_, k) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: one dot per step
							<i key={k} className={k < i ? "done" : k === i ? "now" : ""} />
						))}
					</span>
					{!step.done && (
						<button
							type="button"
							className="primary small"
							onClick={() => (last ? onFinish() : setI(i + 1))}
						>
							{last ? "Play" : "Next"}
						</button>
					)}
					{!last && (
						<button type="button" className="ghost small" onClick={onFinish}>
							Skip
						</button>
					)}
				</div>
			</div>
		</>,
		document.body,
	);
}
