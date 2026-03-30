import { SessionData } from "./session";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  session?: SessionData | null;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.session?.accessToken) {
    headers.Authorization = `Bearer ${options.session.accessToken}`;
  }

  if (options.session?.tenantId) {
    headers["x-tenant-id"] = options.session.tenantId;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const errorPayload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(errorPayload.message)) {
        message = errorPayload.message.join(", ");
      } else if (errorPayload.message) {
        message = errorPayload.message;
      }
    } catch {
      // noop
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
