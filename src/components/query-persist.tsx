import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Persists the React Query cache in localStorage so returning to a page
 * (or reloading the app) renders instantly from cache while data refreshes
 * in the background.
 */
export function useQueryCachePersistence(queryClient: QueryClient) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "voice-panel-query-cache",
      throttleTime: 1000,
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" &&
          // never persist blobs / object URLs (recordings, audio proxies)
          !JSON.stringify(query.queryKey).includes("recording"),
      },
    });

    return unsubscribe;
  }, [queryClient]);
}
