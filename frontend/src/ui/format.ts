const money = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

export function formatMoney(n: number): string {
	if (Math.abs(n) >= 1_000_000)
		return `${n < 0 ? "-" : ""}$${(Math.abs(n) / 1e6).toFixed(2)}M`;
	return money.format(n);
}

export function formatClock(day: number, hour: number): string {
	return `Day ${day + 1} · ${String(hour).padStart(2, "0")}:00`;
}

export function formatTick(tick: number): string {
	return formatClock(Math.floor(tick / 24), tick % 24);
}

/** Short money for chart axes: $128k, -$1.2M. */
export function formatMoneyCompact(n: number): string {
	const sign = n < 0 ? "-" : "";
	const a = Math.abs(n);
	// Switch units on the rounded value so $999,600 reads $1.0M, not $1000k.
	if (Math.round(a / 1e3) >= 1000) return `${sign}$${(a / 1e6).toFixed(1)}M`;
	if (Math.round(a) >= 1000) return `${sign}$${Math.round(a / 1e3)}k`;
	return `${sign}$${Math.round(a)}`;
}
