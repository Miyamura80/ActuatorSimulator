import { useEffect, useState } from "react";
import { DAILY_DAYS, todayUtc } from "../modes";
import { loadDailyResults } from "../settings";
import { deleteSave, listSaves, readSave, type SaveHeader } from "../sim/saves";
import type { Difficulty } from "../sim/types";
import { formatMoney } from "./format";

interface Props {
	onNew: (seed: number, difficulty: Difficulty) => void;
	onLoad: (json: string) => void;
	onTutorial: () => void;
	onDaily: () => void;
	onSettings: () => void;
	offerTutorial: boolean;
	error: string | null;
}

const DIFFICULTIES: { id: Difficulty; blurb: string }[] = [
	{ id: "easy", blurb: "Deep pockets, forgiving suppliers" },
	{ id: "normal", blurb: "The intended experience" },
	{ id: "hard", blurb: "Thin credit, flaky supply chain" },
];

function randomSeed() {
	return Math.floor(Math.random() * 1_000_000);
}

export function TitleScreen({
	onNew,
	onLoad,
	onTutorial,
	onDaily,
	onSettings,
	offerTutorial,
	error,
}: Props) {
	const [daily] = useState(loadDailyResults);
	const today = daily.find((d) => d.date === todayUtc());
	const [difficulty, setDifficulty] = useState<Difficulty>("normal");
	const [seed, setSeed] = useState(randomSeed);
	const [saves, setSaves] = useState<SaveHeader[]>([]);
	const [storageError, setStorageError] = useState<string | null>(null);
	const failed = (what: string) => (e: unknown) =>
		setStorageError(`${what}: ${String(e)}`);

	useEffect(() => {
		listSaves()
			.then(setSaves)
			.catch((e: unknown) =>
				setStorageError(`Could not read saved plants: ${String(e)}`),
			);
	}, []);

	const load = async (slot: string) => {
		try {
			const json = await readSave(slot);
			if (json) onLoad(json);
			else setStorageError("That save is empty or missing");
		} catch (e) {
			failed("Could not read that save")(e);
		}
	};

	const remove = async (slot: string) => {
		try {
			await deleteSave(slot);
			setSaves(await listSaves());
		} catch (e) {
			failed("Could not delete that save")(e);
		}
	};

	return (
		<div className="title">
			<div className="title-card">
				<div className="hazard" />
				<h1>Actuator Works</h1>
				<p className="tagline">
					Build robot joint actuators. Keep the line running. Keep the customers
					happy. Stay solvent.
				</p>

				<div className="quick">
					<button
						type="button"
						className={offerTutorial ? "primary" : ""}
						onClick={onTutorial}
					>
						Tutorial
					</button>
					<button type="button" onClick={onDaily}>
						Daily challenge
						<span className="muted small">
							{today
								? ` · today's best ${formatMoney(today.score)}`
								: ` · ${DAILY_DAYS} days, same plant for everyone`}
						</span>
					</button>
					<button type="button" className="ghost" onClick={onSettings}>
						Settings
					</button>
				</div>

				<section>
					<h2>New plant</h2>
					<div className="difficulty">
						{DIFFICULTIES.map((d) => (
							<button
								type="button"
								key={d.id}
								className={d.id === difficulty ? "chip on" : "chip"}
								onClick={() => setDifficulty(d.id)}
							>
								<strong>{d.id}</strong>
								<span>{d.blurb}</span>
							</button>
						))}
					</div>
					<div className="seed-row">
						<label htmlFor="seed">Seed</label>
						<input
							id="seed"
							type="number"
							min={0}
							value={seed}
							onChange={(e) =>
								setSeed(
									Math.min(
										Number.MAX_SAFE_INTEGER,
										Math.max(0, Math.floor(Number(e.target.value) || 0)),
									),
								)
							}
						/>
						<button
							type="button"
							className="ghost"
							onClick={() => setSeed(randomSeed())}
						>
							Shuffle
						</button>
						<button
							type="button"
							className="primary"
							onClick={() => onNew(seed, difficulty)}
						>
							Start
						</button>
					</div>
				</section>

				{saves.length > 0 && (
					<section>
						<h2>Saved plants</h2>
						<ul className="saves">
							{saves.map((s) => (
								<li key={s.slot}>
									<div>
										<strong>{s.name}</strong>
										<span>
											Day {s.day} · {formatMoney(s.cash)} · {s.difficulty}
										</span>
									</div>
									<button
										type="button"
										className="primary"
										onClick={() => load(s.slot)}
									>
										Load
									</button>
									<button
										type="button"
										className="ghost"
										onClick={() => remove(s.slot)}
									>
										Delete
									</button>
								</li>
							))}
						</ul>
					</section>
				)}
				{daily.length > 0 && (
					<section>
						<h2>Daily challenge results</h2>
						<ul className="saves">
							{daily.slice(0, 5).map((d) => (
								<li key={d.date}>
									<div>
										<strong>{d.date}</strong>
										<span>
											{d.bankrupt
												? "Bankrupt"
												: `${formatMoney(d.cash)} cash · ${d.reputation.toFixed(0)} rep`}
										</span>
									</div>
									<strong className="num">{formatMoney(d.score)}</strong>
								</li>
							))}
						</ul>
					</section>
				)}
				{storageError && (
					<p className="error" role="alert">
						{storageError}
					</p>
				)}
				{error && (
					<p className="error" role="alert">
						{error}
					</p>
				)}
			</div>
		</div>
	);
}
