import { useState } from "react";
import { useGame } from "../sim/useGame";
import type { Sim } from "../sim/wasm";
import { Contracts } from "./Contracts";
import { EventLog } from "./EventLog";
import { formatMoney } from "./format";
import { Hud } from "./Hud";
import { LineBoard } from "./LineBoard";

export function GameScreen({ sim, onExit }: { sim: Sim; onExit: () => void }) {
	const game = useGame(sim);
	const [notice, setNotice] = useState<string | null>(null);
	const { view } = game;

	const save = async () => {
		const name = `Day ${view.day + 1} · ${view.difficulty}`;
		await game.save(`manual-${view.seed}`, name);
		setNotice("Saved");
		window.setTimeout(() => setNotice(null), 1500);
	};

	return (
		<div className="game">
			<Hud game={game} onSave={save} onExit={onExit} notice={notice} />
			<main className="board">
				<LineBoard view={view} />
				<Contracts game={game} />
				<EventLog events={game.events} />
			</main>
			{view.status.state === "bankrupt" && (
				<div className="overlay">
					<div className="dialog">
						<h2>Bankrupt</h2>
						<p>
							The bank called in the overdraft on day {view.status.day + 1} with
							cash at {formatMoney(view.cash)}.
						</p>
						<button type="button" className="primary" onClick={onExit}>
							Back to menu
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
