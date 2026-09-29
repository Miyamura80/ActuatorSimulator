import type { Game } from "../sim/useGame";
import { formatMoney, formatTick } from "./format";

export function Contracts({ game }: { game: Game }) {
	const { view, act } = game;
	const open = view.contracts.filter(
		(c) => c.status === "offered" || c.status === "active",
	);
	return (
		<section className="panel contracts">
			<h2>Contracts</h2>
			{open.length === 0 && <p className="muted">No offers right now.</p>}
			<ul>
				{open.map((c) => {
					const pct = (c.delivered / c.qty) * 100;
					const late = c.deadline !== null && view.tick > c.deadline;
					return (
						<li key={c.id} className={c.quality === "premium" ? "premium" : ""}>
							<div className="who">
								<strong>{c.customer}</strong>
								{c.quality === "premium" && (
									<span className="tag">Premium</span>
								)}
							</div>
							<div className="terms">
								{c.qty} units × {formatMoney(c.unit_price)} ={" "}
								{formatMoney(c.qty * c.unit_price)}
							</div>
							{c.status === "offered" ? (
								<div className="row">
									<span className="muted">
										{c.lead_days} days to deliver · offer ends{" "}
										{formatTick(c.offer_expires)}
									</span>
									<button
										type="button"
										className="primary"
										onClick={() =>
											act({ type: "accept_contract", contract: c.id })
										}
									>
										Accept
									</button>
									<button
										type="button"
										className="ghost"
										onClick={() =>
											act({ type: "decline_contract", contract: c.id })
										}
									>
										Decline
									</button>
								</div>
							) : (
								<div className="row">
									<span className="meter wide">
										<span style={{ width: `${pct}%` }} />
									</span>
									<span className={late ? "bad" : "muted"}>
										{c.delivered}/{c.qty} · due{" "}
										{c.deadline !== null ? formatTick(c.deadline) : "n/a"}
									</span>
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
