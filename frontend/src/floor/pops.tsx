// Things that happen show up where they happen: money floats up from the
// shipping dock, trucks unload at receiving, a bolt flashes over a machine
// that just broke. Each pop is a short-lived floor label.
import type { ReactNode } from "react";
import type { GameEvent, Item, StationKind } from "../sim/types";
import { formatMoneyCompact } from "../ui/format";
import { Glyph } from "../ui/visual/glyphs";
import { ItemIcon } from "../ui/visual/icons";
import { CELL_HALF_D, RECEIVING, SHIPPING, STATION_POS } from "./layout";

export interface Pop {
	id: string;
	anchor: [number, number, number];
	content: ReactNode;
	className: string;
}

const at = {
	receiving: [RECEIVING[0], 2.4, RECEIVING[1]] as [number, number, number],
	shipping: [SHIPPING[0], 2.4, SHIPPING[1]] as [number, number, number],
	station: (k: StationKind): [number, number, number] => {
		const [x, z] = STATION_POS[k];
		return [x, 3.4, z - CELL_HALF_D * 0.4];
	},
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

/** The pop for an event, or null for events that stay off the floor. */
export function popFor(e: GameEvent): Omit<Pop, "id"> | null {
	const k = e.kind;
	const station = str(k.station) as StationKind;
	const item = str(k.item) as Item;
	switch (k.type) {
		case "shipped":
			return {
				anchor: at.shipping,
				className: "pop good",
				content: (
					<>
						<Glyph name="coin" size={16} />+{formatMoneyCompact(num(k.revenue))}
					</>
				),
			};
		case "order_arrived":
			return {
				anchor: at.receiving,
				className: "pop info",
				content: (
					<>
						<Glyph name="truck" size={14} />
						<ItemIcon item={item} size={16} />+{num(k.qty)}
					</>
				),
			};
		case "iqc_rejected":
			return {
				anchor: at.receiving,
				className: "pop bad",
				content: (
					<>
						<ItemIcon item={item} size={16} />
						<Glyph name="cross" size={14} />
						<Glyph name="back" size={14} />
					</>
				),
			};
		case "field_failure":
			return {
				anchor: at.shipping,
				className: "pop bad",
				content: (
					<>
						<Glyph name="back" size={14} />
						<ItemIcon item="finished_good" size={16} />
						{num(k.units)} · -{formatMoneyCompact(num(k.cost))}
					</>
				),
			};
		case "contract_completed":
			return {
				anchor: at.shipping,
				className: "pop gold",
				content: <Glyph name="star" size={20} />,
			};
		case "breakdown":
			return {
				anchor: at.station(station),
				className: "pop bad",
				content: <Glyph name="bolt" size={20} />,
			};
		case "maintenance_started":
			return {
				anchor: at.station(station),
				className: "pop info",
				content: <Glyph name="wrench" size={18} />,
			};
		case "spc_alarm":
			return {
				anchor: at.station(station),
				className: "pop warn",
				content: <Glyph name="alert" size={18} />,
			};
		case "machine_bought":
		case "machine_sold": {
			const bought = k.type === "machine_bought";
			return {
				anchor: at.station(station),
				className: bought ? "pop good" : "pop info",
				content: (
					<>
						<Glyph name={bought ? "plus" : "minus"} size={14} />1
					</>
				),
			};
		}
		default:
			return null;
	}
}
