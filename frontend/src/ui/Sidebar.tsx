import type { Game } from "../sim/useGame";
import { ContractsPanel } from "./panels/ContractsPanel";
import { LogPanel } from "./panels/LogPanel";
import { QualityPanel } from "./panels/QualityPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { SupplyPanel } from "./panels/SupplyPanel";

export type Tab = "contracts" | "supply" | "quality" | "stats" | "log";

interface Props {
	game: Game;
	tab: Tab;
	setTab: (t: Tab) => void;
	traceLot: number | null;
	setTraceLot: (lot: number | null) => void;
}

export function Sidebar({ game, tab, setTab, traceLot, setTraceLot }: Props) {
	const { view } = game;
	const offers = view.contracts.filter((c) => c.status === "offered").length;
	const alarms = view.stations.filter((s) => s.spc_alarm).length;
	const late = view.orders.filter((o) => o.late).length;
	const tabs: { id: Tab; label: string; badge?: number; tone?: string }[] = [
		{ id: "contracts", label: "Contracts", badge: offers },
		{ id: "supply", label: "Supply", badge: late, tone: "warn" },
		{ id: "quality", label: "Quality", badge: alarms, tone: "warn" },
		{ id: "stats", label: "Stats" },
		{ id: "log", label: "Log" },
	];
	return (
		<aside className="sidebar">
			<div className="tabs" role="tablist">
				{tabs.map((t) => (
					<button
						type="button"
						role="tab"
						key={t.id}
						aria-selected={tab === t.id}
						className={tab === t.id ? "on" : ""}
						onClick={() => setTab(t.id)}
					>
						{t.label}
						{t.badge ? (
							<span className={`badge ${t.tone ?? ""}`}>{t.badge}</span>
						) : null}
					</button>
				))}
			</div>
			<div className="tab-body">
				{tab === "contracts" && <ContractsPanel game={game} />}
				{tab === "supply" && <SupplyPanel game={game} />}
				{tab === "quality" && (
					<QualityPanel
						game={game}
						traceLot={traceLot}
						setTraceLot={setTraceLot}
					/>
				)}
				{tab === "stats" && <StatsPanel game={game} />}
				{tab === "log" && <LogPanel events={game.events} />}
			</div>
		</aside>
	);
}
