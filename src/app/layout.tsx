import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RentEase - Property Management System",
  description: "Warehouse and property management system for Thai businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
