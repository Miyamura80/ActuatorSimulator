// General symbols (truck, wrench, coin...). They take `currentColor`, so
// CSS decides the tone.
import type { ReactNode } from "react";

export const INK = "#15181b";

export function Svg({
	size,
	title,
	children,
	className,
}: {
	size: number;
	title?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<svg
			className={`icon ${className ?? ""}`}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
		>
			{title && <title>{title}</title>}
			{children}
		</svg>
	);
}

const GLYPHS = {
	truck: (
		<>
			<rect x="2" y="6" width="12" height="10" rx="1" fill="currentColor" />
			<path d="M14 9h4l3 4v3h-7z" fill="currentColor" opacity="0.75" />
			<circle cx="6" cy="18" r="2" fill="currentColor" />
			<circle cx="17" cy="18" r="2" fill="currentColor" />
		</>
	),
	wrench: (
		<path
			d="M14.5 3a5 5 0 0 0-4.6 6.8L3 16.7 7.3 21l6.9-6.9A5 5 0 0 0 21 9.5l-3 3-3.5-1-1-3.5 3-3a5 5 0 0 0-2-.5z"
			fill="currentColor"
		/>
	),
	bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor" />,
	alert: (
		<>
			<path d="M12 3L2 20h20z" fill="currentColor" />
			<rect x="11" y="9" width="2" height="6" fill={INK} />
			<rect x="11" y="16.5" width="2" height="2" fill={INK} />
		</>
	),
	coin: (
		<>
			<circle cx="12" cy="12" r="9" fill="currentColor" />
			<path
				d="M14.5 8.5h-3.5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9.5M12 6.5v11"
				stroke={INK}
				strokeWidth="1.6"
				fill="none"
			/>
		</>
	),
	clock: (
		<>
			<circle
				cx="12"
				cy="12"
				r="9"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" fill="none" />
		</>
	),
	eye: (
		<>
			<path
				d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
				fill="currentColor"
			/>
			<circle cx="12" cy="12" r="3.5" fill={INK} />
		</>
	),
	plus: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" fill="currentColor" />,
	minus: <rect x="4" y="10" width="16" height="4" fill="currentColor" />,
	check: (
		<path
			d="M4 12l5 5L20 6"
			stroke="currentColor"
			strokeWidth="3"
			fill="none"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	),
	cross: (
		<path
			d="M5 5l14 14M19 5L5 19"
			stroke="currentColor"
			strokeWidth="3"
			strokeLinecap="round"
		/>
	),
	user: (
		<>
			<circle cx="12" cy="8" r="4" fill="currentColor" />
			<path d="M4 21a8 8 0 0 1 16 0z" fill="currentColor" />
		</>
	),
	back: (
		<path
			d="M9 5L3 11l6 6M3 11h11a6 6 0 0 1 0 12"
			stroke="currentColor"
			strokeWidth="2.5"
			fill="none"
			strokeLinecap="round"
		/>
	),
	star: (
		<path
			d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z"
			fill="currentColor"
		/>
	),
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({
	name,
	size = 16,
	title,
	className,
}: {
	name: GlyphName;
	size?: number;
	title?: string;
	className?: string;
}) {
	return (
		<Svg size={size} title={title} className={className}>
			{GLYPHS[name]}
		</Svg>
	);
}
