import type { Metadata } from "next"
import { WatchingDashboard } from "@/components/lists/watching-dashboard"

export const metadata: Metadata = {
  title: "IRIS List | Home",
  description:
    "Track your in-progress watching, reading, and gaming library on IRIS List",
}

export default function IRISListPage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] px-3 py-4 sm:px-6 sm:py-6">
      <WatchingDashboard />
    </div>
  )
}
