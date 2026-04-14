import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Intelligence Age — Policy Simulation",
  description: "Navigate 8 years of the AI transition to superintelligence. A policy simulation based on OpenAI's Industrial Policy white paper, Anthropic's RSP, WEF Future of Jobs, and the White House AI Action Plan.",
  openGraph: {
    title: "The Intelligence Age — Policy Simulation",
    description: "Can you steer a nation through the AI transition? Allocate resources, manage factions, and face crises in this policy simulator.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
