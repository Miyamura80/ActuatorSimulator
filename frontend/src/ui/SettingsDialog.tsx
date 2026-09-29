import { useEffect, useRef } from "react";
import { configureAudio, sfx } from "../audio/sfx";
import { type Settings, saveSettings } from "../settings";

interface Props {
	settings: Settings;
	onChange: (s: Settings) => void;
	onClose: () => void;
}

export function SettingsDialog({ settings, onChange, onClose }: Props) {
	const update = (patch: Partial<Settings>) => {
		const next = { ...settings, ...patch };
		saveSettings(next);
		configureAudio(next);
		onChange(next);
	};
	// Modal: focus the dialog's main action, close on Esc, and hand focus back
	// to whatever opened it.
	const doneRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		doneRef.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("keydown", onKey);
			opener?.focus();
		};
	}, [onClose]);
	return (
		<div className="overlay">
			<div
				className="dialog settings"
				role="dialog"
				aria-modal="true"
				aria-labelledby="settings-title"
			>
				<h2 id="settings-title">Settings</h2>
				<label className="row">
					<span>Volume</span>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={settings.volume}
						onChange={(e) => update({ volume: Number(e.target.value) })}
						onPointerUp={() => sfx.click()}
					/>
				</label>
				<label className="check">
					<input
						type="checkbox"
						checked={settings.muted}
						onChange={(e) => update({ muted: e.target.checked })}
					/>
					Mute all sound
				</label>
				<label className="check">
					<input
						type="checkbox"
						checked={settings.ambience}
						onChange={(e) => update({ ambience: e.target.checked })}
					/>
					Factory ambience
				</label>
				<label className="check">
					<input
						type="checkbox"
						checked={!settings.tutorialDone}
						onChange={(e) => update({ tutorialDone: !e.target.checked })}
					/>
					Offer the tutorial on the title screen
				</label>
				<p className="muted small">
					Shortcuts: Space pause/resume · 1 / 2 / 3 speed · Esc close panels and
					dialogs
				</p>
				<button
					ref={doneRef}
					type="button"
					className="primary"
					onClick={onClose}
				>
					Done
				</button>
			</div>
		</div>
	);
}
