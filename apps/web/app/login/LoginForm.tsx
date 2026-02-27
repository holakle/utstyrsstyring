"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "../lib/api";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.push("/assets");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Innlogging feilet");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid" style={{ gap: 10 }} onSubmit={onSubmit}>
      <input
        required
        placeholder="Brukernavn"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        required
        type="password"
        placeholder="Passord"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Logger inn..." : "Logg inn"}
      </button>
      {error ? (
        <p className="muted" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
