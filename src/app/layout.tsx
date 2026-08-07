import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { APP_NAME } from "@/lib/constants";
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
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Enterprise pharmaceutical Laboratory Information Management System for sample tracking, testing, approvals, and reporting.",
  keywords: [
    "LIMS",
    "Laboratory",
    "Pharma",
    "Quality Control",
    "COA",
    "Sample Management",
  ],
  authors: [{ name: "SkyMap" }],
  icons: {
    icon: "/skymap-logo.png",
    apple: "/skymap-logo.png",
  },
  openGraph: {
    title: APP_NAME,
    description:
      "Modern LIMS for pharmaceutical laboratories — samples, testing, approvals, and audit trail.",
    type: "website",
    images: [{ url: "/skymap-logo.png", alt: "SKYMAP" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen overflow-x-hidden antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
