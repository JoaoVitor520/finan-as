import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finan.as - Controle Financeiro do Casal",
  description: "Gerencie suas finanças em casal com inteligência artificial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
