// Save slots in IndexedDB. Headers (for the load menu) and the full sim JSON
// live in separate stores so listing slots never reads the big payloads. The
// "auto" slot is overwritten once per game day.
import type { Difficulty } from "./types";

export interface SaveHeader {
	slot: string;
	name: string;
	day: number;
	cash: number;
	difficulty: Difficulty;
	savedAt: number;
}

interface SaveData {
	slot: string;
	data: string;
}

export const AUTO_SLOT = "auto";
const DB_NAME = "actuator-works";
const HEADERS = "headers";
const DATA = "data";

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			req.result.createObjectStore(HEADERS, { keyPath: "slot" });
			req.result.createObjectStore(DATA, { keyPath: "slot" });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

/**
 * Run `op` in one transaction. Resolves with `op`'s result only once the
 * transaction commits, so a later abort is reported as a failure.
 */
async function run<T>(
	stores: string[],
	mode: IDBTransactionMode,
	op: (tx: IDBTransaction) => IDBRequest<T> | undefined,
): Promise<T | undefined> {
	const db = await open();
	try {
		return await new Promise<T | undefined>((resolve, reject) => {
			const tx = db.transaction(stores, mode);
			const req = op(tx);
			tx.oncomplete = () => resolve(req?.result);
			tx.onabort = () => reject(tx.error ?? new Error("save aborted"));
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

export async function writeSave(header: SaveHeader, data: string) {
	const record: SaveData = { slot: header.slot, data };
	await run([HEADERS, DATA], "readwrite", (tx) => {
		tx.objectStore(DATA).put(record);
		tx.objectStore(HEADERS).put(header);
		return undefined;
	});
}

export async function readSave(slot: string): Promise<string | null> {
	const rec = await run<SaveData | undefined>([DATA], "readonly", (tx) =>
		tx.objectStore(DATA).get(slot),
	);
	return rec?.data ?? null;
}

export async function listSaves(): Promise<SaveHeader[]> {
	const all = await run<SaveHeader[]>([HEADERS], "readonly", (tx) =>
		tx.objectStore(HEADERS).getAll(),
	);
	return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSave(slot: string) {
	await run([HEADERS, DATA], "readwrite", (tx) => {
		tx.objectStore(HEADERS).delete(slot);
		tx.objectStore(DATA).delete(slot);
		return undefined;
	});
}
