import { useEffect, useState } from "react";
import { deleteSave, listSaves, readSave, type SaveHeader } from "../sim/saves";
import type { Difficulty } from "../sim/types";
import { formatMoney } from "./format";

interface Props {
	onNew: (seed: number, difficulty: Difficulty) => void;
	onLoad: (json: string) => void;
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

export function TitleScreen({ onNew, onLoad, error }: Props) {
	const [difficulty, setDifficulty] = useState<Difficulty>("normal");
	const [seed, setSeed] = useState(randomSeed);
	const [saves, setSaves] = useState<SaveHeader[]>([]);

	useEffect(() => {
		listSaves()
			.then(setSaves)
			.catch(() => setSaves([]));
	}, []);

	const load = async (slot: string) => {
		const json = await readSave(slot);
		if (json) onLoad(json);
	};

	const remove = async (slot: string) => {
		await deleteSave(slot);
		setSaves(await listSaves());
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
								setSeed(Math.max(0, Number(e.target.value) || 0))
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
				{error && <p className="error">{error}</p>}
			</div>
		</div>
	);
}
