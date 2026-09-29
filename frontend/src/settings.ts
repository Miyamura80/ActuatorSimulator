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

function read<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Storage unavailable (private mode, quota): settings last for the session.
	}
}

export function loadSettings(): Settings {
	return read(SETTINGS_KEY, DEFAULTS);
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
	const rec = read<{ results: DailyResult[] }>(DAILY_KEY, { results: [] });
	return rec.results;
}

export function recordDailyResult(r: DailyResult) {
	const results = loadDailyResults().filter(
		(x) => x.date !== r.date || x.score > r.score,
	);
	if (!results.some((x) => x.date === r.date)) results.push(r);
	results.sort((a, b) => b.date.localeCompare(a.date));
	write(DAILY_KEY, { results: results.slice(0, 60) });
}
