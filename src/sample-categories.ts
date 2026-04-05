export interface SampleCategory {
  id: string;
  name: string;
  abbr: string;      // 3-letter abbreviation
  bgColor: string;   // tailwind bg class for active step
  hoverColor: string; // tailwind hover bg class
  sortOrder: number;
}

const CATEGORIES: SampleCategory[] = [
  { id: 'kick',      name: 'Kick',           abbr: 'Kck', bgColor: 'bg-red-600',     hoverColor: 'hover:bg-red-500',     sortOrder: 0 },
  { id: 'snare',     name: 'Snare',          abbr: 'Snr', bgColor: 'bg-blue-600',    hoverColor: 'hover:bg-blue-500',    sortOrder: 1 },
  { id: 'hh-closed', name: 'Hi-Hat Closed',  abbr: 'HHC', bgColor: 'bg-yellow-600',  hoverColor: 'hover:bg-yellow-500',  sortOrder: 2 },
  { id: 'hh-open',   name: 'Hi-Hat Open',    abbr: 'HHO', bgColor: 'bg-amber-600',   hoverColor: 'hover:bg-amber-500',   sortOrder: 3 },
  { id: 'crash',     name: 'Crash',          abbr: 'Crs', bgColor: 'bg-green-600',   hoverColor: 'hover:bg-green-500',   sortOrder: 4 },
  { id: 'ride',      name: 'Ride',           abbr: 'Rid', bgColor: 'bg-teal-600',    hoverColor: 'hover:bg-teal-500',    sortOrder: 5 },
  { id: 'tom-hi',    name: 'Tom High',       abbr: 'HTm', bgColor: 'bg-indigo-600',  hoverColor: 'hover:bg-indigo-500',  sortOrder: 6 },
  { id: 'tom-mid',   name: 'Tom Mid',        abbr: 'MTm', bgColor: 'bg-violet-600',  hoverColor: 'hover:bg-violet-500',  sortOrder: 7 },
  { id: 'tom-low',   name: 'Tom Low',        abbr: 'LTm', bgColor: 'bg-purple-600',  hoverColor: 'hover:bg-purple-500',  sortOrder: 8 },
  { id: 'clap',      name: 'Clap',           abbr: 'Clp', bgColor: 'bg-pink-600',    hoverColor: 'hover:bg-pink-500',    sortOrder: 9 },
  { id: 'cowbell',   name: 'Cowbell',        abbr: 'Cow', bgColor: 'bg-orange-600',  hoverColor: 'hover:bg-orange-500',  sortOrder: 10 },
  { id: 'rimshot',   name: 'Rimshot',        abbr: 'Rim', bgColor: 'bg-slate-500',   hoverColor: 'hover:bg-slate-400',   sortOrder: 11 },
  { id: 'tambourine',name: 'Tambourine',     abbr: 'Tmb', bgColor: 'bg-lime-600',    hoverColor: 'hover:bg-lime-500',    sortOrder: 12 },
  // Instrument categories (for synth/sample packs like open-samples)
  { id: 'piano',     name: 'Piano',          abbr: 'Pno', bgColor: 'bg-emerald-600', hoverColor: 'hover:bg-emerald-500', sortOrder: 13 },
  { id: 'keys',      name: 'Keys',           abbr: 'Key', bgColor: 'bg-cyan-600',    hoverColor: 'hover:bg-cyan-500',    sortOrder: 14 },
  { id: 'synth',     name: 'Synth',          abbr: 'Syn', bgColor: 'bg-fuchsia-600', hoverColor: 'hover:bg-fuchsia-500', sortOrder: 15 },
  { id: 'strings',   name: 'Strings',        abbr: 'Str', bgColor: 'bg-rose-600',    hoverColor: 'hover:bg-rose-500',    sortOrder: 16 },
  { id: 'wind',      name: 'Wind',           abbr: 'Wnd', bgColor: 'bg-sky-600',     hoverColor: 'hover:bg-sky-500',     sortOrder: 17 },
  { id: 'vocal',     name: 'Vocal',          abbr: 'Vox', bgColor: 'bg-amber-500',   hoverColor: 'hover:bg-amber-400',   sortOrder: 18 },
  { id: 'musicbox',  name: 'Music Box',      abbr: 'Box', bgColor: 'bg-yellow-500',  hoverColor: 'hover:bg-yellow-400',  sortOrder: 19 },
  { id: 'perc',      name: 'Percussion',     abbr: 'Prc', bgColor: 'bg-orange-500',  hoverColor: 'hover:bg-orange-400',  sortOrder: 20 },
  { id: 'other',     name: 'Other',          abbr: 'Oth', bgColor: 'bg-zinc-500',    hoverColor: 'hover:bg-zinc-400',    sortOrder: 21 },
];

