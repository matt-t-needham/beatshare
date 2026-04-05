import { classifySample } from './sample-categories';
import { addSamples, removeSample, getPackSamples, saveTreeCache, getTreeCache, type TreeEntry } from './sound-pack-store';

const SPIN_PACK_ID = 'pumodi-open-samples';
const REPO_OWNER = 'pumodi';
const REPO_NAME = 'open-samples';
const REPO_BRANCH = 'main';
const MAX_FILE_SIZE = 512_000; // 500KB
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

export { SPIN_PACK_ID };

export const SPIN_PACK_META = {
  name: 'Open Samples',
  description: 'Synths, keyboards, pianos, strings, wind, percussion, and music boxes from vintage hardware',
  license: 'Open Samples Permissive Use Public License v2',
};

/** Fetch and cache the repo file tree, filtering to small .wav files */
export async function fetchTree(): Promise<TreeEntry[]> {
  const repoKey = `${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;
  const cached = await getTreeCache(repoKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE) {
    return cached.tree;
  }

  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=1`
  );
  if (!resp.ok) {
    if (resp.status === 403) throw new Error('GitHub rate limit reached. Try again later.');
    throw new Error(`Failed to fetch file list: ${resp.status}`);
  }

  const data = await resp.json();
  const filtered: TreeEntry[] = data.tree
    .filter((e: any) =>
      e.type === 'blob' &&
      e.path.toLowerCase().endsWith('.wav') &&
      e.size <= MAX_FILE_SIZE
    )
    .map((e: any) => ({ path: e.path, size: e.size }));

  await saveTreeCache(repoKey, filtered);
  return filtered;
}

/** Pick random samples spread across categories */
export function pickRandom(
  tree: TreeEntry[],
  count: number,
  exclude: Set<string> = new Set(),
): TreeEntry[] {
  const available = tree.filter(e => !exclude.has(e.path));

  // Group by category
  const byCategory = new Map<string, TreeEntry[]>();
  for (const entry of available) {
    const cat = classifySample(entry.path);
    if (!byCategory.has(cat.id)) byCategory.set(cat.id, []);
    byCategory.get(cat.id)!.push(entry);
  }

  // Shuffle each category's entries
  for (const entries of byCategory.values()) {
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
  }

  // Round-robin pick from shuffled categories
  const catIds = [...byCategory.keys()];
  for (let i = catIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [catIds[i], catIds[j]] = [catIds[j], catIds[i]];
  }

  const picks: TreeEntry[] = [];
  const catIdx = new Map<string, number>();
  let round = 0;
  while (picks.length < count) {
    let picked = false;
    for (const catId of catIds) {
      if (picks.length >= count) break;
      const entries = byCategory.get(catId)!;
      const idx = catIdx.get(catId) ?? 0;
      if (idx < entries.length) {
        picks.push(entries[idx]);
        catIdx.set(catId, idx + 1);
        picked = true;
      }
    }
    if (!picked) break; // all categories exhausted
    round++;
  }

  return picks;
}

/** Download a single sample from raw GitHub. Returns null on 404. */
async function downloadOne(path: string): Promise<ArrayBuffer | null> {
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${encodeURI(path)}`;
  const resp = await fetch(url);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Failed to download ${path}: ${resp.status}`);
  return resp.arrayBuffer();
}

export interface DownloadProgress {
  picked: string[];
  completed: Set<string>;
  failed: Set<string>;
}

