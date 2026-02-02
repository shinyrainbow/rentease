import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  const { locale } = await params;

  if (!session) {
    redirect(`/${locale}/login`);
  }

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <div className="pl-64 transition-all duration-300">
          <Header />
          <main className="p-6">{children}</main>
        </div>
        <Toaster />
      </div>
    </SessionProvider>
  );
}
