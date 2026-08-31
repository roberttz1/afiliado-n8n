import "./globals.css";

export const metadata = {
  title: "Grupos de Ofertas — Dashboard",
  description: "Sistema de gestão de grupos de ofertas no WhatsApp com automação e IA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
