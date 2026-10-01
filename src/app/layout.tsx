import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { AccountProvider } from "@/components/account-provider";
import { LoginDialogProvider } from "@/components/login-dialog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  title: "RWGdle · Random Word Generator",
  description:
    "A random English word, scored from Scrabble tiles, a length multiplier, and a handful of bonuses. Your roll, not a shared puzzle.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5eedf" },
    { media: "(prefers-color-scheme: dark)", color: "#0f2a1f" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint: a saved choice wins, otherwise the system setting.
 * The server renders dark; this swaps to Daylight without a flash.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("rwgdle.theme");var d=t?t==="dark":!window.matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <AccountProvider>
          <LoginDialogProvider>{children}</LoginDialogProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
