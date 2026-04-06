export interface SampleCategory {
  id: string;
  name: string;
  abbr: string;      // 3-letter abbreviation
  color: string;     // hex color for active steps
  hoverColor: string; // hex color for hover state
  sortOrder: number;
}

// Neon Jungle Night palette + extensions
// Core:  #23ce6b (green), #272d2d (dark), #f6f8ff (white), #a846a0 (magenta), #50514f (grey)
// Extended with complementary neon tones
const COLORS = {
  green:    { color: '#23ce6b', hover: '#2ee67a' },
  magenta:  { color: '#a846a0', hover: '#bf52b6' },
  coral:    { color: '#e05555', hover: '#e87070' },
  blue:     { color: '#4488ee', hover: '#5a9bf5' },
  yellow:   { color: '#d4c844', hover: '#e0d65a' },
  amber:    { color: '#cc9933', hover: '#d9aa44' },
  teal:     { color: '#33bbaa', hover: '#44ccbb' },
  pink:     { color: '#e066a0', hover: '#e880b0' },
  orange:   { color: '#dd7733', hover: '#e88844' },
  sky:      { color: '#44aadd', hover: '#55bbee' },
  violet:   { color: '#8855cc', hover: '#9966dd' },
  lime:     { color: '#88cc33', hover: '#99dd44' },
  indigo:   { color: '#5566cc', hover: '#6677dd' },
  rose:     { color: '#cc4466', hover: '#dd5577' },
  cyan:     { color: '#33cccc', hover: '#44dddd' },
  fuchsia:  { color: '#cc44bb', hover: '#dd55cc' },
  slate:    { color: '#778899', hover: '#8899aa' },
  grey:     { color: '#50514f', hover: '#666766' },
};

const CATEGORIES: SampleCategory[] = [
  { id: 'kick',      name: 'Kick',           abbr: 'Kck', ...COLORS.coral,    sortOrder: 0 },
  { id: 'snare',     name: 'Snare',          abbr: 'Snr', ...COLORS.blue,     sortOrder: 1 },
  { id: 'hh-closed', name: 'Hi-Hat Closed',  abbr: 'HHC', ...COLORS.yellow,   sortOrder: 2 },
  { id: 'hh-open',   name: 'Hi-Hat Open',    abbr: 'HHO', ...COLORS.amber,    sortOrder: 3 },
  { id: 'crash',     name: 'Crash',          abbr: 'Crs', ...COLORS.green,    sortOrder: 4 },
  { id: 'ride',      name: 'Ride',           abbr: 'Rid', ...COLORS.teal,     sortOrder: 5 },
  { id: 'tom-hi',    name: 'Tom High',       abbr: 'HTm', ...COLORS.indigo,   sortOrder: 6 },
  { id: 'tom-mid',   name: 'Tom Mid',        abbr: 'MTm', ...COLORS.violet,   sortOrder: 7 },
  { id: 'tom-low',   name: 'Tom Low',        abbr: 'LTm', ...COLORS.magenta,  sortOrder: 8 },
  { id: 'clap',      name: 'Clap',           abbr: 'Clp', ...COLORS.pink,     sortOrder: 9 },
  { id: 'cowbell',   name: 'Cowbell',        abbr: 'Cow', ...COLORS.orange,   sortOrder: 10 },
  { id: 'rimshot',   name: 'Rimshot',        abbr: 'Rim', ...COLORS.slate,    sortOrder: 11 },
  { id: 'tambourine',name: 'Tambourine',     abbr: 'Tmb', ...COLORS.lime,     sortOrder: 12 },
  // Instrument categories (for synth/sample packs like open-samples)
  { id: 'piano',     name: 'Piano',          abbr: 'Pno', ...COLORS.green,    sortOrder: 13 },
  { id: 'keys',      name: 'Keys',           abbr: 'Key', ...COLORS.cyan,     sortOrder: 14 },
  { id: 'synth',     name: 'Synth',          abbr: 'Syn', ...COLORS.fuchsia,  sortOrder: 15 },
  { id: 'strings',   name: 'Strings',        abbr: 'Str', ...COLORS.rose,     sortOrder: 16 },
  { id: 'wind',      name: 'Wind',           abbr: 'Wnd', ...COLORS.sky,      sortOrder: 17 },
  { id: 'vocal',     name: 'Vocal',          abbr: 'Vox', ...COLORS.amber,    sortOrder: 18 },
  { id: 'musicbox',  name: 'Music Box',      abbr: 'Box', ...COLORS.yellow,   sortOrder: 19 },
  { id: 'perc',      name: 'Percussion',     abbr: 'Prc', ...COLORS.orange,   sortOrder: 20 },
  { id: 'other',     name: 'Other',          abbr: 'Oth', ...COLORS.grey,     sortOrder: 21 },
];

// Synth track default color
export const SYNTH_COLOR = COLORS.magenta;

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
