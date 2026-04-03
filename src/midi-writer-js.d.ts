declare module 'midi-writer-js' {
  export class Track {
    addTrackName(name: string): void;
    setTempo(bpm: number): void;
    addEvent(event: NoteEvent): void;
  }
  export class NoteEvent {
    constructor(options: {
      pitch: (string | number)[];
      duration: string;
      velocity?: number;
    });
  }
  export class Writer {
    constructor(tracks: Track[]);
    buildFile(): Uint8Array;
  }
}
