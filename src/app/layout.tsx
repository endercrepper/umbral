import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UMBRAL · Hardcore Extraction Looter",
  description: "Extraction looter hardcore single player ambientato in un mondo dark fantasy. Armi dal neolitico al rinascimentale. WebGL.",
  keywords: ["UMBRAL", "extraction looter", "dark fantasy", "WebGL", "hardcore", "roguelike"],
  authors: [{ name: "UMBRAL" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-stone-200 overflow-hidden`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
