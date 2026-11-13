"use client"

import React, { useState } from "react"
import type { TesseractPeer } from "@/lib/tesseract/types"
import { SharedByYouPanel } from "./components/shared-by-you-panel"
import { SharedByOthersPanel } from "./components/shared-by-others-panel"
import { DirectSendDialog } from "./components/direct-send-dialog"
import { IncomingTransferDialog } from "./components/incoming-transfer-dialog"
import { ShelfApprovalDialog } from "./components/shelf-approval-dialog"

export default function TesseractPage() {
  const [directTargetPeer, setDirectTargetPeer] =
    useState<TesseractPeer | null>(null)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 sm:p-6">
      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <SharedByYouPanel />
        <SharedByOthersPanel
          onOpenDirectSend={(peer) => setDirectTargetPeer(peer)}
        />
      </div>

      <DirectSendDialog
        targetPeer={directTargetPeer}
        onClose={() => setDirectTargetPeer(null)}
      />
      <IncomingTransferDialog />
      <ShelfApprovalDialog />
    </div>
  )
}
