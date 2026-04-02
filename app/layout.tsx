import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SLR CEO Dashboard",
  description: "Sober Living Riches — Live CEO Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "#0b0f1a",
          color: "#f0f2f5",
          fontFamily: "'DM Sans', sans-serif",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
