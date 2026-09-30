// Pure geometry for belts: turns a conveyor's polyline into belt plates,
// corner plates, guide rails (with gaps where another belt merges in) and
// legs. No three.js here, so it is cheap to reason about and to test.
import type { Conveyor, Vec2 } from "./layout";

/** Half the belt width. */
export const BELT_HW = 0.28;
const LEG_SPACING = 1.6;
const EPS = 1e-6;

export interface Segment {
	a: Vec2;
	b: Vec2;
	len: number;
	/** Unit direction a to b. */
	dir: Vec2;
	/** y rotation that maps local +x onto `dir`. */
	angle: number;
}

/** A straight piece in a segment's local frame: u along the belt, from `a`. */
export interface Span {
	u0: number;
	u1: number;
}

export interface SegmentParts {
	seg: Segment;
	/** Belt plate extent. */
	plate: Span;
	/** Guide rails on the -1 and +1 sides (local -z and +z). */
	rails: { side: -1 | 1; spans: Span[] }[];
	/** Leg positions along u. */
	legs: number[];
}

export interface BeltParts {
	segments: SegmentParts[];
	/** Square plates at corners and junction starts; `backRail` closes the
	 * upstream edge of a junction plate. */
	corners: { at: Vec2; angle: number; backRail: boolean }[];
	/** End rollers at open belt ends. */
	ends: { at: Vec2; angle: number }[];
}

export function segmentsOf(points: Vec2[]): Segment[] {
	const out: Segment[] = [];
	for (let i = 0; i + 1 < points.length; i++) {
		const a = points[i];
		const b = points[i + 1];
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const len = Math.hypot(dx, dz);
		out.push({
			a,
			b,
			len,
			dir: [dx / len, dz / len],
			angle: Math.atan2(-dz, dx),
		});
	}
	return out;
}

/** Which side of `d1` a turn onto `d2` goes toward (+1 = local +z); 0 when
 * the two run straight on. */
function turnSide(d1: Vec2, d2: Vec2): -1 | 0 | 1 {
	const cross = d1[0] * d2[1] - d1[1] * d2[0];
	if (Math.abs(cross) < EPS) return 0;
	return cross > 0 ? 1 : -1;
}

/** Where a merging belt's end lands on this segment, if it does. */
function mergeOnto(seg: Segment, end: Vec2, from: Vec2) {
	const rx = end[0] - seg.a[0];
	const rz = end[1] - seg.a[1];
	const u = rx * seg.dir[0] + rz * seg.dir[1];
	const off = -rx * seg.dir[1] + rz * seg.dir[0];
	if (Math.abs(off) > EPS || u < -EPS || u > seg.len + EPS) return null;
	// The merging belt arrives from the side its previous point is on.
	const fx = from[0] - seg.a[0];
	const fz = from[1] - seg.a[1];
	const side: -1 | 1 = -fx * seg.dir[1] + fz * seg.dir[0] > 0 ? 1 : -1;
	return { u, side };
}

function subtract(spans: Span[], gap: Span): Span[] {
	return spans.flatMap((s) => {
		if (gap.u1 <= s.u0 || gap.u0 >= s.u1) return [s];
		const out: Span[] = [];
		if (gap.u0 > s.u0) out.push({ u0: s.u0, u1: gap.u0 });
		if (gap.u1 < s.u1) out.push({ u0: gap.u1, u1: s.u1 });
		return out;
	});
}

/** Build the pieces of one belt, cutting rail gaps where `all` merge into it. */
export function beltParts(c: Conveyor, all: Conveyor[]): BeltParts {
	const segs = segmentsOf(c.points);
	const last = segs.length - 1;
	const hw = BELT_HW;
	const corners: BeltParts["corners"] = [];
	const ends: BeltParts["ends"] = [];

	const segments = segs.map((seg, i) => {
		// A straight-through waypoint is not a corner: pieces just meet there.
		const bend = (t: -1 | 0 | 1) => (t === 0 ? null : t);
		const turnIn = i > 0 ? bend(turnSide(segs[i - 1].dir, seg.dir)) : null;
		const turnOut = i < last ? bend(turnSide(seg.dir, segs[i + 1].dir)) : null;
		const startCut = turnIn !== null || (i === 0 && c.fromJunction) ? hw : 0;
		const endCut = turnOut !== null || (i === last && c.intoJunction) ? hw : 0;
		const plate = { u0: startCut, u1: seg.len - endCut };
		const rails = ([-1, 1] as const).map((side) => {
			// At a corner the outer rail runs on around it; the inner one stops short.
			const u0 = turnIn === null ? plate.u0 : turnIn === side ? hw : -hw;
			const u1 =
				turnOut === null
					? plate.u1
					: turnOut === side
						? seg.len - hw
						: seg.len + hw;
			let spans: Span[] = [{ u0, u1 }];
			for (const other of all) {
				if (other.id === c.id || !other.intoJunction) continue;
				const n = other.points.length;
				const hit = mergeOnto(seg, other.points[n - 1], other.points[n - 2]);
				if (hit && hit.side === side) {
					spans = subtract(spans, { u0: hit.u - hw, u1: hit.u + hw });
				}
			}
			return { side, spans: spans.filter((s) => s.u1 - s.u0 > 0.05) };
		});
		const legs: number[] = [];
		const n = Math.max(1, Math.round((plate.u1 - plate.u0) / LEG_SPACING));
		for (let k = 0; k < n; k++) {
			legs.push(plate.u0 + ((k + 0.5) * (plate.u1 - plate.u0)) / n);
		}
		if (turnIn !== null)
			corners.push({ at: seg.a, angle: seg.angle, backRail: false });
		return { seg, plate, rails, legs };
	});

	if (c.fromJunction) {
		// Merging belts come in from the sides; the back edge gets a rail.
		corners.push({ at: segs[0].a, angle: segs[0].angle, backRail: true });
	} else {
		ends.push({ at: segs[0].a, angle: segs[0].angle });
	}
	if (!c.intoJunction) ends.push({ at: segs[last].b, angle: segs[last].angle });
	return { segments, corners, ends };
}

/** Total centerline length. */
export function pathLength(segs: Segment[]): number {
	return segs.reduce((a, s) => a + s.len, 0);
}
