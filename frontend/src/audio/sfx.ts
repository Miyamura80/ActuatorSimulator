// Procedural sound: every effect is synthesized with Web Audio, so there are
// no audio assets to license or load. The context starts on first user
// gesture (browser autoplay rules).
import type { Settings } from "../settings";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let hum: { gain: GainNode; stop: () => void } | null = null;
let volume = 0.6;
let muted = false;
let ambience = true;

function audio(): AudioContext | null {
	if (typeof window === "undefined" || !("AudioContext" in window)) return null;
	if (!ctx) {
		ctx = new AudioContext();
		master = ctx.createGain();
		master.connect(ctx.destination);
		applyVolume();
	}
	if (ctx.state === "suspended") void ctx.resume();
	return ctx;
}

function applyVolume() {
	if (master) master.gain.value = muted ? 0 : volume;
}

export function configureAudio(s: Settings) {
	volume = s.volume;
	muted = s.muted;
	ambience = s.ambience;
	applyVolume();
	if (!ambience) setHum(0);
}

/** A short enveloped oscillator note. */
function tone(
	freq: number,
	dur: number,
	type: OscillatorType,
	gain: number,
	delay = 0,
) {
	const a = audio();
	if (!a || !master || muted) return;
	const t = a.currentTime + delay;
	const osc = a.createOscillator();
	const g = a.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(master);
	osc.start(t);
	osc.stop(t + dur + 0.02);
}

/** Filtered noise burst (mechanical clunks, air). */
function noise(dur: number, freq: number, gain: number) {
	const a = audio();
	if (!a || !master || muted) return;
	const len = Math.floor(a.sampleRate * dur);
	const buf = a.createBuffer(1, len, a.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < len; i++)
		data[i] = (Math.random() * 2 - 1) * (1 - i / len);
	const src = a.createBufferSource();
	src.buffer = buf;
	const f = a.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = freq;
	const g = a.createGain();
	g.gain.value = gain;
	src.connect(f).connect(g).connect(master);
	src.start();
}

export const sfx = {
	click: () => tone(900, 0.05, "square", 0.04),
	/** Shipment out the door: a two-note register chime. */
	cash: () => {
		tone(1318, 0.12, "triangle", 0.12);
		tone(1760, 0.25, "triangle", 0.1, 0.08);
	},
	warning: () => tone(660, 0.18, "sine", 0.1),
	/** Breakdowns, field failures, bankruptcy warnings. */
	alarm: () => {
		for (let i = 0; i < 3; i++)
			tone(i % 2 ? 520 : 780, 0.14, "sawtooth", 0.06, i * 0.16);
	},
	/** Machine bought, maintenance started. */
	clunk: () => noise(0.25, 180, 0.5),
	good: () => {
		tone(784, 0.1, "sine", 0.1);
		tone(1046, 0.18, "sine", 0.1, 0.09);
	},
};

/** Factory ambience: low filtered noise whose level follows line activity (0..1). */
export function setHum(level: number) {
	const a = audio();
	if (!a || !master) return;
	if (!hum) {
		if (level <= 0 || !ambience) return;
		const len = a.sampleRate * 2;
		const buf = a.createBuffer(1, len, a.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		const src = a.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		const f = a.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = 220;
		const gain = a.createGain();
		gain.gain.value = 0;
		src.connect(f).connect(gain).connect(master);
		src.start();
		hum = { gain, stop: () => src.stop() };
	}
	const target = ambience ? Math.min(1, Math.max(0, level)) * 0.12 : 0;
	hum.gain.gain.setTargetAtTime(target, a.currentTime, 0.4);
}

export function stopHum() {
	hum?.stop();
	hum = null;
}
