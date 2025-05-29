import type { Metadata } from "next";
import { Inter, Sora, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { AuthError } from "@/components/auth-error";
import { Navigation } from "@/components/navigation";
import { StagewiseToolbar } from "@stagewise/toolbar-next";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stemify - AI-Powered Music Stem Separation",
  description: "Separate your music into individual stems using state-of-the-art AI. Extract vocals, drums, bass, guitar, and piano from any song.",
  keywords: ["music separation", "stem separation", "AI music", "vocal isolation", "instrumental", "karaoke"],
  authors: [{ name: "Stemify" }],
  openGraph: {
    title: "Stemify - AI-Powered Music Stem Separation",
    description: "Separate your music into individual stems using state-of-the-art AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const stagewiseConfig = {
    plugins: []
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${robotoMono.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <Navigation />
            <main className="pt-20">
              {children}
            </main>
            <AuthError />
            <Toaster />
            {process.env.NODE_ENV === 'development' && (
              <StagewiseToolbar config={stagewiseConfig} />
            )}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
