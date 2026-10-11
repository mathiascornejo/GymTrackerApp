import { QueryClient } from "@tanstack/react-query";

// A singleton so non-React code (the set outbox) can patch the cache.
export const queryClient = new QueryClient();
