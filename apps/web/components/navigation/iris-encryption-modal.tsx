"use client";

import React from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

export interface IrisEncryptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IrisEncryptionModal({
  open,
  onOpenChange,
}: IrisEncryptionModalProps): React.JSX.Element {
  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="inset-0 top-0 left-0 translate-x-0 translate-y-0 w-full h-full max-w-none max-h-none rounded-none p-4 sm:p-6 gap-0 overflow-hidden sm:fixed sm:inset-auto sm:top-1/2 sm:start-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[85vw] sm:h-[90vh] sm:max-w-[85vw] sm:max-h-[90vh] sm:rounded-3xl [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:overflow-hidden [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col"
    >
      <DialogHeader>
        <DialogTitle>Encryption</DialogTitle>
      </DialogHeader>
      <div className="flex-1" />
    </Dialog>
  );
}
