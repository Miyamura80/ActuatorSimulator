// Thin client for crates/sim-wasm: JSON strings through linear memory.
import type { Action, Difficulty, TraceReport, View } from "./types";

interface Exports {
	memory: WebAssembly.Memory;
	sim_alloc(len: number): number;
	sim_free(ptr: number, len: number): void;
	sim_out_ptr(): number;
	sim_out_len(): number;
	sim_new(seedHi: number, seedLo: number, difficulty: number): void;
	sim_apply(ptr: number, len: number): number;
	sim_step(hours: number): number;
	sim_view(sinceHi: number, sinceLo: number): number;
	sim_trace(lot: number): number;
	sim_save(): number;
	sim_load(ptr: number, len: number): number;
}

const DIFFICULTY_CODE: Record<Difficulty, number> = {
	easy: 0,
	normal: 1,
	hard: 2,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Split a non-negative integer (< 2^53) into u32 halves. */
function split(n: number): [number, number] {
	if (!Number.isSafeInteger(n) || n < 0) {
		throw new RangeError(`expected an integer in [0, 2^53), got ${n}`);
	}
	return [Math.floor(n / 2 ** 32), n >>> 0];
}

export class Sim {
	private constructor(private readonly x: Exports) {}

	static async load(url = "/sim.wasm"): Promise<Sim> {
		const res = await fetch(url);
		if (!res.ok) {
			const hint = import.meta.env.DEV ? "; run `make wasm`" : "";
			throw new Error(
				`The game file failed to load (${url}, HTTP ${res.status})${hint}`,
			);
		}
		const { instance } = await WebAssembly.instantiate(
			await res.arrayBuffer(),
			{},
		);
		return new Sim(instance.exports as unknown as Exports);
	}

	newGame(seed: number, difficulty: Difficulty): void {
		const [hi, lo] = split(seed);
		this.x.sim_new(hi, lo, DIFFICULTY_CODE[difficulty]);
	}

	/** Returns null on success, or the reason the action was refused. */
	apply(action: Action): string | null {
		const status = this.withInput(JSON.stringify(action), (p, n) =>
			this.x.sim_apply(p, n),
		);
		return status === 0 ? null : this.output();
	}

	step(hours: number): number {
		return this.x.sim_step(hours);
	}

	view(sinceSeq: number): View {
		const [hi, lo] = split(sinceSeq);
		this.check(this.x.sim_view(hi, lo));
		return JSON.parse(this.output()) as View;
	}

	/** Records for one lot, or null if it does not exist. */
	trace(lot: number): TraceReport | null {
		if (this.x.sim_trace(lot) !== 0) return null;
		return JSON.parse(this.output()) as TraceReport;
	}

	save(): string {
		this.check(this.x.sim_save());
		return this.output();
	}

	/** Throws if the save cannot be read. */
	load(json: string): void {
		this.check(this.withInput(json, (p, n) => this.x.sim_load(p, n)));
	}

	private withInput(text: string, call: (ptr: number, len: number) => number) {
		const bytes = encoder.encode(text);
		const ptr = this.x.sim_alloc(bytes.length);
		new Uint8Array(this.x.memory.buffer, ptr, bytes.length).set(bytes);
		try {
			return call(ptr, bytes.length);
		} finally {
			this.x.sim_free(ptr, bytes.length);
		}
	}

	private output(): string {
		const ptr = this.x.sim_out_ptr();
		const len = this.x.sim_out_len();
		return decoder.decode(new Uint8Array(this.x.memory.buffer, ptr, len));
	}

	private check(status: number) {
		if (status !== 0) throw new Error(this.output());
	}
}
