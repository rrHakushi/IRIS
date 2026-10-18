"use client"

import React, { Suspense } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { AkaromiVaultView } from "../components/akaromi-vault-view"

function FilteredVault() {
  const params = useParams()
  const rawFilter = params?.filter as string | undefined
  const filter = rawFilter ? decodeURIComponent(rawFilter) : "all"

  return <AkaromiVaultView filter={filter} />
}

export default function PassFilterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Image
              src="/iris-pass512left-ring.png"
              alt="Akaromi"
              width={16}
              height={16}
              className="animate-pulse object-contain"
            />
            <span>Loading Akaromi...</span>
          </div>
        </div>
      }
    >
      <FilteredVault />
    </Suspense>
  )
}
