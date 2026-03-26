import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { EliteProvider } from "@/context/EliteContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "EliteOS — Your Operating System",
  description: "High-performance personal operating system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className={`${inter.className} min-h-full flex flex-col antialiased`}>
        <AuthProvider>
          <EliteProvider>{children}</EliteProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
