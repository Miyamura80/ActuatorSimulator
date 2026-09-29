import { useEffect, useState } from "react";
import "./App.css";
import type { Difficulty } from "./sim/types";
import { Sim } from "./sim/wasm";
import { GameScreen } from "./ui/GameScreen";
import { TitleScreen } from "./ui/TitleScreen";

type Screen =
	| { kind: "loading" }
	| { kind: "title" }
	| { kind: "game"; id: number };

function App() {
	const [sim, setSim] = useState<Sim | null>(null);
	const [screen, setScreen] = useState<Screen>({ kind: "loading" });
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		Sim.load()
			.then((s) => {
				setSim(s);
				setScreen({ kind: "title" });
			})
			.catch((e: unknown) => setError(String(e)));
	}, []);

	// A fresh id remounts the game screen so its hook state starts clean.
	const play = () => setScreen({ kind: "game", id: Date.now() });

	const startNew = (seed: number, difficulty: Difficulty) => {
		sim?.newGame(seed, difficulty);
		setError(null);
		play();
	};

	const loadSave = (json: string) => {
		try {
			sim?.load(json);
			setError(null);
			play();
		} catch (e) {
			setError(`Could not load save: ${String(e)}`);
		}
	};

	if (screen.kind === "loading" || !sim) {
		return <div className="loading">{error ?? "Loading plant…"}</div>;
	}
	if (screen.kind === "title") {
		return <TitleScreen onNew={startNew} onLoad={loadSave} error={error} />;
	}
	return (
		<GameScreen
			key={screen.id}
			sim={sim}
			onExit={() => setScreen({ kind: "title" })}
		/>
	);
}

export default App;
