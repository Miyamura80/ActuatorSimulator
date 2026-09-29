import type { GameEvent } from "../../sim/types";
import { formatTick } from "../format";

export function LogPanel({ events }: { events: GameEvent[] }) {
	const recent = [...events].reverse().slice(0, 120);
	return (
		<div className="panel-body log">
			<ul>
				{recent.map((e) => (
					<li key={e.seq} className={`sev-${e.severity}`}>
						<span className="when">{formatTick(e.tick)}</span>
						<span className="msg">{e.message}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