const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.id, c]));

export function getCategory(id: string): SampleCategory {
  return CATEGORY_MAP.get(id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function getAllCategories(): SampleCategory[] {
  return CATEGORIES;
}

// Pattern rules: [regex, category id]
const RULES: [RegExp, string][] = [
  // TR-707 descriptive names
  [/BassDrum/i, 'kick'],
  [/Snare/i, 'snare'],
  [/HhC\b/i, 'hh-closed'],
  [/HhO\b/i, 'hh-open'],
  [/Crash/i, 'crash'],
  [/Ride/i, 'ride'],
  [/HiTom/i, 'tom-hi'],
  [/MedTom/i, 'tom-mid'],
  [/LowTom/i, 'tom-low'],
  [/HandClap/i, 'clap'],
  [/CowBell/i, 'cowbell'],
  [/RimShot/i, 'rimshot'],
  [/Tamb/i, 'tambourine'],

  // TR-909 prefixes (before TR-808 since some overlap)
  [/^BT\d/i, 'kick'],            // BT = bass drum with tune param
  [/^CSHD/i, 'snare'],           // crash/snare hybrid
  [/^HHCD/i, 'hh-closed'],
  [/^HHOD/i, 'hh-open'],
  [/^HANDCLP/i, 'clap'],
  [/^RIM\d/i, 'rimshot'],
  [/^RIDE/i, 'ride'],
  [/^OPCL/i, 'crash'],           // open/close cymbal

  // TR-808 directory-style prefixes (BD0000.WAV etc)
  [/^BD\d/i, 'kick'],
  [/^SD\d/i, 'snare'],
  [/^CH\d/i, 'hh-closed'],
  [/^HC\d/i, 'hh-closed'],
  [/^OH\d/i, 'hh-open'],
  [/^CY\d/i, 'crash'],
  [/^HT\d/i, 'tom-hi'],
  [/^MT\d/i, 'tom-mid'],
  [/^LT\d/i, 'tom-low'],
  [/^CP\d/i, 'clap'],
  [/^CL\d/i, 'clap'],
  [/^CB\d/i, 'cowbell'],
  [/^RS\d/i, 'rimshot'],
  [/^MA\d/i, 'other'],
  [/^MC\d/i, 'other'],

  // Instrument categories (open-samples directory structure + generic)
  [/Pianos\//i, 'piano'],
  [/piano/i, 'piano'],
  [/Keyboards\//i, 'keys'],
  [/wurlitzer/i, 'keys'],
  [/organ/i, 'keys'],
  [/keyboard/i, 'keys'],
  [/Synthesizers\//i, 'synth'],
  [/synth/i, 'synth'],
  [/StringedInstruments\//i, 'strings'],
  [/string/i, 'strings'],
  [/zither/i, 'strings'],
  [/WindInstruments\//i, 'wind'],
  [/wind/i, 'wind'],
  [/flute/i, 'wind'],
  [/brass/i, 'wind'],
  [/Choral\//i, 'vocal'],
  [/choral/i, 'vocal'],
  [/vocal/i, 'vocal'],
  [/MusicBox/i, 'musicbox'],
  [/music.?box/i, 'musicbox'],
  [/PercussionInstruments\//i, 'perc'],
  [/OneShotSamples\//i, 'perc'],

  // Generic fallbacks (for unknown packs)
  [/kick|bass.?drum|bd/i, 'kick'],
  [/snare|sd/i, 'snare'],
  [/closed.?h|ch\b|hhc|hi.?hat.*c/i, 'hh-closed'],
  [/open.?h|oh\b|hho|hi.?hat.*o/i, 'hh-open'],
  [/hi.?hat|hh\b/i, 'hh-closed'],
  [/crash|cym/i, 'crash'],
  [/ride/i, 'ride'],
  [/tom/i, 'tom-mid'],
  [/clap/i, 'clap'],
  [/cow/i, 'cowbell'],
  [/rim/i, 'rimshot'],
  [/tamb/i, 'tambourine'],
];

export function classifySample(filename: string): SampleCategory {
  // Test against full path (for directory-based classification) and basename
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const basename = withoutExt.split('/').pop() || withoutExt;

  for (const [pattern, catId] of RULES) {
    if (pattern.test(withoutExt) || pattern.test(basename)) {
      return getCategory(catId);
    }
  }
  return getCategory('other');
}

// --- Friendly name generator ---

const ADJECTIVES = [
  'Velvet', 'Cosmic', 'Fizzy', 'Crispy', 'Dusty', 'Neon', 'Rusty', 'Silky',
  'Wobbly', 'Chunky', 'Snappy', 'Punchy', 'Gritty', 'Mellow', 'Funky',
  'Spicy', 'Crunchy', 'Groovy', 'Slick', 'Toasty', 'Buzzy', 'Hazy',
  'Peppy', 'Zesty', 'Plucky', 'Breezy', 'Lush', 'Vivid', 'Swift', 'Bold',
];

const NOUNS = [
  'Larry', 'Turbo', 'Pixel', 'Orbit', 'Maple', 'Rumble', 'Quartz', 'Nova',
  'Frost', 'Blitz', 'Cedar', 'Ember', 'Vapor', 'Comet', 'Flint',
  'Gadget', 'Nimbus', 'Prism', 'Rogue', 'Sonic', 'Titan', 'Zinc',
  'Pulse', 'Spark', 'Drift', 'Beacon', 'Marble', 'Riddle', 'Glitch', 'Fable',
];

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Generate a deterministic friendly display name for a sample.
 * e.g. "BD0000.WAV" → "Punchy Kick" or "Velvet Snare 2"
 */
export function friendlyName(filename: string): string {
  const cat = classifySample(filename);
  const h = simpleHash(filename);
  const adj = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[(h >>> 8) % NOUNS.length];
  return `${adj} ${noun} ${cat.abbr}`;
}

/**
 * Generate friendly names for a list of samples, appending numbers for duplicates.
 */
export function friendlyNames(filenames: string[]): Map<string, string> {
  const raw = new Map<string, string>();
  for (const f of filenames) raw.set(f, friendlyName(f));

  // Count duplicates
  const counts = new Map<string, number>();
  for (const name of raw.values()) counts.set(name, (counts.get(name) ?? 0) + 1);

  // Append numbers for duplicates
  const result = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const f of filenames) {
    const name = raw.get(f)!;
    if (counts.get(name)! > 1) {
      const idx = (seen.get(name) ?? 0) + 1;
      seen.set(name, idx);
      result.set(f, `${name} ${idx}`);
    } else {
      result.set(f, name);
    }
  }
  return result;
}

/**
 * Group sample names by category, sorted in standard drum order.
 */
export function groupSamplesByCategory(sampleNames: string[]): { category: SampleCategory; samples: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const name of sampleNames) {
    const cat = classifySample(name);
    if (!groups.has(cat.id)) groups.set(cat.id, []);
    groups.get(cat.id)!.push(name);
  }

  return Array.from(groups.entries())
    .map(([catId, samples]) => ({ category: getCategory(catId), samples: samples.sort() }))
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder);
}
