import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { setHum, sfx, stopHum } from "../audio/sfx";
import { beaconState } from "../floor/status";
import { DAILY_DAYS, dailyScore, type Mode } from "../modes";
import { recordDailyResult } from "../settings";
import type { GameEvent, StationKind } from "../sim/types";
import { type Speed, useGame } from "../sim/useGame";
import type { Sim } from "../sim/wasm";
import { formatMoney } from "./format";
import { Hud } from "./Hud";
import { Sidebar, type Tab } from "./Sidebar";
import { StationCard } from "./StationCard";
import { Toasts } from "./Toasts";
import { Tutorial } from "./Tutorial";

// three.js is the bulk of the bundle; load it after the menu.
const FactoryFloor = lazy(() =>
	import("../floor/FactoryFloor").then((m) => ({ default: m.FactoryFloor })),
);

const SPEED_KEYS: Record<string, Speed> = { "1": 1, "2": 2, "3": 4 };

function soundFor(e: GameEvent) {
	switch (e.kind.type) {
		case "shipped":
			return sfx.cash;
		case "contract_completed":
			return sfx.good;
		case "machine_bought":
		case "maintenance_started":
			return sfx.clunk;
		default:
			if (e.severity === "critical") return sfx.alarm;
			if (e.severity === "warning") return sfx.warning;
			return null;
	}
}

interface Props {
	sim: Sim;
	mode: Mode;
	onExit: () => void;
	onSettings: () => void;
	onTutorialDone: () => void;
}

