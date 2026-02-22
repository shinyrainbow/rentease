import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
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
        <DashboardShell>{children}</DashboardShell>
        <Toaster />
      </div>
    </SessionProvider>
  );
}
