"use client";

import { useRouter } from "next/navigation";
import { getApiBase } from "./lib/api";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch(`${getApiBase()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout}>
      Logg ut
    </button>
  );
}
