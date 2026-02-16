import Navbar from "@/components/Navbar";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar variant="app" />
      <div className="flex pt-16">
        <DashboardSidebar />
        <main className="flex-1 min-h-[calc(100vh-64px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
