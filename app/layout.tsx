import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Whiteboard · Ideen gemeinsam sichtbar machen",
  description: "Ein kollaboratives Whiteboard mit AI-first Architektur für Ideen, Zusammenhänge und Teams.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
