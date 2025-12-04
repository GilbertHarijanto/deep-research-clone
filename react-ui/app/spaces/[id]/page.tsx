import { Header } from "@/components/iris/header";
import SpaceView from "./SpaceView";

export default function SpacePage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="flex">
        <div className="flex-1 max-w-6xl mx-auto px-6 py-8">
          <SpaceView id={params.id} />
        </div>
      </main>
    </div>
  );
}
