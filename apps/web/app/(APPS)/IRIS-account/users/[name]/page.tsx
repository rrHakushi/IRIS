import type { Metadata } from "next"

type Props = {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const decodedName = decodeURIComponent(name)
  return {
    title: `IRIS Account | Users > ${decodedName}`,
    description: `IRIS Account user profile for ${decodedName}`,
  }
}

export default function Page() {
  return <>page</>
}
