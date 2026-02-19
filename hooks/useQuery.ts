import { cache, fetchQuery } from "@/lib/utils/query"
import { useState, useEffect, useCallback } from "react"

export interface UseQueryArgs {
  query: string
  variables?: Record<string, unknown>
  pause?: boolean
}

export interface QueryResult<T = unknown> {
  data: T | null
  fetching: boolean
  error: unknown
}

/**
 * useQuery hook:
 * - Validates the query.
 * - If pause is true, it will not send a request and ensures fetching remains false.
 * - Otherwise, it uses the cache (with expiration) and cancellation logic.
 * - The effect’s dependency key is based on query + JSON.stringify(variables) + pause.
 */
export function useQuery<T = unknown>({
  query,
  variables = {},
  pause = false,
}: UseQueryArgs): [
  QueryResult<T>,
  (newVariables?: Record<string, unknown>) => void,
] {
  // Validate the query.
  if (!query || typeof query !== "string" || query.trim() === "") {
    throw new Error("Invalid query provided to useQuery")
  }

  const key = query + JSON.stringify(variables)

  // Check if the query includes "ExploreTokens" or other specific queries
  const isExploreTokensQuery = query.includes("ExploreTokens")

  // Only use cache if it's not an ExploreTokens or Tokens query
  const cachedEntry = isExploreTokensQuery ? null : cache.get(key)
  const initialData = 
    cachedEntry && cachedEntry.data !== undefined ? cachedEntry.data : null
  const initialError =
    cachedEntry && cachedEntry.error !== undefined ? cachedEntry.error : null
  // If paused, we don't fetch.
  const initialFetching = pause ? false : !cachedEntry

  const [result, setResult] = useState<QueryResult<T>>({
    data: initialData,
    error: initialError,
    fetching: initialFetching,
  })

  useEffect(() => {
    if (pause) {
      // If paused, simply mark fetching false and do nothing.
      setResult(prev => ({ ...prev, fetching: false }))
      return
    }
    const abortController = new AbortController()
    let cancelled = false

    const fetchData = async () => {
      try {
        const { data, error } = await fetchQuery(
          query,
          variables,
          abortController.signal,
        )
        if (!cancelled) {
          setResult({ data, error, fetching: false })
        }
      } catch (err) {
        if (!cancelled) {
          setResult({ data: null, error: err, fetching: false })
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [key, query, JSON.stringify(variables), pause])

  // refetch forces a new request by deleting the cache entry.
  const refetch = useCallback(
    async (newVariables?: Record<string, unknown>) => {
      if (pause) return

      // Use new variables if provided, otherwise fall back to the original variables.
      const updatedVariables = newVariables || variables
      const updatedKey = query + JSON.stringify(updatedVariables)

      // Delete the cache entry for the updated key.
      cache.delete(updatedKey)

      // Set fetching to true.
      setResult(prev => ({ ...prev, fetching: true }))

      try {
        const { data, error } = await fetchQuery(query, updatedVariables)
        setResult({ data, error, fetching: false })
        return data // Return the fetched data for await support
      } catch (err) {
        setResult({ data: null, error: err, fetching: false })
        throw err // Throw the error for await support
      }
    },
    [key, query, JSON.stringify(variables), pause],
  )

  return [result, refetch]
}
