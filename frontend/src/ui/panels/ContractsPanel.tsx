import type { Game } from "../../sim/useGame";
import { formatMoney } from "../format";
import { forecast, hoursUntilDue } from "../visual/forecast";
import { DeadlineTrack } from "../visual/gauges";
import { Glyph } from "../visual/glyphs";
import { ItemIcon } from "../visual/icons";

export function ContractsPanel({ game }: { game: Game }) {
	const { view, act } = game;
	const active = view.contracts.filter((c) => c.status === "active");
	const offers = view.contracts.filter((c) => c.status === "offered");
	const plan = forecast(view);
	return (
		<div className="panel-body contracts">
			{active.length + offers.length === 0 && (
				<p className="muted">No offers right now.</p>
			)}
			<ul>
				{[...active, ...offers].map((c) => {
					const offered = c.status === "offered";
					const left = hoursUntilDue(view, c);
					// For an offer: when it would finish if accepted now.
					const eta = (offered ? forecast(view, c) : plan).get(c.id) ?? 0;
					const fits = eta <= left;
					const pct = (c.delivered / c.qty) * 100;
					return (
						<li
							key={c.id}
							className={`contract${offered ? " offer" : ""}${c.quality === "premium" ? " premium" : ""}`}
						>
							<div className="who">
								<Glyph name="user" size={14} className="muted" />
								<strong>{c.customer}</strong>
								{c.quality === "premium" && (
									<Glyph
										name="star"
										size={14}
										title="Premium"
										className="gold"
									/>
								)}
								<span className="total">
									{formatMoney(c.qty * c.unit_price)}
								</span>
							</div>
							<div className="units">
								<ItemIcon item="finished_good" size={16} />
								<span className="meter wide">
									<span style={{ width: `${pct}%` }} />
								</span>
								<span className="num">
									{c.delivered}/{c.qty}
								</span>
								<span className="muted num small">
									@{formatMoney(c.unit_price)}
								</span>
							</div>
							<div className="when">
								<DeadlineTrack hoursLeft={left} forecastHours={eta} />
								<Glyph
									name={fits ? "check" : "alert"}
									size={16}
									className={fits ? "good" : "bad"}
									title={
										fits
											? "On time at current capacity"
											: "Late at current capacity"
									}
								/>
							</div>
							{offered && (
								<div className="row">
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
									<span
										className="expires muted small"
										title="Offer disappears"
									>
										<Glyph name="clock" size={12} />
										{Math.max(0, Math.ceil((c.offer_expires - view.tick) / 24))}
										d
									</span>
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
