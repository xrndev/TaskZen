import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/Toaster";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { siteUrl } from "@/lib/site";
import { LangProvider } from "@/lib/i18n/client";
import { getLang, getT } from "@/lib/i18n/server";

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

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getT();
  const title = t('meta.title');
  const description = t('meta.description');
  return {
    metadataBase: siteUrl(),
    appleWebApp: { capable: true, title: "Serenboard", statusBarStyle: "black-translucent" },
    title: { default: title, template: "%s · Serenboard" },
    description,
    openGraph: { type: "website", siteName: "Serenboard", locale: lang === 'en' ? 'en_GB' : 'es_ES', title, description },
    twitter: { card: "summary_large_image", title, description },
    icons: {
      icon: '/icon-192.png',
      apple: '/apple-touch-icon.png',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LangProvider lang={lang}>
          {children}
          <Toaster />
          <UpgradeDialog />
        </LangProvider>
      </body>
    </html>
  );
}
