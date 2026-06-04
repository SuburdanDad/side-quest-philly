import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Side Quest Philadelphia",
  description:
    "Explore Philadelphia like never before. Neighborhood scavenger hunts for World Cup and MLB All-Star Game summer 2026.",
  metadataBase: new URL("https://sidequestphilly.com"),
  openGraph: {
    title: "Side Quest Philadelphia",
    description:
      "Neighborhood scavenger hunts across Philly — summer 2026. World Cup. All-Star Game. Your adventure.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Side Quest Philadelphia",
    description:
      "Neighborhood scavenger hunts across Philly — summer 2026.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#004C54" />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