export function GameScreen({
	sim,
	mode,
	onExit,
	onSettings,
	onTutorialDone,
}: Props) {
	const game = useGame(sim, mode.kind !== "daily");
	const [notice, setNotice] = useState<string | null>(null);
	const [selected, setSelected] = useState<StationKind | null>(null);
	const [tab, setTab] = useState<Tab>("contracts");
	const [traceLot, setTraceLot] = useState<number | null>(null);
	const { view, speed, setSpeed } = game;
	const noticeTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
	const [tutorialOpen, setTutorialOpen] = useState(mode.kind === "tutorial");

	// One sound per frame at most: the loudest thing that happened.
	const heard = useRef(
		game.events.length > 0 ? game.events[game.events.length - 1].seq : -1,
	);
	useEffect(() => {
		const fresh = game.events.filter((e) => e.seq > heard.current);
		if (fresh.length === 0) return;
		heard.current = fresh[fresh.length - 1].seq;
		const rank = { critical: 3, good: 2, warning: 1, info: 0 } as const;
		const loudest = [...fresh].sort(
			(a, b) => rank[b.severity] - rank[a.severity],
		)[0];
		soundFor(loudest)?.();
	}, [game.events]);

	// Ambience follows how much of the line is running.
	const busy =
		view.stations.filter((s) => s.busy).length / view.stations.length;
	useEffect(() => setHum(speed === 0 ? 0 : busy), [busy, speed]);
	useEffect(() => stopHum, []);

	// Daily challenge: stop at the final day (or bankruptcy) and record the score.
	const dailyOver =
		mode.kind === "daily" &&
		(view.day >= DAILY_DAYS || view.status.state !== "running");
	// End-of-run dialogs are modal: the page behind goes inert and focus
	// moves onto the dialog's only action.
	const modal = dailyOver || view.status.state === "bankrupt";
	const exitRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		if (modal) exitRef.current?.focus();
	}, [modal]);

	const recorded = useRef(false);
	useEffect(() => {
		if (!dailyOver || mode.kind !== "daily" || recorded.current) return;
		recorded.current = true;
		setSpeed(0);
		recordDailyResult({
			date: mode.date,
			score: dailyScore(view),
			cash: view.cash,
			reputation: view.reputation,
			bankrupt: view.status.state !== "running",
		});
	}, [dailyOver, mode, view, setSpeed]);

	// Closing a card hands focus back to that station's strip button.
	const closeCard = useCallback(() => {
		setSelected((kind) => {
			if (kind) {
				document
					.querySelector<HTMLButtonElement>(`[data-station="${kind}"]`)
					?.focus();
			}
			return null;
		});
	}, []);

	// Space toggles pause; 1/2/3 pick a speed; Esc closes the station card.
	// Space and digits are left alone in form fields and on buttons, where
	// they mean something already (Space presses a focused button).
	const resume = useRef<Speed>(1);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement;
			if (modal) return;
			if (e.key === "Escape") {
				closeCard();
				return;
			}
			if (
				t.isContentEditable ||
				t.closest("button, a, input, select, textarea")
			)
				return;
			if (e.code === "Space") {
				e.preventDefault();
				if (speed === 0) setSpeed(resume.current);
				else {
					resume.current = speed;
					setSpeed(0);
				}
			} else if (SPEED_KEYS[e.key]) {
				setSpeed(SPEED_KEYS[e.key]);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [speed, setSpeed, closeCard, modal]);

	const save = async () => {
		const name = `Day ${view.day + 1} · ${view.difficulty}`;
		try {
			await game.save(`manual-${view.seed}`, name);
			setNotice("Saved");
		} catch (e) {
			setNotice(`Save failed: ${String(e)}`);
		}
		// One timer at a time, so a second save's notice isn't cut short.
		window.clearTimeout(noticeTimer.current);
		noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
	};

	const shown =
		notice ??
		(game.autosaveError ? `Autosave failed: ${game.autosaveError}` : null);

	const openTrace = (lot: number) => {
		setTraceLot(lot);
		setTab("quality");
	};

	return (
		<div className="game">
			<div className="game-main" inert={modal}>
				<Hud
					game={game}
					mode={mode}
					onSave={save}
					onExit={onExit}
					onSettings={onSettings}
					notice={shown}
				/>
				<main className="board">
					<section className="floor" aria-label="Factory floor">
						<Suspense fallback={<div className="loading">Loading floor…</div>}>
							<FactoryFloor
								view={view}
								selected={selected}
								onSelect={setSelected}
							/>
						</Suspense>
						{selected && (
							<StationCard
								key={selected}
								game={game}
								kind={selected}
								onClose={closeCard}
							/>
						)}
						<Toasts
							events={game.events}
							onTrace={openTrace}
							onStation={(k) => setSelected(k as StationKind)}
						/>
						{tutorialOpen && (
							<Tutorial
								view={view}
								tab={tab}
								speed={speed}
								selected={selected}
								onFinish={() => {
									setTutorialOpen(false);
									onTutorialDone();
								}}
							/>
						)}
						{/* Keyboard and screen-reader route to every station. */}
						<nav className="station-strip" aria-label="Stations">
							{view.stations.map((st) => (
								<button
									type="button"
									key={st.kind}
									data-station={st.kind}
									aria-pressed={selected === st.kind}
									className={`strip-btn beacon-${beaconState(st, view.operating)}${selected === st.kind ? " on" : ""}`}
									onClick={() =>
										setSelected(selected === st.kind ? null : st.kind)
									}
								>
									{st.label}
								</button>
							))}
						</nav>
					</section>
					<Sidebar
						game={game}
						tab={tab}
						setTab={setTab}
						traceLot={traceLot}
						setTraceLot={setTraceLot}
					/>
				</main>
			</div>
			{dailyOver && (
				<div className="overlay">
					<div
						className="dialog"
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="daily-title"
						aria-describedby="daily-body"
					>
						<h2 id="daily-title">
							Daily challenge · {mode.kind === "daily" ? mode.date : ""}
						</h2>
						<p id="daily-body">
							{view.status.state === "running"
								? `Day ${DAILY_DAYS} reached with ${formatMoney(view.cash)} and ${view.reputation.toFixed(0)} reputation.`
								: "The plant went bankrupt before the final day."}
						</p>
						<p className="score">Score {formatMoney(dailyScore(view))}</p>
						<p className="muted small">
							Score is cash plus $2,000 per reputation point.
						</p>
						<button
							ref={exitRef}
							type="button"
							className="primary"
							onClick={onExit}
						>
							Back to menu
						</button>
					</div>
				</div>
			)}
			{!dailyOver && view.status.state === "bankrupt" && (
				<div className="overlay">
					<div
						className="dialog"
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="bankrupt-title"
						aria-describedby="bankrupt-body"
					>
						<h2 id="bankrupt-title">Bankrupt</h2>
						<p id="bankrupt-body">
							The bank called in the overdraft on day {view.status.day + 1} with
							cash at {formatMoney(view.cash)}.
						</p>
						<button
							ref={exitRef}
							type="button"
							className="primary"
							onClick={onExit}
						>
							Back to menu
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
