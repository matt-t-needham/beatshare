# PRD: BeatShare

## Goal
Build a single-page browser app for creating and sharing simple synth melodies, beats, and rhythms. Sharing is entirely client-side via URL hash fragments (no server). The app prioritizes simplicity of creation and sharing.

## Target Platforms
- Chrome Browser
- Firefox Browser

## Core Principles
- Fast to open, fast to act
- Easy to share
- Clearly communicates what is happening
- Asks user before downloading anything
- No backend required — fully static

---

## User Stories

### Creation
- [ ] **1. Empty canvas on launch** — On launch, user sees an empty step sequencer grid with default settings (120 BPM, 4/4 time, 1 measure, one empty synth track). They can immediately start clicking cells to add notes.
- [ ] **2. Name a song** — User can click the song title area to rename it. Default: "Untitled".
- [ ] **3. Set BPM** — User can adjust tempo (40-300 BPM) via a number input.
- [ ] **4. Add tracks** — User can add new tracks (synth or sample-based). Each track is a row in the grid.
- [ ] **5. Remove/mute tracks** — User can delete a track or mute it temporarily.
- [ ] **6. Toggle steps** — Clicking a cell in the grid toggles a note on/off. For synth tracks, a note picker lets the user choose pitch.
- [ ] **7. Adjust grid resolution** — Default view shows 16th-note steps. User can switch to 8th, 32nd, or 64th note resolution.
- [ ] **8. Configure synth tracks** — User picks waveform (sine, square, sawtooth, triangle), octave, and volume for each synth track.
- [ ] **9. Set measures** — User can set the number of measures (1-16) for the loop.

### Playback
- [ ] **10. Play/Stop** — Transport controls to play the current pattern on loop and stop it.
- [ ] **11. Visual playback indicator** — A cursor/highlight moves across the grid in time with playback.

### Sound Packs
- [ ] **12. Browse sound packs** — A "Sound Packs" panel shows a curated list of known open-source sample packs with descriptions, links, and license info. This is a static list built into the app.
- [ ] **13. Download consent** — Before downloading any sound pack, the app shows a dialog explaining: what will be downloaded, from where, the file size (if known), and why. User must confirm before any network request for audio files.
- [ ] **14. Load pack from URL** — User can paste a URL to a .zip or folder of audio samples. The app explains what it will fetch and asks for confirmation before downloading.
- [ ] **15. Import local .zip** — User can drag-and-drop or file-pick a .zip of samples from their machine. No network request needed.
- [ ] **16. Cache downloaded packs** — Downloaded packs are cached in IndexedDB. The app shows what's cached and lets the user clear it.

### Sharing
- [ ] **17. Share via URL** — "Share" button serializes the song to a compressed URL hash (lz-string). Copies to clipboard. Shows a warning if URL > 2000 chars.
- [ ] **18. Load from URL** — On page load, if a hash fragment exists, decompress and load the song. If the song references sample packs the user doesn't have cached, show a prompt explaining what needs to be downloaded and ask for consent before fetching.
- [ ] **19. Clean URL after load** — After loading from hash, replaceState to remove the hash so refresh doesn't re-import.

### Export
- [ ] **20. Export MIDI** — User can export the current song as a .mid file download.

### Polish
- [ ] **21. Empty state** — When no tracks exist, show a friendly prompt to get started.
- [ ] **22. Responsive layout** — Works on desktop and tablet. Mobile is stretch goal.
- [ ] **23. Dark mode** — Dark theme by default.

---

## Data Model

```
Song {
  name: string
  bpm: number (40-300)
  swing: number (0-100)
  timeSignature: [number, number]  // e.g. [4, 4]
  measures: number (1-16)
  tracks: Track[]
}

Track {
  name: string
  type: "synth" | "sample"
  // synth: waveform (sine/square/sawtooth/triangle), octave
  // sample: pack ID + sample name
  volume: number
  muted: boolean
  steps: Step[]  // sparse — only active steps stored
}

Step {
  position: number   // 0-based tick (1 tick = 1/64th note)
  note: number       // MIDI note number
  velocity: number   // 0-127
  duration: number   // in ticks
}
```

**Tick system:** 1 tick = one 64th note. A 4/4 measure = 256 ticks. UI defaults to 16th-note grid (every 4 ticks).

## URL Sharing Scheme

Entire song state is serialized, compressed, and stored in the URL hash fragment (#...). The hash is never sent to the server — sharing is fully client-side and zero-knowledge.

- **Library:** lz-string — `compressToEncodedURIComponent` / `decompressFromEncodedURIComponent`
- **Encode:** state → serialize (minify keys) → JSON.stringify → compress → `#hash`
- **Decode:** `#hash` → decompress → JSON.parse → deserialize → load state → replaceState to clean URL
- **Sample packs** are referenced by ID/URL, not embedded as audio data
- **URL length:** warn if > 2000 chars (SMS/iMessage may truncate)
- **Error handling:** if decompress returns null or JSON parse fails, show "link appears incomplete" toast, remove hash, fall back to default state

Minified key examples: `n` = name, `b` = bpm, `t` = tracks, `s` = steps, `p` = position, `v` = velocity, `d` = duration, `nt` = note, `ty` = type, `w` = waveform, `pk` = pack.

## Sound Pack Directory

Built-in list of known open-source sample packs:

| Pack | Source | License | Description |
|------|--------|---------|-------------|
| gregharvey/drum-samples | GitHub | Open source | Acoustic drum kit samples |
| pumodi/open-samples | GitHub | Royalty-free | Growing collection of instruments |
| crabacus/the-open-source-drumkit | GitHub | Open source | Real Music Media drumkit |
| fluid-music/open-drums | GitHub | Open source | Web-optimized drum libraries |

Each entry shows: name, description, license, source URL, and a "Download" button that triggers the consent flow (story #13).

---

## Out of Scope
- User accounts or cloud sync
- Server-side storage
- Collaboration / real-time editing
- Audio recording (microphone input)
- Audio effects (reverb, delay, etc.) — future enhancement

---

## Tech Stack
- **Vite + React + TypeScript** — single-page app
- **Tone.js** — audio engine, scheduling, synths, sample playback
- **lz-string** — URL compression
- **MidiWriterJS** — MIDI export
- **Tailwind CSS** — styling
- **JSZip** — reading imported .zip files

---

## Completion Signal
Output `<promise>COMPLETE</promise>` when:
- All user stories are implemented
