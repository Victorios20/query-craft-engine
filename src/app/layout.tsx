import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from "next/font/google";
import AppHeader from "@/components/app-header";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "QueryCraft | Processador de Consultas",
  description:
    "Interface inicial do Projeto 2 para processamento e otimizacao de consultas SQL.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1218" },
  ],
};

const themeScript = `
  (() => {
    try {
      const storageKey = "querycraft-theme";
      const root = document.documentElement;
      const storedTheme = window.localStorage.getItem(storageKey);
      const preferredTheme =
        storedTheme === "light" || storedTheme === "dark"
          ? storedTheme
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      root.classList.toggle("dark", preferredTheme === "dark");
      root.dataset.theme = preferredTheme;
      root.style.colorScheme = preferredTheme;
    } catch (error) {
      console.error("Theme bootstrap failed", error);
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${manrope.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} min-h-screen antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen overflow-x-hidden bg-background text-foreground"
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="relative isolate flex min-h-screen flex-col">
          <AppHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
