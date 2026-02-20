"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * ActionsPanel = GUI for å trykke på knapper (seed/simuler).
 * Denne komponenten kjører i nettleseren ("use client"),
 * så vi kan bruke onClick og fetch() direkte.
 */
export default function ActionsPanel() {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedAsset, setSelectedAsset] = useState<string>("");

  const [busy, setBusy] = useState<string>("");

  // Henter users/assets til dropdowns
  async function loadLists() {
    const [u, a] = await Promise.all([
      fetch(`${api}/users`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`${api}/assets`, { cache: "no-store" }).then((r) => r.json()),
    ]);

    setUsers(u);
    setAssets(a);

    // Sett default valg hvis tomt
    if (!selectedUser && u?.[0]?.userTagId) setSelectedUser(u[0].userTagId);
    if (!selectedAsset && a?.[0]?.assetTagId) setSelectedAsset(a[0].assetTagId);
  }

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(path: string, body?: any) {
    setBusy(path);
    try {
      const res = await fetch(`${api}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Feil ${res.status}: ${JSON.stringify(data)}`);
      }

      // Refresh server components (page.tsx) så tabeller oppdateres
      router.refresh();

      // Oppdater dropdown-data også
      await loadLists();
    } finally {
      setBusy("");
    }
  }

  return (
    <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
      <h2>Kontroller (GUI)</h2>
      <p>Trykk knapper for å legge inn demo-data og simulere utlån/retur.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => post("/seed")} disabled={!!busy}>
          {busy === "/seed" ? "Seeder..." : "Seed demo-data"}
        </button>

        <span style={{ marginLeft: 12 }}>Bruker:</span>
        <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.userTagId}>
              {u.name} ({u.userTagId})
            </option>
          ))}
        </select>

        <span>Utstyr:</span>
        <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}>
          {assets.map((a) => (
            <option key={a.id} value={a.assetTagId}>
              {a.name} ({a.assetTagId})
            </option>
          ))}
        </select>

        <button
          onClick={() => post("/simulate/exit", { assetTagId: selectedAsset, userTagId: selectedUser })}
          disabled={!!busy || !selectedUser || !selectedAsset}
        >
          {busy === "/simulate/exit" ? "Simulerer..." : "Simuler UT (exit/checkout)"}
        </button>

        <button
          onClick={() => post("/simulate/enter", { assetTagId: selectedAsset })}
          disabled={!!busy || !selectedAsset}
        >
          {busy === "/simulate/enter" ? "Simulerer..." : "Simuler INN (enter/checkin)"}
        </button>
      </div>
    </section>
  );
}