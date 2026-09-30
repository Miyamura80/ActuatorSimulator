// Where defects get caught. Parts flow left to right through two gates;
// each bin under the pipeline is what was caught there, and the coins say
// what one catch there costs. Catching early is cheap.
import type { InspectionPlan, View } from "../../sim/types";
import { inspectedShare, SampleGate } from "./gauges";
import { Glyph } from "./glyphs";

interface Props {
	view: View;
	/** Days of history to count. */
	days: number;
	onEol: (p: InspectionPlan) => void;
}

function Coins({ n }: { n: number }) {
	return (
		<span className="coins" role="img" aria-label={`cost level ${n} of 3`}>
			{[0, 1, 2].map((i) => (
				<Glyph key={i} name="coin" size={12} className={i < n ? "lit" : ""} />
			))}
		</span>
	);
}

/** Average share of purchased-part units inspected on arrival. */
function iqcShare(view: View) {
	const plans = view.stock
		.filter((s) => s.purchased)
		.map((s) => inspectedShare(view.policies.iqc[s.item]));
	return plans.reduce((a, b) => a + b, 0) / Math.max(plans.length, 1);
}

export function QualityGates({ view, days, onEol }: Props) {
	const h = view.history.slice(-days);
	const sum = (f: (d: (typeof h)[number]) => number) =>
		h.reduce((a, d) => a + f(d), 0);
	const bins = [
		{
			id: "iqc",
			glyph: "truck" as const,
			count: sum((d) => d.iqc_rejects),
			unit: "lots",
			coins: 1,
			title: "Bad lots sent back to the supplier (refunded)",
		},
		{
			id: "eol",
			glyph: "cross" as const,
			count: sum((d) => d.scrapped),
			unit: "units",
			coins: 2,
			title: "Units scrapped in the plant",
		},
		{
			id: "field",
			glyph: "back" as const,
			count: sum((d) => d.field_failures),
			unit: "units",
			coins: 3,
			title: "Units that failed at customers ($420 each and reputation)",
		},
	];
	const iqc = iqcShare(view);
	const eol = inspectedShare(view.policies.eol);
	return (
		<div className="gates">
			<div className="gate-line">
				<span className="end">
					<Glyph name="truck" size={20} />
				</span>
				<span className="flow" />
				<span
					className={`gate${iqc > 0 ? " open" : " shut"}`}
					title="Incoming inspection"
				>
					<Glyph name="eye" size={16} />
					<span className="sr-only">Incoming inspection</span>
					<span className="share">{Math.round(iqc * 100)}%</span>
				</span>
				<span className="flow" />
				<span className="end plant">
					<Glyph name="wrench" size={18} />
				</span>
				<span className="flow" />
				<span
					className={`gate${eol > 0 ? " open" : " shut"}`}
					title="End-of-line test"
				>
					<Glyph name="eye" size={16} />
					<span className="sr-only">End-of-line test</span>
					<span className="share">{Math.round(eol * 100)}%</span>
				</span>
				<span className="flow" />
				<span className="end">
					<Glyph name="user" size={20} />
				</span>
			</div>
			<div className="bins">
				{bins.map((b) => (
					<div key={b.id} className={`bin ${b.id}`} title={b.title}>
						<span className="count">
							<Glyph name={b.glyph} size={14} />
							<span className="num">{b.count}</span>
							<span className="muted small">{b.unit}</span>
						</span>
						<Coins n={b.coins} />
					</div>
				))}
			</div>
			<div className="knob">
				<Glyph name="eye" size={14} title="End-of-line test" />
				<SampleGate
					label="End-of-line test"
					plan={view.policies.eol}
					onChange={onEol}
				/>
			</div>
		</div>
	);
}
