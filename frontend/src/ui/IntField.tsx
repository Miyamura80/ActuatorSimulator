import { useEffect, useState } from "react";

interface Props {
	value: number;
	min: number;
	onCommit: (n: number) => void;
	label?: string;
	placeholder?: string;
}

/**
 * Whole-number input. The field may sit empty or hold a partial value while
 * the player types; only whole numbers >= `min` are committed, and leaving
 * the field restores the last committed value.
 */
export function IntField({ value, min, onCommit, label, placeholder }: Props) {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);
	return (
		<input
			type="number"
			inputMode="numeric"
			min={min}
			step={1}
			value={draft}
			aria-label={label}
			placeholder={placeholder}
			onChange={(e) => {
				setDraft(e.target.value);
				const n = Number(e.target.value);
				if (e.target.value.trim() !== "" && Number.isInteger(n) && n >= min) {
					onCommit(n);
				}
			}}
			onBlur={() => setDraft(String(value))}
		/>
	);
}
