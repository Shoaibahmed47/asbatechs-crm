import "@/app/globals.css";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('crm-theme');if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){}})();"
          }}
        />
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable} min-h-screen font-sans`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
