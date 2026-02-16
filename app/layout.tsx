import type React from "react";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import { WagmiProviderWrapper } from "@/components/providers/wagmi-provider";
import "./globals.css";
import MainNav from "@/components/ui/mainnav";
import "@rainbow-me/rainbowkit/styles.css";
import AppToaster from "@/components/providers/AppToaster";
import { Toaster } from "@/components/ui/toaster";
import { AppFooter } from "@/components/ui/footer";
import { Analytics } from "@vercel/analytics/next";
import { CampaignRibbon } from "@/components/ui/campaign-ribbon";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { SpiceFlowProvider } from "@/components/providers/SpiceFlowProvider";

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Elitra - Activate Idle Crypto Instantly",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Elitra - Activate Idle Crypto Instantly",
    description:
      "Activate idle crypto. Elitra securely routes idle assets into vetted DeFi protocols with automated risk-managed yields.",
    url: "https://elitra.xyz",
    images: [
      {
        url: "https://elitra.xyz/og-image.png",
        width: 512,
        height: 512,
        alt: "Elitra - Activate Idle Crypto Instantly",
      },
    ],
    siteName: "Elitra",
  },
  description:
    "Activate idle crypto. Elitra securely routes idle assets into vetted DeFi protocols with automated risk-managed yields.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <meta name="apple-mobile-web-app-title" content="Elitra" />
        <link rel="manifest" href="/site.webmanifest" />
        {/* Google Analytics gtag.js */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=G-9X9042JDQQ`}
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-9X9042JDQQ');
          `,
          }}
        />
      </head>
      <body
        className="font-sans antialiased"
        style={{
          background:
            "linear-gradient(135deg, rgba(0, 61, 255, 0.03) 0%, rgba(0, 231, 255, 0.02) 100%)",
        }}
      >
        <Suspense fallback={null}>
          <PostHogProvider>
            <WagmiProviderWrapper>
              <SpiceFlowProvider>
                {/* <CampaignRibbon /> */}
                <MainNav />
                {children}
                <AppToaster />
                <Toaster />
                <Analytics />
                <AppFooter />
              </SpiceFlowProvider>
            </WagmiProviderWrapper>
          </PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
