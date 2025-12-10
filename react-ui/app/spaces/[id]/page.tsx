import { Header } from "@/components/iris/header";
import SpaceView from "./SpaceView";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="flex">
        <div className="flex-1 max-w-6xl mx-auto px-6 py-8">
          <SpaceView id={id} />
        </div>
      </main>
    </div>
  );
}
