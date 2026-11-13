import type { Metadata } from "next"
import { RunaStudio } from "./components/runa-studio"

export const metadata: Metadata = {
  title: "Runa",
}

export default function RunaPage() {
  return <RunaStudio />
}
