import type { StationView, View } from "../sim/types";

type Status = { label: string; tone: "ok" | "idle" | "warn" | "bad" };

function stationStatus(st: StationView, view: View): Status {
	if (st.machines.some((m) => m.down_reason === "breakdown")) {
		return { label: "Broken down", tone: "bad" };
	}
	if (st.spc_alarm) return { label: "SPC alarm", tone: "warn" };
	if (st.machines.every((m) => m.down_reason === "maintenance")) {
		return { label: "Maintenance", tone: "idle" };
	}
	if (!view.operating) return { label: "Off shift", tone: "idle" };
	if (st.busy) return { label: "Running", tone: "ok" };
	if (st.starved_on) {
		const item = view.stock.find((s) => s.item === st.starved_on);
		return { label: `Waiting: ${item?.label ?? st.starved_on}`, tone: "warn" };
	}
	return { label: "Blocked (buffer full)", tone: "idle" };
}

export function LineBoard({ view }: { view: View }) {
	const stockOf = (item: string) =>
		view.stock.find((s) => s.item === item)?.qty ?? 0;
	return (
		<section className="panel line">
			<h2>Production line</h2>
			<div className="stations">
				{view.stations.map((st) => {
					const status = stationStatus(st, view);
					const avg =
						st.machines.reduce((a, m) => a + m.condition, 0) /
						st.machines.length;
					return (
						<article key={st.kind} className={`station tone-${status.tone}`}>
							<header>
								<span className="light" />
								<strong>{st.label}</strong>
							</header>
							<div className="status">{status.label}</div>
							<dl>
								<dt>Machines</dt>
								<dd>{st.machines.length}</dd>
								<dt>Condition</dt>
								<dd>
									<span className="meter">
										<span style={{ width: `${avg}%` }} />
									</span>
								</dd>
								<dt>Buffer</dt>
								<dd>{stockOf(st.output)}</dd>
								<dt>Built / scrap</dt>
								<dd>
									{st.units_built} / {st.units_scrapped}
								</dd>
							</dl>
						</article>
					);
				})}
			</div>
		</section>
	);
}
