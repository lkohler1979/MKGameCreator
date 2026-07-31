import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

import { ChunkReloadGuard } from "@/components/chunk-reload-guard";
import { ServiceWorkerRegister } from "@/components/sw-register";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MK Game Creator",
  description: "Transforme qualquer desenho em um jogo",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MK Game Creator",
  },
};

export const viewport: Viewport = {
  themeColor: "#241454",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ChunkReloadGuard />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
