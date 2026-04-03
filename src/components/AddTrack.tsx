import type { Track } from '../types';

interface AddTrackProps {
  onAdd: (track: Track) => void;
}

export function AddTrack({ onAdd }: AddTrackProps) {
  const addSynth = () => {
    const track: Track = {
      id: crypto.randomUUID(),
      name: 'Synth A',
      type: 'synth',
      synth: { waveform: 'sawtooth', octave: 0 },
      volume: 0.7,
      muted: false,
      steps: [],
    };
    onAdd(track);
  };

  return (
    <div className="px-2 py-1">
      <button
        onClick={addSynth}
        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm rounded cursor-pointer border border-zinc-700"
      >
        + Add Synth Track
      </button>
    </div>
  );
}
