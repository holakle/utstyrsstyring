import { redirect } from "next/navigation";
import { apiGet, ApiError } from "./api";

export async function requireAuth() {
  try {
    return await apiGet("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect("/login");
    }
    throw error;
  }
}

export async function requireAdmin() {
  const me = await requireAuth();
  if (me.role !== "ADMIN") redirect("/assets");
  return me;
}
