import type { GameEvent } from "../sim/types";
import { formatTick } from "./format";

export function EventLog({ events }: { events: GameEvent[] }) {
	const recent = [...events].reverse().slice(0, 60);
	return (
		<section className="panel log">
			<h2>Plant log</h2>
			<ul>
				{recent.map((e) => (
					<li key={e.seq} className={`sev-${e.severity}`}>
						<span className="when">{formatTick(e.tick)}</span>
						<span className="msg">{e.message}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
