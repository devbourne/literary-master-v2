import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text Analysis Agent",
  description: "에이전틱 텍스트 분석 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
