import { Header } from "@/components/iris/header";

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">

      {children}
    </div>
  );
}
