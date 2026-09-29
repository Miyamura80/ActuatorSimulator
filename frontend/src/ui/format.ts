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
