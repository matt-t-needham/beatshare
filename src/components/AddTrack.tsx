import type { Track, InstalledPack } from '../types';
import { newSynthTrack, newSampleTrack, newDrumTrack } from '../types';
import { groupSamplesByCategory, packKind } from '../sample-categories';
import { Tooltip } from './Tooltip';

interface AddTrackProps {
  onAdd: (track: Track) => void;
  trackCount: number;
  installedPacks: InstalledPack[];
}

export function AddTrack({ onAdd, trackCount, installedPacks }: AddTrackProps) {
  const samplePack = installedPacks.find(p => packKind(p.sampleNames) === 'sample') ?? installedPacks[0] ?? null;
  const drumPack = installedPacks.find(p => packKind(p.sampleNames) === 'drum') ?? installedPacks[0] ?? null;

  const addSynth = () => {
    onAdd(newSynthTrack({ name: `Synth ${trackCount + 1}` }));
  };

  const addSampleTrack = () => {
    if (!samplePack) return;
    const firstSample = samplePack.sampleNames[0] || '';
    onAdd(newSampleTrack(samplePack.id, firstSample, {
      name: `Sample ${trackCount + 1}`,
    }));
  };

  const addDrumMachine = () => {
    if (!drumPack) return;
    const grouped = groupSamplesByCategory(drumPack.sampleNames);
    const defaults = ['kick', 'snare', 'hh-closed', 'clap'];
    const lanes = defaults
      .map(catId => grouped.find(g => g.category.id === catId))
      .filter((g): g is NonNullable<typeof g> => !!g && g.samples.length > 0)
      .map(g => ({ sampleName: g.samples[0], volume: 1, muted: false }));
    onAdd(newDrumTrack(drumPack.id, lanes, { name: `Drums ${trackCount + 1}` }));
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
        onClick={addSampleTrack}
        disabled={!samplePack}
        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Add Sample Track
      </button>
      <Tooltip text={installedPacks.length === 0 ? 'Download a sample pack first' : 'Add a drum machine with one lane per sound category'}>
        <button
          onClick={addDrumMachine}
          disabled={!drumPack}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add Drum Machine
        </button>
      </Tooltip>
    </div>
  );
}
