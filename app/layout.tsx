// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/lib/providers/QueryProvider";

export const metadata: Metadata = {
  title: "POS-X",
  description: "Developed by kama",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
