"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  Users,
  Gauge,
  FileText,
  CreditCard,
  Receipt,
  Wrench,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  FileSignature,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "dashboard" },
  { href: "/projects", icon: Building2, label: "projects" },
  { href: "/units", icon: DoorOpen, label: "units" },
  { href: "/tenants", icon: Users, label: "tenants" },
  { href: "/contracts", icon: FileSignature, label: "contracts" },
  { href: "/meters", icon: Gauge, label: "meters" },
  { href: "/invoices", icon: FileText, label: "invoices" },
  { href: "/payments", icon: CreditCard, label: "payments" },
  { href: "/receipts", icon: Receipt, label: "receipts" },
  { href: "/maintenance", icon: Wrench, label: "maintenance" },
  { href: "/line-oa", icon: MessageCircle, label: "lineOA" },
  { href: "/settings", icon: Settings, label: "settings" },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams();
  const locale = params.locale as string;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href={`/${locale}/dashboard`} className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold">R</span>
              </div>
              <span className="font-bold text-xl">RentEase</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && "mx-auto")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const href = `/${locale}${item.href}`;
              const isActive = pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{t(item.label)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
