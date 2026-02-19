/**
 * Unit tests for hooks/useQuery.ts
 *
 * Strategy: mock @/lib/utils/query to control fetchQuery and cache behaviour.
 * Test the hook logic: loading state, caching, pause, error handling, refetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useQuery } from "@/hooks/useQuery";

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Use a real Map for cache so we can inspect/clear it between tests.
const mockCache = new Map<string, { data?: unknown; error?: unknown }>();
const mockFetchQuery = vi.fn();

vi.mock("@/lib/utils/query", () => ({
  get cache() { return mockCache; },
  fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
const SIMPLE_QUERY = `query TestQuery { Vault { id } }`;
const VARIABLES = { ids: ["0x1"] };

beforeEach(() => {
  vi.clearAllMocks();
  mockCache.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — invalid query", () => {
  it("throws when query is an empty string", () => {
    expect(() =>
      renderHook(() => useQuery({ query: "" }))
    ).toThrow("Invalid query provided to useQuery");
  });

  it("throws when query is only whitespace", () => {
    expect(() =>
      renderHook(() => useQuery({ query: "   " }))
    ).toThrow("Invalid query provided to useQuery");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pause behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — pause=true", () => {
  it("does not call fetchQuery when paused", () => {
    renderHook(() => useQuery({ query: SIMPLE_QUERY, pause: true }));
    expect(mockFetchQuery).not.toHaveBeenCalled();
  });

  it("sets fetching=false immediately when paused", () => {
    const { result } = renderHook(() =>
      useQuery({ query: SIMPLE_QUERY, pause: true })
    );
    expect(result.current[0].fetching).toBe(false);
  });

  it("data is null when paused", () => {
    const { result } = renderHook(() =>
      useQuery({ query: SIMPLE_QUERY, pause: true })
    );
    expect(result.current[0].data).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Loading state
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — loading state", () => {
  it("starts with fetching=true when no cache entry exists", () => {
    // fetchQuery never resolves during this test
    mockFetchQuery.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));
    expect(result.current[0].fetching).toBe(true);
  });

  it("sets fetching=false after successful fetch", async () => {
    mockFetchQuery.mockResolvedValueOnce({ data: { Vault: [] }, error: null });

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));

    await waitFor(() => {
      expect(result.current[0].fetching).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Successful fetch
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — successful data fetch", () => {
  it("populates data after fetchQuery resolves", async () => {
    const responseData = { Vault: [{ id: "0xabc" }] };
    mockFetchQuery.mockResolvedValueOnce({ data: responseData, error: null });

    const { result } = renderHook(() =>
      useQuery<{ Vault: { id: string }[] }>({ query: SIMPLE_QUERY })
    );

    await waitFor(() => {
      expect(result.current[0].data).toEqual(responseData);
    });
    expect(result.current[0].fetching).toBe(false);
    expect(result.current[0].error).toBeNull();
  });

  it("calls fetchQuery with correct query and variables", async () => {
    mockFetchQuery.mockResolvedValueOnce({ data: {}, error: null });

    renderHook(() => useQuery({ query: SIMPLE_QUERY, variables: VARIABLES }));

    await waitFor(() => expect(mockFetchQuery).toHaveBeenCalled());
    expect(mockFetchQuery).toHaveBeenCalledWith(
      SIMPLE_QUERY,
      VARIABLES,
      expect.any(AbortSignal),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — error handling", () => {
  it("sets error when fetchQuery throws", async () => {
    const networkError = new Error("Network failure");
    mockFetchQuery.mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));

    await waitFor(() => {
      expect(result.current[0].error).toBe(networkError);
    });
    expect(result.current[0].data).toBeNull();
    expect(result.current[0].fetching).toBe(false);
  });

  it("sets error when fetchQuery resolves with an error", async () => {
    const gqlError = new Error("GraphQL error");
    mockFetchQuery.mockResolvedValueOnce({ data: null, error: gqlError });

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));

    await waitFor(() => {
      expect(result.current[0].error).toBe(gqlError);
    });
    expect(result.current[0].fetching).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cache behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — cache hit", () => {
  it("initialises from cache without a loading spinner", async () => {
    // Pre-populate cache with a valid entry
    const cacheKey = SIMPLE_QUERY + JSON.stringify({});
    const cachedData = { Vault: [{ id: "cached" }] };
    mockCache.set(cacheKey, { data: cachedData, error: null });

    // The effect still calls fetchQuery (which in production uses the cache
    // internally), so provide a resolved value matching the cached data.
    mockFetchQuery.mockResolvedValue({ data: cachedData, error: null });

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));

    // Initial state should be populated from cache with fetching=false
    expect(result.current[0].data).toEqual(cachedData);
    expect(result.current[0].fetching).toBe(false);

    // Wait for the effect to settle — data should remain stable
    await waitFor(() => expect(result.current[0].fetching).toBe(false));
    expect(result.current[0].data).toEqual(cachedData);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refetch
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — refetch", () => {
  it("exposes a refetch function as the second element", () => {
    mockFetchQuery.mockResolvedValue({ data: {}, error: null });
    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));
    expect(typeof result.current[1]).toBe("function");
  });

  it("refetch clears cache and re-fetches data", async () => {
    const cacheKey = SIMPLE_QUERY + JSON.stringify({});
    const freshData = { Vault: [{ id: "fresh" }] };

    // Initial fetch
    mockFetchQuery
      .mockResolvedValueOnce({ data: { Vault: [] }, error: null }) // initial
      .mockResolvedValueOnce({ data: freshData, error: null }); // refetch

    const { result } = renderHook(() => useQuery({ query: SIMPLE_QUERY }));

    // Wait for initial load
    await waitFor(() => expect(result.current[0].fetching).toBe(false));

    // Pre-populate cache to verify refetch clears it
    mockCache.set(cacheKey, { data: { Vault: [] } });
    expect(mockCache.has(cacheKey)).toBe(true);

    // refetch
    await act(async () => {
      await result.current[1]();
    });

    // Cache should have been cleared at the start of refetch
    // (the second fetchQuery call re-populates it)
    expect(mockFetchQuery).toHaveBeenCalledTimes(2);
    expect(result.current[0].data).toEqual(freshData);
  });

  it("refetch does nothing when paused", async () => {
    const { result } = renderHook(() =>
      useQuery({ query: SIMPLE_QUERY, pause: true })
    );

    await act(async () => {
      await result.current[1]();
    });

    expect(mockFetchQuery).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ExploreTokens bypass
// ─────────────────────────────────────────────────────────────────────────────

describe("useQuery — ExploreTokens cache bypass", () => {
  it("does not serve cached data for ExploreTokens queries", async () => {
    const exploreQuery = `query ExploreTokens { Token { id } }`;
    const cacheKey = exploreQuery + JSON.stringify({});

    // Pre-populate cache — should be ignored
    mockCache.set(cacheKey, { data: { Token: [{ id: "stale" }] } });
    mockFetchQuery.mockResolvedValueOnce({ data: { Token: [{ id: "fresh" }] }, error: null });

    const { result } = renderHook(() => useQuery({ query: exploreQuery }));

    // Even with a cache entry, it should still fetch
    await waitFor(() => expect(mockFetchQuery).toHaveBeenCalled());
    expect(result.current[0].data).toEqual({ Token: [{ id: "fresh" }] });
  });
});
