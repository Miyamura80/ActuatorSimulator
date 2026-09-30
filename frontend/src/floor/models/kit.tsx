// Building blocks for the procedural models: cached geometries, a mesh
// shorthand, and the small animation hooks every machine uses.
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { MAT, tinted } from "../palette";

// Re-exported so model files import materials and kit from one place.
export { MAT, tinted };

export type V3 = [number, number, number];

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
	let g = cache.get(key);
	if (!g) {
		g = make();
		cache.set(key, g);
	}
	return g;
}

/** Geometries are shared by every mesh that asks for the same shape. */
export const G = {
	box: (w: number, h: number, d: number) =>
		cached(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
	/** Box with bevelled edges; `r` is the edge radius. */
	rbox: (w: number, h: number, d: number, r = 0.04, seg = 3) =>
		cached(
			`rbox${w},${h},${d},${r},${seg}`,
			() => new RoundedBoxGeometry(w, h, d, seg, r),
		),
	cyl: (rt: number, rb: number, h: number, seg = 32) =>
		cached(
			`cyl${rt},${rb},${h},${seg}`,
			() => new THREE.CylinderGeometry(rt, rb, h, seg),
		),
	torus: (r: number, tube: number, rs = 16, ts = 48) =>
		cached(
			`torus${r},${tube},${rs},${ts}`,
			() => new THREE.TorusGeometry(r, tube, rs, ts),
		),
	sphere: (r: number, seg = 24) =>
		cached(`sph${r},${seg}`, () => new THREE.SphereGeometry(r, seg, seg / 2)),
	/** Spur gear with `teeth` teeth, lying in the xz plane. */
	gear: (r: number, teeth: number, depth: number) =>
		cached(`gear${r},${teeth},${depth}`, () => gearGeometry(r, teeth, depth)),
};

function gearGeometry(r: number, teeth: number, depth: number) {
	const shape = new THREE.Shape();
	const root = r * 0.84;
	const steps = teeth * 4;
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		// Trapezoid teeth: rise, land, fall, root.
		const phase = i % 4;
		const rad = phase === 1 || phase === 2 ? r : root;
		const x = Math.cos(a) * rad;
		const y = Math.sin(a) * rad;
		if (i === 0) shape.moveTo(x, y);
		else shape.lineTo(x, y);
	}
	const bore = new THREE.Path();
	bore.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
	shape.holes.push(bore);
	const g = new THREE.ExtrudeGeometry(shape, {
		depth,
		bevelEnabled: true,
		bevelSize: r * 0.02,
		bevelThickness: r * 0.02,
		bevelSegments: 2,
		curveSegments: 24,
	});
	g.rotateX(-Math.PI / 2);
	g.translate(0, -depth / 2, 0);
	return g;
}

interface MProps {
	g: THREE.BufferGeometry;
	m: THREE.Material;
	p?: V3;
	r?: V3;
	s?: number | V3;
	shadow?: boolean;
}

/** A mesh with shared geometry and material. */
export function M({ g, m, p, r, s, shadow = true }: MProps) {
	return (
		<mesh
			geometry={g}
			material={m}
			position={p}
			rotation={r}
			scale={s}
			castShadow={shadow}
			receiveShadow
		/>
	);
}

/** Rotate a group about an axis while `active`. */
export function useSpin(
	active: boolean,
	speed: number,
	axis: "x" | "y" | "z" = "y",
) {
	const ref = useRef<THREE.Group>(null);
	useFrame((_, dt) => {
		if (active && ref.current) ref.current.rotation[axis] += dt * speed;
	});
	return ref;
}

/** Drive a group from a clock-based function while `active`; `rest` otherwise. */
export function useMotion(
	active: boolean,
	apply: (g: THREE.Group, t: number) => void,
	rest: (g: THREE.Group) => void,
) {
	const ref = useRef<THREE.Group>(null);
	useFrame(({ clock }) => {
		if (!ref.current) return;
		if (active) apply(ref.current, clock.elapsedTime);
		else rest(ref.current);
	});
	return ref;
}

/** Leveling plinth every machine stands on. */
export function Plinth({ w = 1.6, d = 1.5 }: { w?: number; d?: number }) {
	const foot = G.cyl(0.07, 0.09, 0.08, 20);
	const fx = w / 2 - 0.12;
	const fz = d / 2 - 0.12;
	return (
		<group>
			<M g={G.rbox(w, 0.16, d, 0.03)} m={MAT.steelDark} p={[0, 0.12, 0]} />
			{(
				[
					[fx, fz],
					[-fx, fz],
					[fx, -fz],
					[-fx, -fz],
				] as const
			).map(([x, z]) => (
				<M key={`${x},${z}`} g={foot} m={MAT.steel} p={[x, 0.04, z]} />
			))}
		</group>
	);
}

/** One copy of a static instanced shape: position, rotation (applied x, z,
 * then yaw), and scale. */
export interface Xform {
	p: V3;
	r?: V3;
	s?: V3;
}

const tmp = new THREE.Object3D();
tmp.rotation.order = "YXZ";

/** Many copies of one shape in a single draw call. The layout never moves. */
export function Static({
	g,
	m,
	items,
	shadow = true,
}: {
	g: THREE.BufferGeometry;
	m: THREE.Material;
	items: Xform[];
	shadow?: boolean;
}) {
	const ref = useRef<THREE.InstancedMesh>(null);
	useLayoutEffect(() => {
		const mesh = ref.current;
		if (!mesh) return;
		items.forEach((it, i) => {
			tmp.position.set(...it.p);
			tmp.rotation.set(...(it.r ?? [0, 0, 0]));
			tmp.scale.set(...(it.s ?? [1, 1, 1]));
			tmp.updateMatrix();
			mesh.setMatrixAt(i, tmp.matrix);
		});
		mesh.instanceMatrix.needsUpdate = true;
		mesh.computeBoundingSphere();
	}, [items]);
	if (items.length === 0) return null;
	return (
		<instancedMesh
			key={items.length}
			ref={ref}
			args={[g, m, items.length]}
			castShadow={shadow}
			receiveShadow
		/>
	);
}
