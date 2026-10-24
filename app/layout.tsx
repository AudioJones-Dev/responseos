import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SITE_OPEN_GRAPH, SITE_TWITTER, siteUrl } from "@/lib/seo";

// Vendored latin-subset variable fonts (SIL OFL, licenses in ./fonts), so the
// build never fetches from Google Fonts.
const syne = localFont({
  variable: "--font-syne",
  src: "./fonts/syne.woff2",
  weight: "600 800",
});

const inter = localFont({
  variable: "--font-inter",
  src: "./fonts/inter.woff2",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  variable: "--font-jetbrains-mono",
  src: "./fonts/jetbrains-mono.woff2",
  weight: "100 800",
});

const SITE_TAGLINE = "ResponseOS — Revenue Recovery Infrastructure for Service Businesses";
const SITE_DESCRIPTION =
  "ResponseOS is designed to capture missed calls, qualify leads, book appointments, and report verified outcomes for founder-led service businesses. Start with a Readiness Assessment.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: SITE_TAGLINE,
    template: "%s — ResponseOS",
  },
  description: SITE_DESCRIPTION,
  openGraph: SITE_OPEN_GRAPH,
  twitter: SITE_TWITTER,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-ink">
        {children}
      </body>
    </html>
  );
}
