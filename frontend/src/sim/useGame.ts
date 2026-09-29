// Drives the sim from the browser: a fixed-rate loop that steps game hours
// according to the speed setting, pulls a fresh View, keeps a rolling event
// log, and autosaves once per game day.
import { useCallback, useEffect, useRef, useState } from "react";
import { AUTO_SLOT, writeSave } from "./saves";
import type { Action, GameEvent, View } from "./types";
import type { Sim } from "./wasm";

export type Speed = 0 | 1 | 2 | 4;

/** Game hours per real second at 1x. A 90-day run takes ~18 minutes. */
const HOURS_PER_SECOND = 2;
const FRAME_MS = 100;
const EVENT_LOG_SIZE = 200;

export interface Game {
	view: View;
	events: GameEvent[];
	speed: Speed;
	setSpeed: (s: Speed) => void;
	/** Apply an action. Returns null on success or the refusal reason. */
	act: (a: Action) => string | null;
	save: (slot: string, name: string) => Promise<void>;
}

export function useGame(sim: Sim): Game {
	const [view, setView] = useState<View>(() => sim.view(0));
	const [events, setEvents] = useState<GameEvent[]>(() => view.events);
	const [speed, setSpeed] = useState<Speed>(0);
	const seq = useRef(view.next_event_seq);
	const acc = useRef(0);
	const lastDay = useRef(view.day);

	const refresh = useCallback(() => {
		const v = sim.view(seq.current);
		seq.current = v.next_event_seq;
		setView(v);
		if (v.events.length > 0) {
			setEvents((prev) => [...prev, ...v.events].slice(-EVENT_LOG_SIZE));
		}
		return v;
	}, [sim]);

	const save = useCallback(
		async (slot: string, name: string) => {
			const v = sim.view(Number.MAX_SAFE_INTEGER);
			await writeSave(
				{
					slot,
					name,
					day: v.day,
					cash: v.cash,
					difficulty: v.difficulty,
					savedAt: Date.now(),
				},
				sim.save(),
			);
		},
		[sim],
	);

	useEffect(() => {
		if (speed === 0) return;
		const id = window.setInterval(() => {
			acc.current += (HOURS_PER_SECOND * speed * FRAME_MS) / 1000;
			const hours = Math.floor(acc.current);
			if (hours === 0) return;
			acc.current -= hours;
			sim.step(hours);
			const v = refresh();
			if (v.status.state !== "running") {
				setSpeed(0);
			} else if (v.day !== lastDay.current) {
				lastDay.current = v.day;
				save(AUTO_SLOT, "Autosave").catch(() => {});
			}
		}, FRAME_MS);
		return () => window.clearInterval(id);
	}, [speed, sim, refresh, save]);

	const act = useCallback(
		(a: Action) => {
			const err = sim.apply(a);
			refresh();
			return err;
		},
		[sim, refresh],
	);

	return { view, events, speed, setSpeed, act, save };
}
