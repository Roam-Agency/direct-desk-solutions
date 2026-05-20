import type { Metadata } from "next";
import { Archivo, Archivo_Black } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Direct Desk Solutions — New & Pre-Owned Office Furniture, UK",
    template: "%s | Direct Desk Solutions",
  },
  description:
    "A smarter source for office furniture. New and pre-owned desks, chairs, storage, and more — delivered across the UK. Price match guarantee, free UK mainland delivery on orders over £500.",
  // Migration note: when the old WooCommerce site at
  // directdesksolutions.com is taken down and the domain re-pointed
  // at this Netlify deploy, set NEXT_PUBLIC_SITE_URL on Netlify to
  // "https://directdesksolutions.com" and redeploy. No code change
  // needed — sitemap.ts, robots.ts, and all metadata URLs follow.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://direct-desk-solutionse.netlify.app",
  ),
  openGraph: {
    title: "Direct Desk Solutions",
    description:
      "New and pre-owned office furniture, delivered across the UK.",
    siteName: "Direct Desk Solutions",
    locale: "en_GB",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Direct Desk Solutions — office furniture, honestly described.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Direct Desk Solutions",
    description:
      "New and pre-owned office furniture, delivered across the UK.",
    images: ["/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${archivo.variable} ${archivoBlack.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
