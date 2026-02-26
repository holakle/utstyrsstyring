"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const headers = {
  "Content-Type": "application/json",
  "x-user-role": "ADMIN",
  "x-user-tag": "ADMIN001",
};

export default function AdminAssetActions({ users, assets }: { users: any[]; assets: any[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [assetId, setAssetId] = useState(assets[0]?.id ?? "");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetTag, setNewAssetTag] = useState("");

  async function post(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateAsset(e: FormEvent) {
    e.preventDefault();
    await post("/assets", { name: newAssetName, assetTagId: newAssetTag });
    setNewAssetName("");
    setNewAssetTag("");
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <h3>Checkout / Return</h3>
        <div className="row">
          <select value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.status})
              </option>
            ))}
          </select>

          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

          <button
            className="primary"
            disabled={busy || !assetId || !userId}
            onClick={() => post("/assignments/checkout", { assetId, userId, dueDate: dueDate || undefined })}
          >
            Checkout
          </button>
          <button disabled={busy || !assetId} onClick={() => post("/assignments/return", { assetId })}>
            Return
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Opprett utstyr</h3>
        <form className="row" onSubmit={onCreateAsset}>
          <input required placeholder="Navn" value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} />
          <input required placeholder="Asset tag" value={newAssetTag} onChange={(e) => setNewAssetTag(e.target.value)} />
          <button className="primary" disabled={busy} type="submit">
            Opprett
          </button>
        </form>
      </div>

      <div className="card row">
        <button disabled={busy} onClick={() => post("/seed")}>
          Seed demo-data
        </button>
      </div>
    </div>
  );
}
