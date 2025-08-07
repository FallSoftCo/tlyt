import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// AuthKitProvider is handled at the app level, not needed here
// import { AuthKitProvider } from '@workos-inc/authkit-nextjs';
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
  title: "TLYT - TLYT watches YouTube so you don't have to",
  description: "TLYT watches YouTube so you don't have to",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
{children}
      </body>
    </html>
  );
}
