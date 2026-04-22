import type { Track, InstalledPack } from '../types';
import { groupSamplesByCategory } from '../sample-categories';
import { Tooltip } from './Tooltip';

interface AddTrackProps {
  onAdd: (track: Track) => void;
  trackCount: number;
  installedPacks: InstalledPack[];
}

export function AddTrack({ onAdd, trackCount, installedPacks }: AddTrackProps) {
  const defaultPack = installedPacks[0] || null;

  const addSynth = () => {
    const track: Track = {
      id: crypto.randomUUID(),
      name: `Synth ${trackCount + 1}`,
      type: 'synth',
      synth: { waveform: 'sawtooth', octave: 0 },
      volume: 0.7,
      muted: false,
      steps: [],
    };
    onAdd(track);
  };

  const addSampleWithPack = (pack: InstalledPack) => {
    const firstSample = pack.sampleNames[0] || '';
    const track: Track = {
      id: crypto.randomUUID(),
      name: `${pack.name.substring(0, 12)} ${trackCount + 1}`,
      type: 'sample',
      sample: { packId: pack.id, sampleName: firstSample },
      volume: 0.7,
      muted: false,
      steps: [],
    };
    onAdd(track);
  };

  const addDrumMachineWithPack = (pack: InstalledPack) => {
    // Auto-pick one sample per drum category
    const grouped = groupSamplesByCategory(pack.sampleNames);
    const lanes = grouped.map(g => ({
      sampleName: g.samples[0],
      volume: 1,
      muted: false,
    }));
    const track: Track = {
      id: crypto.randomUUID(),
      name: `Drums ${trackCount + 1}`,
      type: 'drum-machine',
      drumMachine: { packId: pack.id, lanes },
      volume: 0.7,
      muted: false,
      steps: [],
    };
    onAdd(track);
  };

  return (
    <div className="px-2 py-1 flex gap-2 relative">
      <button
        onClick={addSynth}
        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700"
      >
        + Add Synth Track
      </button>
      <button
        onClick={() => defaultPack && addSampleWithPack(defaultPack)}
        disabled={installedPacks.length === 0}
        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Add Sample Track
      </button>
      <Tooltip text={installedPacks.length === 0 ? 'Download a sample pack first' : 'Add a drum machine with one lane per sound category'}>
        <button
          onClick={() => defaultPack && addDrumMachineWithPack(defaultPack)}
          disabled={installedPacks.length === 0}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Drum Machine
        </button>
      </Tooltip>
    </div>
  );
}
