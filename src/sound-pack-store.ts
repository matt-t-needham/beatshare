import type { InstalledPack } from './types';
import type { SoundPackEntry } from './sound-packs';

const DB_NAME = 'beatshare-packs';
const DB_VERSION = 2;

export interface TreeEntry {
  path: string;
  size: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('packs')) {
        db.createObjectStore('packs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('samples')) {
        const store = db.createObjectStore('samples', { keyPath: ['packId', 'name'] });
        store.createIndex('byPack', 'packId', { unique: false });
      }
      if (!db.objectStoreNames.contains('github-trees')) {
        db.createObjectStore('github-trees', { keyPath: 'repoKey' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withTx<T>(
  stores: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => T | Promise<T>,
): Promise<T> {
  const db = await getDB();
  const tx = db.transaction(stores, mode);
  const txDone = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  const result = await fn(tx);
  await txDone;
  return result;
}

export async function savePack(
  entry: SoundPackEntry,
  samples: Map<string, ArrayBuffer>,
): Promise<void> {
  await withTx(['packs', 'samples'], 'readwrite', tx => {
    tx.objectStore('packs').put({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      license: entry.license,
    });
    const sampleStore = tx.objectStore('samples');
    for (const [name, data] of samples) {
      sampleStore.put({ packId: entry.id, name, data });
    }
  });
}

/** Add individual samples to an existing (or new) pack */
export async function addSamples(
  packId: string,
  packMeta: { name: string; description: string; license: string },
  samples: Map<string, ArrayBuffer>,
): Promise<void> {
  await withTx(['packs', 'samples'], 'readwrite', tx => {
    tx.objectStore('packs').put({ id: packId, ...packMeta });
    const sampleStore = tx.objectStore('samples');
    for (const [name, data] of samples) {
      sampleStore.put({ packId, name, data });
    }
  });
}

/** Remove a single sample from a pack */
export async function removeSample(packId: string, sampleName: string): Promise<void> {
  await withTx('samples', 'readwrite', tx => {
    tx.objectStore('samples').delete([packId, sampleName]);
  });
}

export async function getInstalledPacks(): Promise<InstalledPack[]> {
  return withTx(['packs', 'samples'], 'readonly', async tx => {
    const packs = await reqToPromise<Array<{ id: string; name: string; description: string; license: string }>>(
      tx.objectStore('packs').getAll(),
    );

    const result: InstalledPack[] = [];
    for (const pack of packs) {
      const keys = await reqToPromise<IDBValidKey[]>(
        tx.objectStore('samples').index('byPack').getAllKeys(pack.id),
      );
      const sampleNames = keys.map(k => (k as [string, string])[1]);
      result.push({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        license: pack.license,
        sampleNames,
      });
    }
    return result;
  });
}

export async function getPackSamples(packId: string): Promise<string[]> {
  return withTx('samples', 'readonly', async tx => {
    const keys = await reqToPromise<IDBValidKey[]>(
      tx.objectStore('samples').index('byPack').getAllKeys(packId),
    );
    return keys.map(k => (k as [string, string])[1]);
  });
}

export async function getSample(packId: string, sampleName: string): Promise<ArrayBuffer> {
  return withTx('samples', 'readonly', async tx => {
    const row = await reqToPromise<{ data: ArrayBuffer } | undefined>(
      tx.objectStore('samples').get([packId, sampleName]),
    );
    if (!row) throw new Error(`Sample not found: ${packId}/${sampleName}`);
    return row.data;
  });
}

/** Check if a sample exists in the store */
export async function hasSample(packId: string, sampleName: string): Promise<boolean> {
  try {
    return await withTx('samples', 'readonly', async tx => {
      const key = await reqToPromise<IDBValidKey | undefined>(
        tx.objectStore('samples').getKey([packId, sampleName]),
      );
      return key !== undefined;
    });
  } catch {
    return false;
  }
}

export async function removePack(packId: string): Promise<void> {
  await withTx(['packs', 'samples'], 'readwrite', async tx => {
    tx.objectStore('packs').delete(packId);
    const keys = await reqToPromise<IDBValidKey[]>(
      tx.objectStore('samples').index('byPack').getAllKeys(packId),
    );
    for (const key of keys) {
      tx.objectStore('samples').delete(key);
    }
  });
}

// --- GitHub tree cache ---

export async function saveTreeCache(repoKey: string, tree: TreeEntry[]): Promise<void> {
  await withTx('github-trees', 'readwrite', tx => {
    tx.objectStore('github-trees').put({ repoKey, tree, fetchedAt: Date.now() });
  });
}

export async function getTreeCache(repoKey: string): Promise<{ tree: TreeEntry[]; fetchedAt: number } | null> {
  try {
    return await withTx('github-trees', 'readonly', async tx => {
      const row = await reqToPromise<{ tree: TreeEntry[]; fetchedAt: number } | undefined>(
        tx.objectStore('github-trees').get(repoKey),
      );
      return row ? { tree: row.tree, fetchedAt: row.fetchedAt } : null;
    });
  } catch {
    return null;
  }
}
