const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiGet(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function apiPost(path: string, body?: unknown, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function apiPatch(path: string, body?: unknown, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function apiDelete(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DELETE ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const adminHeaders = {
  "x-user-role": "ADMIN",
  "x-user-tag": "ADMIN001",
};

export const userHeaders = {
  "x-user-role": "USER",
  "x-user-tag": "U001",
};
