import type { Game } from "../../sim/useGame";
import { BarChart, LineChart, Pareto } from "../charts";
import { formatMoney, formatMoneyCompact } from "../format";

function sum<T>(rows: T[], f: (r: T) => number) {
	return rows.reduce((a, r) => a + f(r), 0);
}

export function StatsPanel({ game }: { game: Game }) {
	const { view } = game;
	const h = view.history;
	const week = h.slice(-7);
	const days = h.map((d) => d.day);
	const revenue7 = sum(week, (d) => d.revenue);
	const profit7 = revenue7 - sum(week, (d) => d.costs);
	const produced = sum(week, (d) => d.produced);
	const scrapped = sum(week, (d) => d.scrapped);
	const yieldPct =
		produced + scrapped > 0 ? (produced / (produced + scrapped)) * 100 : 100;
	const shippedAll = sum(h, (d) => d.shipped);
	const failuresAll = sum(h, (d) => d.field_failures);
	const l = view.ledger;
	const money = (v: number) => formatMoney(v);
	return (
		<div className="panel-body">
			<div className="kpis">
				<div className="kpi">
					<span className="k">Revenue, 7 days</span>
					<span className="v">{formatMoney(revenue7)}</span>
				</div>
				<div className="kpi">
					<span className="k">Profit, 7 days</span>
					<span className={profit7 < 0 ? "v bad" : "v"}>
						{formatMoney(profit7)}
					</span>
				</div>
				<div className="kpi">
					<span className="k">First-pass yield</span>
					<span className="v">{yieldPct.toFixed(1)}%</span>
				</div>
				<div className="kpi">
					<span className="k">Field failures</span>
					<span className="v">
						{shippedAll > 0
							? ((failuresAll / shippedAll) * 100).toFixed(2)
							: "0.00"}
						%
					</span>
				</div>
			</div>
			<h3>Cash</h3>
			<LineChart
				title="Cash by day"
				values={h.map((d) => d.cash)}
				xs={days}
				format={formatMoneyCompact}
			/>
			<h3>Units shipped per day</h3>
			<BarChart
				title="Units shipped by day"
				values={h.map((d) => d.shipped)}
				xs={days}
				format={(v) => String(Math.round(v))}
			/>
			<h3>Where the money went (all time)</h3>
			<Pareto
				format={money}
				rows={[
					{ label: "Materials", value: l.materials - l.refunds },
					{ label: "Labor", value: l.labor },
					{ label: "Machines", value: l.capex },
					{ label: "Overhead", value: l.overhead },
					{ label: "Maintenance & repairs", value: l.maintenance },
					{ label: "RMAs", value: l.rma },
					{ label: "Recalls", value: l.recalls },
					{ label: "Late penalties", value: l.penalties },
					{ label: "Inspection", value: l.inspection },
				]}
			/>
			<h3>Quality losses (counts, all time)</h3>
			<Pareto
				format={(v) => String(v)}
				rows={[
					{ label: "Scrapped in plant", value: sum(h, (d) => d.scrapped) },
					{ label: "Failed at customers", value: failuresAll },
					{
						label: "Lots rejected at IQC",
						value: sum(h, (d) => d.iqc_rejects),
					},
					{ label: "Machine breakdowns", value: sum(h, (d) => d.breakdowns) },
				]}
			/>
		</div>
	);
}
