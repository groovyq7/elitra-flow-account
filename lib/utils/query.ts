//import EnvHandler from "@/services/EnvHandler"
import { GraphQLClient } from "graphql-request"

// Extend each cache entry with a timestamp and (optionally) an AbortController.
interface CacheEntry {
  data?: any
  error?: any
  promise?: Promise<{ data: any; error: any }>
  timestamp?: number
  abortController?: AbortController
}

// Global in‑memory cache keyed by query + JSON.stringify(variables)
export const cache = new Map<string, CacheEntry>()
// Cache is valid for 1 minute.
const CACHE_DURATION = 60 * 1000
const shouldUseGraphOnClient = false // EnvHandler.getInstance().getVariable("useGraphOnClient").toLowerCase() === "true"

const graphEndpoint = process.env.GRAPHQL_ENDPOINT || "https://indexer.dev.hyperindex.xyz/18880d0/v1/graphql"
export const graphClient = new GraphQLClient(graphEndpoint, {
  // Ensure we only ever send { query, variables } body – no persisted queries/extensions
  fetch: async (input, init) => {
    // Pass through directly; we'll sanitize body in fetchQuery instead
    return fetch(input, init)
  },
})

/**
 * fetchQuery:
 * - Checks the cache for an entry and validates expiration.
 * - If an entry exists with pending data or an in‑flight promise, it reuses it.
 * - Otherwise, it creates a new fetch with an AbortController (and supports an external signal).
 * - Bypasses caching for queries that include "ExploreTokens".
 */
export async function fetchQuery(
  query: string,
  variables: Record<string, any>,
  signal?: AbortSignal,
  cacheDuration = CACHE_DURATION,
): Promise<{ data: any; error: any }> {
  const key = query + JSON.stringify(variables)
  const now = Date.now()

  // Check if the query includes "ExploreTokens" or other specific queries
  const isExploreTokensQuery = query.includes("ExploreTokens") || query.includes("Tokens")
  let entry = cache.get(key)

  // If it's an ExploreTokens query, bypass the cache entirely
  if (isExploreTokensQuery) {
    entry = { timestamp: now }
    cache.set(key, entry)
  }

  // Remove the entry if it’s expired.
  if (entry && entry.timestamp && now - entry.timestamp > cacheDuration) {
    cache.delete(key)
    entry = undefined
  }

  if (entry) {
    // If data or error already exists, return it immediately.
    if (entry.data !== undefined || entry.error !== undefined) {
      return Promise.resolve({ data: entry.data, error: entry.error })
    }
    // If a promise is in flight, return it.
    if (entry.promise) {
      return entry.promise
    }
  } else {
    // Create a new entry with a timestamp.
    entry = { timestamp: now }
    cache.set(key, entry)
  }

  // Create a new AbortController for this fetch.
  const abortController = new AbortController()
  // If an external signal is provided, wire it to our controller.
  if (signal) {
    signal.addEventListener("abort", () => {
      abortController.abort()
    })
  }
  entry.abortController = abortController

  try {
    console.log({shouldUseGraphOnClient});
    
    let gqlResult: any
    if (shouldUseGraphOnClient) {
      // Use manual fetch to avoid any persisted query extensions automatically added by libs
      const body = JSON.stringify({ query, variables })
      const res = await fetch(graphEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Explicitly disable APQ-related behaviors if some proxy inspects headers
          "apollo-require-preflight": "true",
        },
        body,
        signal: abortController.signal,
      })
      if (!res.ok) {
        const text = await res.text()
        console.error("GraphQL error response", text)
        throw new Error(text)
      }
      gqlResult = await res.json()
      if (gqlResult.errors) {
        throw new Error(JSON.stringify(gqlResult.errors))
      }
      entry.data = gqlResult.data
    } else {
      const res = await fetch("/api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: abortController.signal,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text)
      }
      const data = await res.json()
      if (data.errors) throw new Error(JSON.stringify(data.errors))
      entry.data = data
    }
    entry.error = null
    entry.promise = undefined
    
    return { data: entry.data, error: entry.error }
  } catch (error: any) {
    // If the error is due to aborting, remove the cache entry.
    if (error.name === "AbortError") {
      cache.delete(key)
    } else {
      entry.error = error
      entry.data = null
    }
    entry.promise = undefined
    return { data: null, error }
  }
}