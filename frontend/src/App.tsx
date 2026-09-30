import { useEffect, useState } from "react";
import "./App.css";
import "./ui/visual/visual.css";
import { configureAudio } from "./audio/sfx";
import { dailySeed, type Mode, todayUtc } from "./modes";
import { loadSettings, type Settings, saveSettings } from "./settings";
import type { Difficulty } from "./sim/types";
import { Sim } from "./sim/wasm";
import { GameScreen } from "./ui/GameScreen";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TitleScreen } from "./ui/TitleScreen";

type Screen =
	| { kind: "loading" }
	| { kind: "title" }
	| { kind: "game"; id: number; mode: Mode };

/** The tutorial always plays the same gentle plant. */
const TUTORIAL_SEED = 7;

function App() {
	const [sim, setSim] = useState<Sim | null>(null);
	const [screen, setScreen] = useState<Screen>({ kind: "loading" });
	const [error, setError] = useState<string | null>(null);
	const [settings, setSettings] = useState<Settings>(loadSettings);
	const [showSettings, setShowSettings] = useState(false);

	// Apply saved audio settings once; the settings dialog applies later changes.
	const [initialSettings] = useState(settings);
	useEffect(() => configureAudio(initialSettings), [initialSettings]);

	useEffect(() => {
		Sim.load()
			.then((s) => {
				setSim(s);
				setScreen({ kind: "title" });
			})
			.catch((e: unknown) => setError(String(e)));
	}, []);

	// A fresh id remounts the game screen so its hook state starts clean.
	const play = (mode: Mode) =>
		setScreen({ kind: "game", id: Date.now(), mode });

	const startNew = (seed: number, difficulty: Difficulty) => {
		sim?.newGame(seed, difficulty);
		setError(null);
		play({ kind: "sandbox" });
	};

	const startTutorial = () => {
		sim?.newGame(TUTORIAL_SEED, "easy");
		setError(null);
		play({ kind: "tutorial" });
	};

	const startDaily = () => {
		const date = todayUtc();
		sim?.newGame(dailySeed(date), "normal");
		setError(null);
		play({ kind: "daily", date });
	};

	const loadSave = (json: string) => {
		try {
			sim?.load(json);
			setError(null);
			play({ kind: "sandbox" });
		} catch (e) {
			setError(`Could not load save: ${String(e)}`);
		}
	};

	let body: React.ReactNode;
	if (screen.kind === "loading" || !sim) {
		body = <div className="loading">{error ?? "Loading plant…"}</div>;
	} else if (screen.kind === "title") {
		body = (
			<TitleScreen
				onNew={startNew}
				onLoad={loadSave}
				onTutorial={startTutorial}
				onDaily={startDaily}
				onSettings={() => setShowSettings(true)}
				offerTutorial={!settings.tutorialDone}
				error={error}
			/>
		);
	} else {
		body = (
			<GameScreen
				key={screen.id}
				sim={sim}
				mode={screen.mode}
				onExit={() => setScreen({ kind: "title" })}
				onSettings={() => setShowSettings(true)}
				settingsOpen={showSettings}
				onTutorialDone={() => {
					const next = { ...settings, tutorialDone: true };
					setSettings(next);
					saveSettings(next);
				}}
			/>
		);
	}
	return (
		<>
			{/* Settings is modal: whatever screen is behind it goes inert. */}
			<div className="screen" inert={showSettings}>
				{body}
			</div>
			{showSettings && (
				<SettingsDialog
					settings={settings}
					onChange={setSettings}
					onClose={() => setShowSettings(false)}
				/>
			)}
		</>
	);
}

export default App;
