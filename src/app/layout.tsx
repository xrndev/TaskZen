import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/Toaster";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { siteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0b0620",
  viewportFit: "cover",
};

const DESCRIPCION = "Tablero Kanban en equipo con avisos antes del vencimiento, roles y app Android. Gratis para empezar."

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  appleWebApp: { capable: true, title: "Serenboard", statusBarStyle: "black-translucent" },
  title: { default: "Serenboard · Tablero Kanban en equipo", template: "%s · Serenboard" },
  description: DESCRIPCION,
  openGraph: { type: "website", siteName: "Serenboard", locale: "es_ES", title: "Serenboard · Tablero Kanban en equipo", description: DESCRIPCION },
  twitter: { card: "summary_large_image", title: "Serenboard · Tablero Kanban en equipo", description: DESCRIPCION },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <UpgradeDialog />
      </body>
    </html>
  );
}
