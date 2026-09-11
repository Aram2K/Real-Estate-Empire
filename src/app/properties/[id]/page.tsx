import DetailView from "@/components/property/DetailView";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DetailView id={id} />;
}
