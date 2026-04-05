import { useState, useRef, useEffect } from 'react';
import type { Track, InstalledPack } from '../types';
import { SOUND_PACK_DIRECTORY } from '../sound-packs';

interface AddTrackProps {
  onAdd: (track: Track) => void;
  trackCount: number;
  installedPacks: InstalledPack[];
}

export function AddTrack({ onAdd, trackCount, installedPacks }: AddTrackProps) {
  const [showPackPicker, setShowPackPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPackPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPackPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPackPicker]);

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
    setShowPackPicker(false);
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
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => {
            if (installedPacks.length === 1) {
              addSampleWithPack(installedPacks[0]);
            } else {
              setShowPackPicker(!showPackPicker);
            }
          }}
          disabled={installedPacks.length === 0}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          title={installedPacks.length === 0 ? 'Download a sample pack from Sound Packs below' : 'Add a sample-based track'}
        >
          + Add Sample Track
        </button>
        {showPackPicker && installedPacks.length > 1 && (
          <div className="absolute top-full left-0 mt-1 bg-zinc-800 border border-zinc-600 rounded shadow-lg z-20 min-w-48">
            <div className="px-3 py-1.5 text-xs text-zinc-400 border-b border-zinc-700">Select a sound pack:</div>
            {installedPacks.map(pack => (
              <button
                key={pack.id}
                onClick={() => addSampleWithPack(pack)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                <div>{SOUND_PACK_DIRECTORY.find(d => d.id === pack.id)?.name ?? pack.name}</div>
                <div className="text-xs text-zinc-500">{pack.sampleNames.length} samples</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
