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
  metadataBase: new URL("https://directdesksolutions.com"),
  openGraph: {
    title: "Direct Desk Solutions",
    description:
      "New and pre-owned office furniture, delivered across the UK.",
    url: "https://directdesksolutions.com",
    siteName: "Direct Desk Solutions",
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Direct Desk Solutions",
    description:
      "New and pre-owned office furniture, delivered across the UK.",
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
