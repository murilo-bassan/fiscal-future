import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ZeroAbi: a Reforma Tributária sem susto", template: "%s · ZeroAbi" },
  description:
    "Descubra quanto a sua empresa vai pagar com IBS e CBS de 2026 a 2033, qual preço cobrar para manter a margem e se vale sair do Simples para o regime regular.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>{children}</body>
    </html>
  );
}
