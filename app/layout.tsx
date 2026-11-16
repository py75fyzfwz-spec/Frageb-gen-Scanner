import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fragebögen auswerten",
  description: "Eingescannte Fragebögen lesen und als Excel-Tabelle herunterladen",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
