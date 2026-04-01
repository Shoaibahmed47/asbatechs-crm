import "@/app/globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";

const inter = Inter({
  subsets: ["latin"],
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
      <body className={`${inter.className} min-h-screen`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
