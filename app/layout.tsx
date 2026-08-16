import type { Metadata } from "next";
import { Syne, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const SITE_NAME = "ResponseOS";
const SITE_TAGLINE = "ResponseOS — Business Memory · Revenue Recovery";
const SITE_DESCRIPTION =
  "Explore a mock-safe ResponseOS demo designed to turn calls, notes, and follow-up into Business Memory for attributable Revenue Recovery.";

// Social-card copy — hybrid narrative (ADR-0046 / ADR-0022).
const OG_TITLE = "Stop leaking memory, context, and missed revenue.";
const OG_DESCRIPTION =
  "See a mock-safe demo of how ResponseOS is designed to turn service-business activity into Business Memory and attributable opportunities.";
const TWITTER_TITLE = "Business Memory that recovers missed revenue.";
const TWITTER_DESCRIPTION =
  "Mock demo: capture the call, qualify the lead, and trace the Revenue Recovery workflow.";
const OG_IMAGE = {
  url: "/og/responseos-og.png",
  width: 1200,
  height: 630,
  alt: "ResponseOS — Business Memory · Revenue Recovery",
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
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base text-ink">
        {children}
      </body>
    </html>
  );
}
