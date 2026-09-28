import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

const SITE_NAME = "ResponseOS";
const SITE_TAGLINE = "ResponseOS — Revenue Recovery Infrastructure for Service Businesses";
const SITE_DESCRIPTION =
  "ResponseOS is designed to capture missed calls, qualify leads, book appointments, and report verified outcomes for founder-led service businesses. Start with a Readiness Assessment.";

// Social-card copy — Variant A (Revenue Recovery), per
// docs/product/responseos-og-social-preview-spec.md §3/§5.
const OG_TITLE = "Stop losing revenue to missed calls and weak follow-up.";
const OG_DESCRIPTION =
  "ResponseOS is designed to answer the calls you miss, qualify the lead, and estimate the revenue at stake.";
const TWITTER_TITLE = "Stop losing revenue to missed calls.";
const TWITTER_DESCRIPTION =
  "ResponseOS is designed to catch the calls you miss, qualify the lead, and show you what to do next.";
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
