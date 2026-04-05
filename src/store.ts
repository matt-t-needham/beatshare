import { useState, useCallback } from 'react';
import type { Song, Track, Step, GridResolution } from './types';
import { createDefaultSong } from './types';

export function useSongStore() {
  const [song, setSong] = useState<Song>(createDefaultSong);
  const [resolution, setResolution] = useState<GridResolution>(16);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const updateSong = useCallback((updates: Partial<Song>) => {
    setSong(prev => ({ ...prev, ...updates }));
  }, []);

  const loadSong = useCallback((newSong: Song) => {
    setSong(newSong);
    setSelectedTrackId(newSong.tracks[0]?.id ?? null);
  }, []);

  const addTrack = useCallback((track: Track) => {
    setSong(prev => ({ ...prev, tracks: [...prev.tracks, track] }));
    setSelectedTrackId(track.id);
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== trackId),
    }));
    setSelectedTrackId(prev => prev === trackId ? null : prev);
  }, []);

  const updateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t),
    }));
  }, []);

  const toggleStep = useCallback((trackId: string, position: number, note: number, duration: number) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        const existing = t.steps.find(s => s.position === position);
        if (existing) {
          return { ...t, steps: t.steps.filter(s => s.position !== position) };
        }
        const newStep: Step = { position, note, velocity: 100, duration };
        return { ...t, steps: [...t.steps, newStep] };
      }),
    }));
  }, []);

  const setStep = useCallback((trackId: string, position: number, note: number, duration: number, sampleName?: string) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        // For sample tracks, replace existing step (may have different sample)
        const existing = t.steps.find(s => s.position === position);
        if (existing && !sampleName) return t;
        const newStep: Step = { position, note, velocity: 100, duration, ...(sampleName ? { sampleName } : {}) };
        const steps = existing
          ? t.steps.map(s => s.position === position ? newStep : s)
          : [...t.steps, newStep];
        return { ...t, steps };
      }),
    }));
  }, []);

  const clearStep = useCallback((trackId: string, position: number) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        return { ...t, steps: t.steps.filter(s => s.position !== position) };
      }),
    }));
  }, []);

  const updateStepNote = useCallback((trackId: string, position: number, note: number) => {
    setSong(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          steps: t.steps.map(s => s.position === position ? { ...s, note } : s),
        };
      }),
    }));
  }, []);

  return {
    song,
    resolution,
    selectedTrackId,
    setSong,
    updateSong,
    loadSong,
    addTrack,
    removeTrack,
    updateTrack,
    toggleStep,
    setStep,
    clearStep,
    updateStepNote,
    setResolution,
    setSelectedTrackId,
  };
}

export type SongStore = ReturnType<typeof useSongStore>;
