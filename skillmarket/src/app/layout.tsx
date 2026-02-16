import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "monAlpha | AI Research Intelligence for Monad",
  description: "Community-powered AI research marketplace for Monad memecoins. Analyze tokens with crowd-sourced intelligence.",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-bg-primary text-text-primary font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
