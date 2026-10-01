import type { Metadata, Viewport } from "next";
import { Anton, DM_Sans } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { APP_NAME, DESCRIPTION, TAGLINE } from "@/src/brand.ts";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: ${TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b14",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${dmSans.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
