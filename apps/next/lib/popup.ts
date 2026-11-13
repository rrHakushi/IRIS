import type React from "react"

export type PopupVariant = "default" | "destructive" | "warning" | "info"

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  variant?: PopupVariant
  confirmText?: string
  cancelText?: string
  /** When set, the user must type this exact keyword to enable the confirm button. */
  confirmKeyword?: string
  /** Optional async handler; the popup stays open with a loading spinner until it settles. */
  onConfirm?: () => void | Promise<void>
}

export interface AlertOptions {
  title: string
  description?: React.ReactNode
  variant?: PopupVariant
  confirmText?: string
}

export type PopupRequest =
  | {
      id: string
      kind: "confirm"
      options: ConfirmOptions
      resolve: (confirmed: boolean) => void
    }
  | {
      id: string
      kind: "alert"
      options: AlertOptions
      resolve: () => void
    }

type PopupListener = (request: PopupRequest) => void

const listeners = new Set<PopupListener>()
let counter = 0

function emitPopup(request: PopupRequest) {
  for (const listener of listeners) {
    listener(request)
  }
}

export function subscribePopups(listener: PopupListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Show a modern imperative confirmation popup and resolve to `true` if confirmed,
 * or `false` if cancelled/dismissed.
 */
export function irisConfirm(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false)
  }

  return new Promise<boolean>((resolve) => {
    counter += 1
    emitPopup({
      id: `iris-popup-${counter}`,
      kind: "confirm",
      options,
      resolve,
    })
  })
}

/**
 * Show a modern imperative alert popup and resolve when acknowledged.
 */
export function irisAlert(options: AlertOptions): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    counter += 1
    emitPopup({
      id: `iris-popup-${counter}`,
      kind: "alert",
      options,
      resolve,
    })
  })
}

