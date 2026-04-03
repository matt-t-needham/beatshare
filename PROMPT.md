# Agent Instructions — BeatShare

You are building a single-page browser app that lets users create simple synth melodies, beats, and rhythms, then share them via URL. It is a toy project. Keep everything simple and boring.

Read PRD.md to know what to build. Read progress.md (create it if missing) to know what's already done.

## Rules

- Work on exactly ONE unchecked task per iteration
- No clever architecture. No abstractions. No design patterns. Simple React components with useState/useReducer are fine.
- Use only packages listed in the PRD. Do not add anything else.
- Run a test version of the build after every change. Fix all errors. Do not leave warnings.
- Commit after each completed task: `git add -A && git commit -m "feat: <task name>"`
- Make decisions yourself. Do not ask questions. Do not leave TODOs.
- If something is ambiguous, pick the dumbest implementation that works.
- The app must NEVER download audio files without explicit user consent. Always show what will be downloaded, from where, and why — and wait for confirmation.

## State

After completing a task, append a line to progress.md:
```
- [x] Task N: <task name>
```

## Done

When all tasks in PRD.md are complete:
1. Run `npm run build`
2. Fix any errors
3. Output: `<promise>COMPLETE</promise>`

Now read PRD.md and progress.md and get to work.
