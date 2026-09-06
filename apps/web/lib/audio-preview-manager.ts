"use client"

import { useSyncExternalStore, useCallback } from "react"

interface AudioPreviewState {
  activeTrackId: number | string | null
  isPlaying: boolean
}

let currentAudio: HTMLAudioElement | null = null
let currentState: AudioPreviewState = {
  activeTrackId: null,
  isPlaying: false,
}

const listeners = new Set<() => void>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

function updateState(next: Partial<AudioPreviewState>): void {
  currentState = { ...currentState, ...next }
  notifyListeners()
}

export function playAudioPreview(
  trackId: number | string,
  previewUrl: string
): void {
  // If clicking the currently active track
  if (currentState.activeTrackId === trackId) {
    if (currentState.isPlaying && currentAudio) {
      currentAudio.pause()
      updateState({ isPlaying: false })
      return
    }
    if (currentAudio) {
      currentAudio
        .play()
        .then(() => updateState({ isPlaying: true }))
        .catch(() => updateState({ isPlaying: false }))
      return
    }
  }

  // Stop previous track if any was playing
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  if (!previewUrl) {
    updateState({ activeTrackId: null, isPlaying: false })
    return
  }

  const audio = new Audio(previewUrl)
  currentAudio = audio
  updateState({ activeTrackId: trackId, isPlaying: false })

  audio.addEventListener("play", () => {
    updateState({ isPlaying: true })
  })

  audio.addEventListener("pause", () => {
    updateState({ isPlaying: false })
  })

  audio.addEventListener("ended", () => {
    updateState({ activeTrackId: null, isPlaying: false })
    currentAudio = null
  })

  audio.addEventListener("error", () => {
    updateState({ activeTrackId: null, isPlaying: false })
    currentAudio = null
  })

  audio
    .play()
    .then(() => {
      updateState({ activeTrackId: trackId, isPlaying: true })
    })
    .catch(() => {
      updateState({ activeTrackId: null, isPlaying: false })
      currentAudio = null
    })
}

export function pauseAudioPreview(): void {
  if (currentAudio) {
    currentAudio.pause()
    updateState({ isPlaying: false })
  }
}

export function stopAudioPreview(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
  updateState({ activeTrackId: null, isPlaying: false })
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot(): AudioPreviewState {
  return currentState
}

const SERVER_STATE: AudioPreviewState = {
  activeTrackId: null,
  isPlaying: false,
}

function getServerSnapshot(): AudioPreviewState {
  return SERVER_STATE
}

export function useAudioPreview() {
  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const togglePlay = useCallback(
    (trackId: number | string, previewUrl?: string | null) => {
      if (!previewUrl) return
      playAudioPreview(trackId, previewUrl)
    },
    []
  )

  const pause = useCallback(() => {
    pauseAudioPreview()
  }, [])

  const stop = useCallback(() => {
    stopAudioPreview()
  }, [])

  return {
    activeTrackId: state.activeTrackId,
    isPlaying: state.isPlaying,
    isCurrentTrackPlaying: (trackId: number | string) =>
      state.activeTrackId === trackId && state.isPlaying,
    togglePlay,
    pause,
    stop,
  }
}
