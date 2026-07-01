import type { Metadata } from "next";
import { Syne, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const SITE_NAME = "ResponseOS";
const SITE_TAGLINE = "ResponseOS — AI Revenue Recovery Platform";
const SITE_DESCRIPTION =
  "ResponseOS helps service businesses recover missed revenue by capturing demand, qualifying leads, booking opportunities, and reporting ROI.";

// Social-card copy — Variant A (Revenue Recovery), per
// docs/product/responseos-og-social-preview-spec.md §3/§5.
const OG_TITLE = "Stop losing revenue to missed calls and weak follow-up.";
const OG_DESCRIPTION =
  "ResponseOS answers the calls you miss, qualifies the lead, updates your CRM, and shows you the revenue you'd have lost — automatically.";
const TWITTER_TITLE = "Stop losing revenue to missed calls.";
const TWITTER_DESCRIPTION =
  "ResponseOS catches the calls you miss, qualifies the lead, and shows you what to do next.";
const OG_IMAGE = {
  url: "/og/responseos-og.png",
  width: 1200,
  height: 630,
  alt: "ResponseOS — stop losing revenue to missed calls.",
};

// A malformed NEXT_PUBLIC_APP_URL must not crash the build/boot — fall back.
function resolveMetadataBase(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) {
    try {
      return new URL(fromEnv);
    } catch {
      // fall through to the safe default
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: SITE_TAGLINE,
    template: "%s — ResponseOS",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TWITTER_TITLE,
    description: TWITTER_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
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
      className={`${syne.variable} ${dmSans.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-ink">
        {children}
      </body>
    </html>
  );
}
