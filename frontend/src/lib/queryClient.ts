import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000, // 10 seconds default stale time
      gcTime: 5 * 60_000, // 5 minutes garbage collection time
      refetchOnWindowFocus: false, // Prevent unnecessary flashes on window switch
      retry: 1, // Single retry on network blip
    },
  },
});
