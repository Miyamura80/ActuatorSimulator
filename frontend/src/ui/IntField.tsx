import { useEffect, useState } from "react";

/** The sim takes these as `u32`. */
const U32_MAX = 0xffff_ffff;

interface Props {
	value: number;
	min: number;
	max?: number;
	onCommit: (n: number) => void;
	label?: string;
	placeholder?: string;
}

/**
 * Whole-number input. The field may sit empty or hold a partial value while
 * the player types; only whole numbers in `[min, max]` are committed, and leaving
 * the field restores the last committed value.
 */
export function IntField({
	value,
	min,
	max = U32_MAX,
	onCommit,
	label,
	placeholder,
}: Props) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return (
		<input
			type="number"
			inputMode="numeric"
			min={min}
			max={max}
			step={1}
			value={draft}
			aria-label={label}
			placeholder={placeholder}
			onChange={(e) => {
				setDraft(e.target.value);
				const n = Number(e.target.value);
				if (
					e.target.value.trim() !== "" &&
					Number.isInteger(n) &&
					n >= min &&
					n <= max
				) {
					onCommit(n);
				}
			}}
			onBlur={() => setDraft(String(value))}
		/>
	);
}
