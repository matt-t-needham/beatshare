import type { InstalledPack } from './types';
import type { SoundPackEntry } from './sound-packs';

const DB_NAME = 'beatshare-packs';
const DB_VERSION = 2;

export interface TreeEntry {
  path: string;
  size: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
    req.onerror = () => reject(req.error);
  });
}

export async function savePack(
  entry: SoundPackEntry,
  samples: Map<string, ArrayBuffer>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['packs', 'samples'], 'readwrite');

  const packStore = tx.objectStore('packs');
  packStore.put({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    license: entry.license,
  });

  const sampleStore = tx.objectStore('samples');
  for (const [name, data] of samples) {
    sampleStore.put({ packId: entry.id, name, data });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Add individual samples to an existing (or new) pack */
export async function addSamples(
  packId: string,
  packMeta: { name: string; description: string; license: string },
  samples: Map<string, ArrayBuffer>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['packs', 'samples'], 'readwrite');

  // Ensure pack metadata exists
  tx.objectStore('packs').put({ id: packId, ...packMeta });

  const sampleStore = tx.objectStore('samples');
  for (const [name, data] of samples) {
    sampleStore.put({ packId, name, data });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Remove a single sample from a pack */
export async function removeSample(packId: string, sampleName: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('samples', 'readwrite');
  tx.objectStore('samples').delete([packId, sampleName]);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getInstalledPacks(): Promise<InstalledPack[]> {
  const db = await openDB();
  const tx = db.transaction(['packs', 'samples'], 'readonly');

  const packs: any[] = await new Promise((resolve, reject) => {
    const req = tx.objectStore('packs').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const result: InstalledPack[] = [];
  for (const pack of packs) {
    const sampleNames: string[] = await new Promise((resolve, reject) => {
      const idx = tx.objectStore('samples').index('byPack');
      const req = idx.getAllKeys(pack.id);
      req.onsuccess = () => resolve(req.result.map((k: any) => k[1]));
      req.onerror = () => reject(req.error);
    });
    result.push({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      license: pack.license,
      sampleNames,
    });
  }

  db.close();
  return result;
}

export async function getPackSamples(packId: string): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction('samples', 'readonly');
  const idx = tx.objectStore('samples').index('byPack');

  return new Promise((resolve, reject) => {
    const req = idx.getAllKeys(packId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result.map((k: any) => k[1]));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getSample(packId: string, sampleName: string): Promise<ArrayBuffer> {
  const db = await openDB();
  const tx = db.transaction('samples', 'readonly');
  const store = tx.objectStore('samples');

  return new Promise((resolve, reject) => {
    const req = store.get([packId, sampleName]);
    req.onsuccess = () => {
      db.close();
      if (!req.result) reject(new Error(`Sample not found: ${packId}/${sampleName}`));
      else resolve(req.result.data);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Check if a sample exists in the store */
export async function hasSample(packId: string, sampleName: string): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction('samples', 'readonly');
  const store = tx.objectStore('samples');

  return new Promise((resolve) => {
    const req = store.getKey([packId, sampleName]);
    req.onsuccess = () => { db.close(); resolve(!!req.result); };
    req.onerror = () => { db.close(); resolve(false); };
  });
}

export async function removePack(packId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['packs', 'samples'], 'readwrite');

  tx.objectStore('packs').delete(packId);

  // Delete all samples for this pack
  const idx = tx.objectStore('samples').index('byPack');
  const keys: IDBValidKey[] = await new Promise((resolve, reject) => {
    const req = idx.getAllKeys(packId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const key of keys) {
    tx.objectStore('samples').delete(key);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// --- GitHub tree cache ---

export async function saveTreeCache(repoKey: string, tree: TreeEntry[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('github-trees', 'readwrite');
  tx.objectStore('github-trees').put({ repoKey, tree, fetchedAt: Date.now() });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getTreeCache(repoKey: string): Promise<{ tree: TreeEntry[]; fetchedAt: number } | null> {
  const db = await openDB();
  const tx = db.transaction('github-trees', 'readonly');

  return new Promise((resolve) => {
    const req = tx.objectStore('github-trees').get(repoKey);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ? { tree: req.result.tree, fetchedAt: req.result.fetchedAt } : null);
    };
    req.onerror = () => { db.close(); resolve(null); };
  });
}
