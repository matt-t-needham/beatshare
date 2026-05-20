import type { Track, InstalledPack } from '../types';
import { newSynthTrack, newSampleTrack, newDrumTrack } from '../types';
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
    onAdd(newSynthTrack({ name: `Synth ${trackCount + 1}` }));
  };

  const addSampleWithPack = (pack: InstalledPack) => {
    const firstSample = pack.sampleNames[0] || '';
    onAdd(newSampleTrack(pack.id, firstSample, {
      name: `${pack.name.substring(0, 12)} ${trackCount + 1}`,
    }));
  };

  const addDrumMachineWithPack = (pack: InstalledPack) => {
    // Auto-pick one sample per drum category
    const grouped = groupSamplesByCategory(pack.sampleNames);
    const lanes = grouped.map(g => ({
      sampleName: g.samples[0],
      volume: 1,
      muted: false,
    }));
    onAdd(newDrumTrack(pack.id, lanes, { name: `Drums ${trackCount + 1}` }));
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
