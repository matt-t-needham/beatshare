interface TransportProps {
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  metronome: boolean;
  onMetronomeChange: (enabled: boolean) => void;
}

export function Transport({ playing, onPlay, onStop, metronome, onMetronomeChange }: TransportProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-700 bg-zinc-850">
      <button
        onClick={playing ? onStop : onPlay}
        className={`px-4 py-1.5 rounded font-medium text-sm cursor-pointer ${
          playing
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-green-600 hover:bg-green-500 text-white'
        }`}
      >
        {playing ? 'Stop' : 'Play'}
      </button>

      <button
        onClick={() => onMetronomeChange(!metronome)}
        className={`px-3 py-1.5 rounded text-sm cursor-pointer font-medium ${
          metronome
            ? 'bg-orange-600 hover:bg-orange-500 text-white'
            : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-400'
        }`}
        title={metronome ? 'Metronome on' : 'Metronome off'}
      >
        Metro
      </button>
    </div>
  );
}
