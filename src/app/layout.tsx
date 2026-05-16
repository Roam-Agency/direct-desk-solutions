import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en-GB">
      <body className="antialiased">{children}</body>
    </html>
  );
}
