import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { beaconState } from "../floor/status";
import type { StationKind } from "../sim/types";
import { type Speed, useGame } from "../sim/useGame";
import type { Sim } from "../sim/wasm";
import { formatMoney } from "./format";
import { Hud } from "./Hud";
import { Sidebar, type Tab } from "./Sidebar";
import { StationCard } from "./StationCard";
import { Toasts } from "./Toasts";

// three.js is the bulk of the bundle; load it after the menu.
const FactoryFloor = lazy(() =>
	import("../floor/FactoryFloor").then((m) => ({ default: m.FactoryFloor })),
);

const SPEED_KEYS: Record<string, Speed> = { "1": 1, "2": 2, "3": 4 };

export function GameScreen({ sim, onExit }: { sim: Sim; onExit: () => void }) {
	const game = useGame(sim);
	const [notice, setNotice] = useState<string | null>(null);
	const [selected, setSelected] = useState<StationKind | null>(null);
	const [tab, setTab] = useState<Tab>("contracts");
	const [traceLot, setTraceLot] = useState<number | null>(null);
	const { view, speed, setSpeed } = game;
	const bankrupt = view.status.state === "bankrupt";
	const exitRef = useRef<HTMLButtonElement>(null);
	const noticeTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

	// The game-over dialog is modal: move focus onto its only action.
	useEffect(() => {
		if (bankrupt) exitRef.current?.focus();
	}, [bankrupt]);

	// Closing a card hands focus back to that station's strip button.
	const closeCard = () => {
		const kind = selected;
		setSelected(null);
		document
			.querySelector<HTMLButtonElement>(`[data-station="${kind}"]`)
			?.focus();
	};

	// Space toggles pause; 1/2/3 pick a speed. Ignored while typing in a field.
	useEffect(() => {
		let resume: Speed = 1;
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement;
			if (["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
			if (e.code === "Space") {
				e.preventDefault();
				if (speed === 0) setSpeed(resume);
				else {
					resume = speed;
					setSpeed(0);
				}
			} else if (SPEED_KEYS[e.key]) {
				setSpeed(SPEED_KEYS[e.key]);
			} else if (e.key === "Escape") {
				setSelected(null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [speed, setSpeed]);

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
			<div className="game-main" inert={bankrupt}>
				<Hud game={game} onSave={save} onExit={onExit} notice={shown} />
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
			{view.status.state === "bankrupt" && (
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
