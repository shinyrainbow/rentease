import "@/app/globals.css";

export const metadata = {
  title: "ส่งสลิปชำระเงิน - RentEase",
  description: "Upload payment slip via LINE",
};

export default function LiffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