/** Download multiple samples with concurrency limit, 404 retry, and per-item progress */
export async function downloadSamples(
  entries: TreeEntry[],
  onItemDone?: (path: string, progress: DownloadProgress) => void,
  tree?: TreeEntry[],
  exclude?: Set<string>,
): Promise<Map<string, ArrayBuffer>> {
  const results = new Map<string, ArrayBuffer>();
  const completed = new Set<string>();
  const failed = new Set<string>();
  const picked = entries.map(e => e.path);
  const concurrency = 3;
  const maxRetries = 3;

  const queue = [...entries];
  async function worker() {
    while (queue.length > 0) {
      const entry = queue.shift()!;
      const data = await downloadOne(entry.path);
      if (data === null) {
        // 404 — try to pick a replacement
        failed.add(entry.path);
        if (tree) {
          const allExcluded = new Set([...(exclude ?? []), ...picked, ...failed]);
          const replacement = pickRandom(tree, 1, allExcluded);
          if (replacement.length > 0) {
            const idx = picked.indexOf(entry.path);
            if (idx >= 0) picked[idx] = replacement[0].path;
            else picked.push(replacement[0].path);
            queue.push(replacement[0]);
          }
        }
        onItemDone?.(entry.path, { picked: [...picked], completed, failed });
        continue;
      }
      results.set(entry.path, data);
      completed.add(entry.path);
      onItemDone?.(entry.path, { picked: [...picked], completed, failed });
    }
  }

  // Retry loop: download, then check for any failures that got replacements queued
  let retries = 0;
  while (retries <= maxRetries) {
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
    if (queue.length === 0) break;
    retries++;
  }

  return results;
}

export type SpinMode = 'fresh' | 'add' | 'respin';

export interface SpinResult {
  newSamples: string[];
  /** For respin: maps old sample name → new sample name */
  remapping?: Map<string, string>;
}

/**
 * Execute a spin operation.
 * - fresh/add: pick and download new samples
 * - respin: replace existing samples, return remapping for updating tracks
 */
export async function executeSpin(
  mode: SpinMode,
  count: number,
  onProgress?: (status: string) => void,
  onDownloadProgress?: (progress: DownloadProgress) => void,
): Promise<SpinResult> {
  onProgress?.('Fetching sample list...');
  const tree = await fetchTree();

  const existingNames = mode === 'fresh'
    ? []
    : await getPackSamples(SPIN_PACK_ID).catch(() => []);

  const exclude = mode === 'add' ? new Set(existingNames) : new Set<string>();
  const picks = pickRandom(tree, count, exclude);

  if (picks.length === 0) throw new Error('No suitable samples found');

  // Report initial picks
  onDownloadProgress?.({
    picked: picks.map(p => p.path),
    completed: new Set(),
    failed: new Set(),
  });

  onProgress?.(`Downloading ${picks.length} samples...`);
  const samples = await downloadSamples(
    picks,
    (_path, progress) => {
      onDownloadProgress?.(progress);
      onProgress?.(`Downloading ${progress.completed.size}/${progress.picked.length}...`);
    },
    tree,
    exclude,
  );

  // For respin: remove old samples and build remapping
  let remapping: Map<string, string> | undefined;
  if (mode === 'respin' && existingNames.length > 0) {
    remapping = new Map<string, string>();
    const newNames = [...samples.keys()];
    for (let i = 0; i < existingNames.length; i++) {
      const newName = newNames[i % newNames.length];
      remapping.set(existingNames[i], newName);
    }
    // Remove old samples
    for (const name of existingNames) {
      await removeSample(SPIN_PACK_ID, name);
    }
  }

  onProgress?.('Saving...');
  await addSamples(SPIN_PACK_ID, SPIN_PACK_META, samples);

  return { newSamples: [...samples.keys()], remapping };
}

/** Fetch individual samples by path (for auto-fetch on shared URLs) */
export async function fetchMissingSamples(
  paths: string[],
  onProgress?: (status: string) => void,
): Promise<void> {
  const entries = paths.map(p => ({ path: p, size: 0 }));
  onProgress?.(`Downloading ${paths.length} samples...`);
  const samples = await downloadSamples(entries, (done, total) => {
    onProgress?.(`Downloading ${done}/${total}...`);
  });
  await addSamples(SPIN_PACK_ID, SPIN_PACK_META, samples);
}
