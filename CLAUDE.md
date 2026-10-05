# CLAUDE.md — beatshare

Browser step sequencer at `beatshare.bix.computer` (compose service
`beatshare`, port 3004). Serverless: the entire song lives in the URL hash
fragment, lz-string compressed. No backend.

## Commands

```bash
npm install
npm run dev     # Vite dev server (port 5173)
npm run build   # Type-check + Vite build → dist/
npm run lint    # ESLint flat config
npm run test    # Vitest
npm run preview # Preview built assets
```

## Module map

- `src/App.tsx` — root component and main state
- `src/audio.ts` — Tone.js wrapper; synth and sample playback
- `src/persistence.ts` — serialize/deserialize state to/from the URL hash
- `src/sound-pack-store.ts` — IndexedDB cache for downloaded sample packs
- `src/midi-export.ts` — MIDI file generation

## Gotchas

- **Timing model:** 1 tick = 1/64th note. The default grid shows 16th notes
  (every 4 ticks).
- **URL length:** export uses minified keys (`b`=bpm, `t`=tracks, …) to keep
  the URL short; warn if it exceeds 2000 chars (`App.tsx`).
- `base` in `vite.config.ts` is `/` (served at its own subdomain).
