import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dados de RPG ao Vivo — servidor",
  description: "Servidor de salas compartilhadas para Dados de RPG ao Vivo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
