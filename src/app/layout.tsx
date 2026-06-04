import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://crit.you"),
  title: "Crit | Your dice have opinions.",
  description:
    "Premium dice roller with personality. Roll, get roasted, share. crit.you",
  applicationName: "Crit",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crit",
  },
  // og:image / twitter:image come from app/opengraph-image.tsx automatically.
  openGraph: {
    title: "Crit",
    description: "Your dice have opinions.",
    type: "website",
    siteName: "Crit",
    url: "https://crit.you",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crit",
    description: "Your dice have opinions.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
