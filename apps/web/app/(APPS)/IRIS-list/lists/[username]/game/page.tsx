import type { Metadata } from "next";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);
  return {
    title: `IRIS List | Lists > ${decodedUsername}'s Game List`,
    description: `Game list for ${decodedUsername}`,
  };
}

export default function Page() {
  return <>page</>;
}