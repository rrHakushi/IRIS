"use client"

import { CancerBackground } from "../../../../components/reactive-backgrounds/cancer"
import type { ReactiveBackgroundVariantProps } from "../../../../components/reactive-backgrounds/reactive-background"

export function CancerScene(props: ReactiveBackgroundVariantProps) {
  return <CancerBackground className="h-svh w-full" {...props} />
}
