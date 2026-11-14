import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Blackjack Counting Academy",
  description:
    "A local, virtual-chip blackjack laboratory. Practice Hi-Lo, basic strategy and bankroll management.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
