// Incident cards: critical events pop up over the floor for a few seconds,
// with a shortcut to the relevant tool.
import { useEffect, useRef, useState } from "react";
import type { GameEvent } from "../sim/types";

const SHOW_MS = 9000;
const MAX = 3;

interface Props {
	events: GameEvent[];
	onTrace: (lot: number) => void;
	onStation: (kind: string) => void;
}

export function Toasts({ events, onTrace, onStation }: Props) {
	const [shown, setShown] = useState<GameEvent[]>([]);
	const lastSeq = useRef(
		events.length > 0 ? events[events.length - 1].seq : -1,
	);
	// Each batch owns its dismiss timer. They must survive later event
	// updates (a cleanup per update would cancel them), so they are only
	// cleared on unmount.
	const timers = useRef(new Set<number>());
	useEffect(() => {
		const pending = timers.current;
		return () => {
			for (const t of pending) window.clearTimeout(t);
		};
	}, []);

	useEffect(() => {
		const fresh = events.filter(
			(e) => e.seq > lastSeq.current && e.severity === "critical",
		);
		if (events.length > 0) lastSeq.current = events[events.length - 1].seq;
		if (fresh.length === 0) return;
		// Repeats of the same incident collapse into one card with a count.
		setShown((prev) => {
			const next = [...prev];
			for (const e of fresh) {
				const same = next.findIndex((x) => x.message === e.message);
				if (same >= 0) {
					const repeats = Number(next[same].kind.repeats ?? 1) + 1;
					next[same] = { ...e, kind: { ...e.kind, repeats } };
				} else next.push(e);
			}
			return next.slice(-MAX);
		});
		const ids = new Set(fresh.map((e) => e.seq));
		const t = window.setTimeout(() => {
			timers.current.delete(t);
			setShown((prev) => prev.filter((e) => !ids.has(e.seq)));
		}, SHOW_MS);
		timers.current.add(t);
	}, [events]);

	if (shown.length === 0) return null;
	return (
		<div className="toasts" aria-live="polite">
			{shown.map((e) => {
				const lot = typeof e.kind.lot === "number" ? e.kind.lot : null;
				const station =
					typeof e.kind.station === "string" ? e.kind.station : null;
				return (
					<div key={e.seq} className="toast">
						<span className="msg">
							{e.message}
							{Number(e.kind.repeats ?? 1) > 1 && (
								<strong> ×{String(e.kind.repeats)}</strong>
							)}
						</span>
						{lot !== null && (
							<button
								type="button"
								className="ghost small"
								onClick={() => onTrace(lot)}
							>
								Trace lot
							</button>
						)}
						{station !== null && (
							<button
								type="button"
								className="ghost small"
								onClick={() => onStation(station)}
							>
								Inspect
							</button>
						)}
						<button
							type="button"
							className="ghost small"
							aria-label="Dismiss"
							onClick={() =>
								setShown((prev) => prev.filter((x) => x.seq !== e.seq))
							}
						>
							×
						</button>
					</div>
				);
			})}
		</div>
	);
}
