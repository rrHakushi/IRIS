import type { Metadata } from "next";

type Props = {
  params: Promise<{ title: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { title } = await params;
  const decodedTitle = decodeURIComponent(title);
  return {
    title: `IRIS List | Media > Manga > ${decodedTitle}`,
    description: `${decodedTitle} details on IRIS List`,
  };
}

export default function Page() {
  return <>page</>;
}
