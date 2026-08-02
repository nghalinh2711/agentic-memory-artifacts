import type { Metadata } from "next";
import "@fontsource/josefin-sans/400.css";
import "@fontsource/josefin-sans/700.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import ThemeRegistry from "@/components/ThemeRegistry";

export const metadata: Metadata = {
  title: "AI Chatbot RAG",
  description: "AI-powered document chat with RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ overflow: "hidden" }}>
      <body style={{ margin: 0, overflow: "hidden" }}>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
