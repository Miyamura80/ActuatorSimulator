import { useState } from "react";
import type { Item, SupplierView } from "../../sim/types";
import type { Game } from "../../sim/useGame";
import { formatMoney, formatTick } from "../format";
import { PLAN_OPTIONS, planFromKey, planKey } from "./plans";

function tierLabel(s: SupplierView) {
	const record =
		s.lots_received > 0
			? ` · ${s.lots_rejected}/${s.lots_received} rejected`
			: "";
	return `${s.tier}${record}`;
}

function PartRow({ game, item }: { game: Game; item: Item }) {
	const { view, act } = game;
	const [open, setOpen] = useState(false);
	const [qty, setQty] = useState(200);
	const [expedite, setExpedite] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const stock = view.stock.find((s) => s.item === item);
	const policy = view.policies.reorder[item];
	const suppliers = view.suppliers.filter((s) => s.item === item);
	if (!stock || !policy) return null;
	const current = suppliers.find((s) => s.id === policy.supplier);
	const setPolicy = (patch: Partial<typeof policy>) =>
		setError(act({ type: "set_reorder", item, ...policy, ...patch }));

	return (
		<li className="part">
			<button
				type="button"
				className="part-head"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
			>
				<strong>{stock.label}</strong>
				<span className="num">{stock.qty}</span>
				<span className="muted num">+{stock.on_order} on order</span>
				<span className={current?.price_spike ? "warn-text" : "muted"}>
					{current?.name ?? "no supplier"}
				</span>
			</button>
			{open && (
				<div className="part-body">
					<div className="grid2">
						<label>
							Supplier
							<select
								value={policy.supplier}
								onChange={(e) =>
									setPolicy({ supplier: Number(e.target.value) })
								}
							>
								{suppliers
									.filter((s) => s.active)
									.map((s) => (
										<option key={s.id} value={s.id}>
											{s.name} · {formatMoney(s.price)} · {s.lead_days}d ·{" "}
											{s.tier}
										</option>
									))}
							</select>
						</label>
						<label>
							Incoming inspection
							<select
								value={planKey(view.policies.iqc[item])}
								onChange={(e) =>
									setError(
										act({
											type: "set_iqc",
											item,
											plan: planFromKey(e.target.value),
										}),
									)
								}
							>
								{PLAN_OPTIONS.map((o) => (
									<option key={o.key} value={o.key}>
										{o.label}
									</option>
								))}
							</select>
						</label>
						<label>
							Reorder below
							<input
								type="number"
								min={0}
								value={policy.reorder_point}
								onChange={(e) =>
									setPolicy({
										reorder_point: Math.max(0, Number(e.target.value)),
									})
								}
							/>
						</label>
						<label>
							Order quantity
							<input
								type="number"
								min={1}
								value={policy.order_qty}
								onChange={(e) =>
									setPolicy({ order_qty: Math.max(1, Number(e.target.value)) })
								}
							/>
						</label>
					</div>
					<label className="check">
						<input
							type="checkbox"
							checked={policy.enabled}
							onChange={(e) => setPolicy({ enabled: e.target.checked })}
						/>
						Auto-reorder
					</label>
					<table className="suppliers">
						<tbody>
							{suppliers.map((s) => (
								<tr key={s.id} className={s.active ? "" : "gone"}>
									<td>{s.name}</td>
									<td className="muted">
										{s.active ? tierLabel(s) : "bankrupt"}
									</td>
									<td className={s.price_spike ? "num warn-text" : "num"}>
										{formatMoney(s.price)}
									</td>
									<td className="num">{s.lead_days}d</td>
								</tr>
							))}
						</tbody>
					</table>
					<div className="order-row">
						<input
							type="number"
							min={1}
							value={qty}
							onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
						/>
						<label className="check">
							<input
								type="checkbox"
								checked={expedite}
								onChange={(e) => setExpedite(e.target.checked)}
							/>
							Air freight (+50%, ~1/3 lead)
						</label>
						<button
							type="button"
							className="primary"
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

export function SupplyPanel({ game }: { game: Game }) {
	const { view } = game;
	const purchased = view.stock.filter((s) => s.purchased);
	const supplierName = (id: number) =>
		view.suppliers.find((s) => s.id === id)?.name ?? "?";
	return (
		<div className="panel-body">
			<ul className="parts">
				{purchased.map((s) => (
					<PartRow key={s.item} game={game} item={s.item} />
				))}
			</ul>
			<h3>Open orders</h3>
			{view.orders.length === 0 && <p className="muted">None.</p>}
			<ul className="orders">
				{view.orders.map((o) => (
					<li key={o.id} className={o.late ? "late" : ""}>
						<span>
							{o.qty} × {view.stock.find((s) => s.item === o.item)?.label}
						</span>
						<span className="muted">{supplierName(o.supplier)}</span>
						<span className={o.late ? "warn-text" : "muted"}>
							{o.late ? "late" : `due ${formatTick(o.promised)}`}
							{o.expedited ? " · air" : ""}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
