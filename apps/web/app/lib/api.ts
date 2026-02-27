const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request(path: string, method: ApiMethod, body?: unknown, init?: RequestInit) {
  const isServer = typeof window === "undefined";
  const apiBase =
    API ||
    (isServer
      ? process.env.API_INTERNAL_URL ?? "http://localhost:3001"
      : `${window.location.protocol}//${window.location.hostname}:3001`);
  const cookieHeader = isServer
    ? await (async () => {
        const { cookies } = await import("next/headers");
        return (await cookies()).toString();
      })()
    : undefined;
  const headers: Record<string, string> = {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };

  const res = await fetch(`${apiBase}${path}`, {
    method,
    cache: "no-store",
    credentials: "include",
    ...init,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(`${method} ${path} failed (${res.status}): ${text}`, res.status);
  }
  return res.json();
}

export function apiGet(path: string, init?: RequestInit) {
  return request(path, "GET", undefined, init);
}

export function apiPost(path: string, body?: unknown, init?: RequestInit) {
  return request(path, "POST", body, init);
}

export function apiPatch(path: string, body?: unknown, init?: RequestInit) {
  return request(path, "PATCH", body, init);
}

export function apiDelete(path: string, init?: RequestInit) {
  return request(path, "DELETE", undefined, init);
}

export function getApiBase() {
  if (API) return API;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return process.env.API_INTERNAL_URL ?? "http://localhost:3001";
}
