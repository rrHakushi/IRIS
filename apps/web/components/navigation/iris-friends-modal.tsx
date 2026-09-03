"use client"

import React from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export interface IrisFriendsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IrisFriendsModal({
  open,
  onOpenChange,
}: IrisFriendsModalProps): React.JSX.Element {
  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="inset-0 top-0 left-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-4 sm:fixed sm:inset-auto sm:start-1/2 sm:top-1/2 sm:h-[90vh] sm:max-h-[90vh] sm:w-[85vw] sm:max-w-[85vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden"
    >
      <DialogHeader>
        <DialogTitle>Friends</DialogTitle>
      </DialogHeader>
      <div className="flex-1" />
    </Dialog>
  )
}
