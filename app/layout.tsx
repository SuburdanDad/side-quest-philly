import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AchievementToastContainer } from "@/components/gamification/achievement-toast";
import { AnalyticsBoot } from "@/components/analytics-boot";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Side Quest Philadelphia",
  description:
    "Explore Philadelphia like never before. Neighborhood scavenger hunts for World Cup and MLB All-Star Game summer 2026.",
  metadataBase: new URL("https://side-quest-philly.vercel.app"),
  openGraph: {
    title: "Side Quest Philadelphia",
    description:
      "Neighborhood scavenger hunts across Philly — summer 2026. World Cup. All-Star Game. Your adventure.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@SideQuestPhilly",
    creator: "@SideQuestPhilly",
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
      className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#0F1D36" />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AchievementToastContainer />
          <AnalyticsBoot />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
