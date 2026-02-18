// app/providers.tsx
'use client'

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { usePostHog } from 'posthog-js/react'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { trackPageView } from '@/lib/analytics'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!posthogKey) return; // Skip init when key is not configured
    posthog.init(posthogKey, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
      // set default properties once available
      capture_pageview: false,
    })
  }, [])

  // Track client-side navigations as page views
  useEffect(() => {
    if (!pathname) return
    trackPageView(pathname, searchParams?.toString() || '')
  }, [pathname, searchParams])

  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  )
}