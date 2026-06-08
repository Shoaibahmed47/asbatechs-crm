import "@/app/globals.css";
import type { ReactNode } from "react";
import Script from "next/script";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('crm-theme');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`;

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen font-sans`}>
        <Script id="crm-theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
