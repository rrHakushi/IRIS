import type { Metadata } from "next"

type Props = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const decodedUsername = decodeURIComponent(username)
  return {
    title: `IRIS List | Lists > ${decodedUsername}'s Other Lists`,
    description: `Other lists for ${decodedUsername}`,
  }
}

export default function Page() {
  return <>page</>
}
