import { useCallback, useState } from "react";

interface UseServerActionOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
}

interface UseServerActionReturn<TArgs extends unknown[], TResult> {
  execute: (...args: TArgs) => Promise<TResult>;
  loading: boolean;
  error: Error | null;
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === "Failed to fetch") return true;
  if (err instanceof Error && err.message.includes("NetworkError")) return true;
  if (err instanceof Error && err.message.includes("fetch")) return true;
  return false;
}

/**
 * Hook wrapping a server action with automatic retry on network errors.
 * Only retries transient network failures, not application-level errors.
 */
export function useServerAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseServerActionOptions = {}
): UseServerActionReturn<TArgs, TResult> {
  const { maxRetries = 2, retryDelay = 1000, onError } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      setLoading(true);
      setError(null);

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await action(...args);
          setLoading(false);
          return result;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          // Only retry on network errors, not application errors
          if (!isNetworkError(err) || attempt === maxRetries) {
            setError(lastError);
            setLoading(false);
            onError?.(lastError);
            throw lastError;
          }

          // Wait before retrying with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay * Math.pow(2, attempt))
          );
        }
      }

      // Should not reach here, but satisfy TypeScript
      setLoading(false);
      throw lastError;
    },
    [action, maxRetries, retryDelay, onError]
  );

  return { execute, loading, error };
}
