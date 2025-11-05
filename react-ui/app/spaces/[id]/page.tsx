import SpaceView from "./SpaceView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;   // Next 15 promise params
  return <SpaceView id={id} />;
}
