// Save slots in IndexedDB. A save is the full sim JSON plus a small header
// for the load menu. The "auto" slot is overwritten once per game day.
import type { Difficulty } from "./types";

export interface SaveHeader {
	slot: string;
	name: string;
	day: number;
	cash: number;
	difficulty: Difficulty;
	savedAt: number;
}

interface SaveRecord extends SaveHeader {
	data: string;
}

export const AUTO_SLOT = "auto";
const DB_NAME = "actuator-works";
const STORE = "saves";

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(STORE, { keyPath: "slot" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function run<T>(
	mode: IDBTransactionMode,
	op: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const req = op(db.transaction(STORE, mode).objectStore(STORE));
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	} finally {
		db.close();
	}
}

export async function writeSave(header: SaveHeader, data: string) {
	const record: SaveRecord = { ...header, data };
	await run("readwrite", (s) => s.put(record));
}

export async function readSave(slot: string): Promise<string | null> {
	const rec = await run<SaveRecord | undefined>("readonly", (s) => s.get(slot));
	return rec?.data ?? null;
}

export async function listSaves(): Promise<SaveHeader[]> {
	const all = await run<SaveRecord[]>("readonly", (s) => s.getAll());
	return all
		.map(({ data: _data, ...header }) => header)
		.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot: string) {
	await run("readwrite", (s) => s.delete(slot));
}
