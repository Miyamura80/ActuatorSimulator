// Per-player preferences and local records, kept in localStorage. Every
// access is guarded: storage can be missing or blocked.

export interface Settings {
	volume: number;
	muted: boolean;
	ambience: boolean;
	tutorialDone: boolean;
}

const DEFAULTS: Settings = {
	volume: 0.6,
	muted: false,
	ambience: true,
	tutorialDone: false,
};

const SETTINGS_KEY = "aw.settings";
const DAILY_KEY = "aw.daily";

/** Parsed JSON for `key`, or null if missing, unreadable or malformed. */
function readJson(key: string): unknown {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage unavailable (private mode, quota): settings last for the session.
	}
}

/** Stored settings, field by field; anything missing or mistyped falls back. */
export function loadSettings(): Settings {
	const s = readJson(SETTINGS_KEY);
	if (!isObject(s)) return DEFAULTS;
	const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
	const volume =
		typeof s.volume === "number" && Number.isFinite(s.volume)
			? Math.min(1, Math.max(0, s.volume))
			: DEFAULTS.volume;
	return {
		volume,
		muted: bool(s.muted, DEFAULTS.muted),
		ambience: bool(s.ambience, DEFAULTS.ambience),
		tutorialDone: bool(s.tutorialDone, DEFAULTS.tutorialDone),
	};
}

export function saveSettings(s: Settings) {
	write(SETTINGS_KEY, s);
}

interface DailyResult {
	date: string;
	score: number;
	cash: number;
	reputation: number;
	bankrupt: boolean;
}

export function loadDailyResults(): DailyResult[] {
	const rec = readJson(DAILY_KEY);
	if (!isObject(rec) || !Array.isArray(rec.results)) return [];
	const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
	return rec.results.filter(
		(r): r is DailyResult =>
			isObject(r) &&
			typeof r.date === "string" &&
			num(r.score) &&
			num(r.cash) &&
			num(r.reputation) &&
			typeof r.bankrupt === "boolean",
	);
}

export function recordDailyResult(r: DailyResult) {
	const results = loadDailyResults().filter(
		(x) => x.date !== r.date || x.score > r.score,
	);
	if (!results.some((x) => x.date === r.date)) results.push(r);
	results.sort((a, b) => b.date.localeCompare(a.date));
	write(DAILY_KEY, { results: results.slice(0, 60) });
}
