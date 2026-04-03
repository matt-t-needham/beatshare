export interface SoundPackEntry {
  id: string;
  name: string;
  description: string;
  license: string;
  source: string;
  url: string;
  samples?: string[];  // known sample filenames
}

// Built-in directory of known open-source sample packs
export const SOUND_PACK_DIRECTORY: SoundPackEntry[] = [
  {
    id: 'gregharvey-drums',
    name: 'gregharvey/drum-samples',
    description: 'Acoustic drum kit samples — kicks, snares, hats, toms, cymbals',
    license: 'Open source',
    source: 'GitHub',
    url: 'https://github.com/gregharvey/drum-samples',
  },
  {
    id: 'pumodi-open-samples',
    name: 'pumodi/open-samples',
    description: 'Growing collection of royalty-free instrument samples',
    license: 'Royalty-free',
    source: 'GitHub',
    url: 'https://github.com/pumodi/open-samples',
  },
  {
    id: 'open-source-drumkit',
    name: 'crabacus/the-open-source-drumkit',
    description: 'Real Music Media open drumkit — full kit samples',
    license: 'Open source',
    source: 'GitHub',
    url: 'https://github.com/crabacus/the-open-source-drumkit',
  },
  {
    id: 'fluid-open-drums',
    name: 'fluid-music/open-drums',
    description: 'Web-optimized drum sample libraries',
    license: 'Open source',
    source: 'GitHub',
    url: 'https://github.com/fluid-music/open-drums',
  },
];
