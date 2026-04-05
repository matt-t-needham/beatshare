export interface SoundPackEntry {
  id: string;
  name: string;
  description: string;
  license: string;
  source: string;
  url: string;
  zipUrl?: string;
  estimatedSize: string;
  samples?: string[];
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
}

export const SOUND_PACK_DIRECTORY: SoundPackEntry[] = [
  {
    id: 'fluid-open-drums',
    name: 'Open Drums (fluid-music)',
    description: 'TR-707, TR-808, and TR-909 drum machine samples — kicks, snares, hats, toms, cymbals, and more',
    license: 'Open source (free distribution)',
    source: 'GitHub',
    url: 'https://github.com/fluid-music/open-drums',
    zipUrl: 'https://github.com/fluid-music/open-drums/archive/refs/heads/main.zip',
    estimatedSize: '~12 MB',
  },
  {
    id: 'pumodi-open-samples',
    name: 'Open Samples',
    description: 'Synths, keyboards, pianos, strings, wind, percussion, and music boxes from vintage hardware',
    license: 'Open Samples Permissive Use Public License v2',
    source: 'GitHub',
    url: 'https://github.com/pumodi/open-samples',
    estimatedSize: '~8.5 GB (spin fetches ~1 MB at a time)',
    repoOwner: 'pumodi',
    repoName: 'open-samples',
    repoBranch: 'main',
  },
];
