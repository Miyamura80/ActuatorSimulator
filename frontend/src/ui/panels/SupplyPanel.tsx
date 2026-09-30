import { useEffect, useRef, useState } from "react";
import type { Item } from "../../sim/types";
import type { Game } from "../../sim/useGame";
import { formatMoney } from "../format";
import { IntField } from "../IntField";
import {
	LotRecord,
	Road,
	SampleGate,
	StockGauge,
	TierStars,
} from "../visual/gauges";
import { Glyph } from "../visual/glyphs";
import { ItemIcon } from "../visual/icons";

export interface PartFocus {
	item: Item;
	/** Bumped on every pick, so picking the same part again still opens it. */
	n: number;
}

function PartRow({
	game,
	item,
	open,
	onToggle,
}: {
	game: Game;
	item: Item;
	open: boolean;
	onToggle: () => void;
}) {
	const { view, act } = game;
	const [qty, setQty] = useState(200);
	const [expedite, setExpedite] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const row = useRef<HTMLLIElement>(null);
	useEffect(() => {
		if (open) row.current?.scrollIntoView({ block: "nearest" });
	}, [open]);
	const stock = view.stock.find((s) => s.item === item);
	const policy = view.policies.reorder[item];
	const suppliers = view.suppliers.filter((s) => s.item === item);
	if (!stock || !policy) return null;
	const current = suppliers.find((s) => s.id === policy.supplier);
	// The sim rounds small orders up to the supplier minimum; make that visible
	// instead of charging for units the player did not ask for.
	const belowMin = current !== undefined && qty < current.min_order;
	const setPolicy = (patch: Partial<typeof policy>) =>
		setError(act({ type: "set_reorder", item, ...policy, ...patch }));
	const scale = Math.max(
		policy.reorder_point * 2,
		stock.qty + stock.on_order,
		policy.order_qty,
	);

	return (
		<li className={`part${open ? " open" : ""}`} ref={row}>
			<button
				type="button"
				className="part-head"
				onClick={onToggle}
				aria-expanded={open}
			>
				<ItemIcon item={item} size={22} />
				<span className="part-name">{stock.label}</span>
				<StockGauge
					qty={stock.qty}
					incoming={stock.on_order}
					reorder={policy.enabled ? policy.reorder_point : 0}
					scale={scale}
				/>
				<span className="num">{stock.qty}</span>
			</button>
			{open && (
				<div className="part-body">
					<div className="supplier-cards">
						{suppliers
							.filter((s) => s.active)
							.map((s) => (
								<button
									type="button"
									aria-pressed={s.id === policy.supplier}
									key={s.id}
									className={`supplier${s.id === policy.supplier ? " on" : ""}`}
									onClick={() => setPolicy({ supplier: s.id })}
									title={s.name}
								>
									<TierStars tier={s.tier} />
									<span className={s.price_spike ? "price spike" : "price"}>
										{formatMoney(s.price)}
										{s.price_spike && <Glyph name="alert" size={11} />}
									</span>
									<span className="lead">
										<Glyph name="truck" size={13} />
										{s.lead_days}d
									</span>
									<LotRecord
										received={s.lots_received}
										rejected={s.lots_rejected}
									/>
									<span className="name">{s.name}</span>
								</button>
							))}
					</div>
					<div className="knob">
						<Glyph name="eye" size={14} title="Incoming inspection" />
						<SampleGate
							label="Incoming inspection"
							plan={view.policies.iqc[item]}
							onChange={(plan) =>
								setError(act({ type: "set_iqc", item, plan }))
							}
						/>
					</div>
					<div className="knob reorder">
						<label className="check" title="Reorder automatically">
							<input
								type="checkbox"
								checked={policy.enabled}
								onChange={(e) => setPolicy({ enabled: e.target.checked })}
							/>
							Auto
						</label>
						<span className="muted small">below</span>
						<IntField
							label="Reorder below"
							min={0}
							value={policy.reorder_point}
							onCommit={(n) => setPolicy({ reorder_point: n })}
						/>
						<span className="muted small">buy</span>
						<IntField
							label="Reorder quantity"
							min={1}
							value={policy.order_qty}
							onCommit={(n) => setPolicy({ order_qty: n })}
						/>
					</div>
					<div className="order-row">
						<IntField
							label="Order quantity"
							min={1}
							value={qty}
							onCommit={setQty}
						/>
						<button
							type="button"
							className={expedite ? "toggle on" : "toggle"}
							aria-pressed={expedite}
							onClick={() => setExpedite(!expedite)}
							title="Air freight: +50% cost, about a third of the lead time"
						>
							<Glyph name="bolt" size={13} /> Air
						</button>
						<button
							type="button"
							className="primary"
							disabled={belowMin}
							onClick={() =>
								setError(
									act({
										type: "place_order",
										supplier: policy.supplier,
										qty,
										expedite,
									}),
								)
							}
						>
							Order
						</button>
						{current && belowMin && (
							<span className="warn-text small">min {current.min_order}</span>
						)}
					</div>
					{error && (
						<p className="error" role="alert">
							{error}
						</p>
					)}
				</div>
			)}
		</li>
	);
}

export function SupplyPanel({
	game,
	focusPart,
}: {
	game: Game;
	focusPart: PartFocus | null;
}) {
	const { view } = game;
	const [open, setOpen] = useState<Item | null>(focusPart?.item ?? null);
	useEffect(() => {
		if (focusPart) setOpen(focusPart.item);
	}, [focusPart]);
	const purchased = view.stock.filter((s) => s.purchased);
	const supplierName = (id: number) =>
		view.suppliers.find((s) => s.id === id)?.name ?? "?";
	return (
		<div className="panel-body">
			<ul className="parts">
				{purchased.map((s) => (
					<PartRow
						key={s.item}
						game={game}
						item={s.item}
						open={open === s.item}
						onToggle={() => setOpen(open === s.item ? null : s.item)}
					/>
				))}
			</ul>
			<h3>
				<Glyph name="truck" size={14} /> On the road
			</h3>
			{view.orders.length === 0 && <p className="muted">Nothing.</p>}
			<Road
				now={view.tick}
				orders={view.orders.map((o) => ({
					id: o.id,
					placed: o.placed,
					promised: o.promised,
					late: o.late,
					expedited: o.expedited,
					icon: (
						<>
							<ItemIcon item={o.item} size={16} />
							<span className="num small">{o.qty}</span>
						</>
					),
					title: `${o.qty} from ${supplierName(o.supplier)}`,
				}))}
			/>
		</div>
	);
}
