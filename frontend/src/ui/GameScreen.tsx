import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { StationKind } from "../sim/types";
import { useGame } from "../sim/useGame";
import type { Sim } from "../sim/wasm";
import { Contracts } from "./Contracts";
import { EventLog } from "./EventLog";
import { formatMoney } from "./format";
import { Hud } from "./Hud";
import { StationCard } from "./StationCard";

// three.js is the bulk of the bundle; load it after the menu.
const FactoryFloor = lazy(() =>
	import("../floor/FactoryFloor").then((m) => ({ default: m.FactoryFloor })),
);

export function GameScreen({ sim, onExit }: { sim: Sim; onExit: () => void }) {
	const game = useGame(sim);
	const [notice, setNotice] = useState<string | null>(null);
	const [selected, setSelected] = useState<StationKind | null>(null);
	const { view } = game;
	const bankrupt = view.status.state === "bankrupt";
	const exitRef = useRef<HTMLButtonElement>(null);
	const noticeTimer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

	// The game-over dialog is modal: move focus onto its only action.
	useEffect(() => {
		if (bankrupt) exitRef.current?.focus();
	}, [bankrupt]);

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

	return (
		<div className="game">
			<div className="game-main" inert={bankrupt}>
				<Hud game={game} onSave={save} onExit={onExit} notice={shown} />
				<main className="board">
					<section className="panel floor">
						<Suspense fallback={<div className="loading">Loading floor…</div>}>
							<FactoryFloor
								view={view}
								selected={selected}
								onSelect={setSelected}
							/>
						</Suspense>
						{selected && (
							<StationCard
								game={game}
								kind={selected}
								onClose={() => setSelected(null)}
							/>
						)}
					</section>
					<Contracts game={game} />
					<EventLog events={game.events} />
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
