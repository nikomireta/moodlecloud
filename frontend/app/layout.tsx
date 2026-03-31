import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/components/providers/auth-provider'
import { RuntimeActionsProvider } from '@/components/providers/runtime-actions-provider'
import { ToastProvider } from '@/components/providers/toast-provider'
import { StructuredData } from '@/components/seo/structured-data'
import { RSS_FEED_PATH, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, buildAbsoluteURL, siteMetadataBase } from '@/lib/seo'
import { createOrganizationStructuredData, createWebsiteStructuredData } from '@/lib/structured-data'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter"
});
const shouldEnableAnalytics =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" || process.env.VERCEL === "1"

export const metadata: Metadata = {
  metadataBase: siteMetadataBase,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  generator: SITE_NAME,
  alternates: {
    types: {
      "application/rss+xml": buildAbsoluteURL(RSS_FEED_PATH),
    },
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <RuntimeActionsProvider>
              {children}
              <ToastProvider />
            </RuntimeActionsProvider>
          </AuthProvider>
        </ThemeProvider>
        <StructuredData data={createWebsiteStructuredData()} />
        <StructuredData data={createOrganizationStructuredData()} />
        {shouldEnableAnalytics ? <Analytics /> : null}
      </body>
    </html>
  )
}
