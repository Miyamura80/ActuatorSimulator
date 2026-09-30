// Screen-space labels for 3D anchors. Plain DOM outside the canvas, moved
// every frame by a projector inside it. (drei's <Html> creates a React root
// per label, which races StrictMode's double mount under React 19 and can
// drop labels.)
import { useFrame, useThree } from "@react-three/fiber";
import type { ReactNode, RefObject } from "react";
import * as THREE from "three";

export interface Label {
	id: string;
	text: string;
	/** Rendered instead of `text` when present. */
	content?: ReactNode;
	anchor: [number, number, number];
	className: string;
}

type Refs = RefObject<Map<string, HTMLDivElement>>;

const v = new THREE.Vector3();

/** Lives inside <Canvas>; positions the DOM labels. */
export function LabelProjector({
	labels,
	refs,
}: {
	labels: Label[];
	refs: Refs;
}) {
	const { camera, size } = useThree();
	useFrame(() => {
		for (const l of labels) {
			const el = refs.current?.get(l.id);
			if (!el) continue;
			v.set(...l.anchor).project(camera);
			const x = ((v.x + 1) / 2) * size.width;
			const y = ((1 - v.y) / 2) * size.height;
			el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
		}
	});
	return null;
}

/** Lives next to <Canvas>, in a positioned container. */
export function LabelLayer({ labels, refs }: { labels: Label[]; refs: Refs }) {
	return (
		<div className="label-layer" aria-hidden="true">
			{labels.map((l) => (
				<div
					key={l.id}
					className={`floor-label ${l.className}`}
					ref={(el) => {
						if (el) refs.current?.set(l.id, el);
						else refs.current?.delete(l.id);
					}}
				>
					{l.content ?? l.text}
				</div>
			))}
		</div>
	);
}
