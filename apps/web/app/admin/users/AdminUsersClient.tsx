"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const adminHeaders = {
  "Content-Type": "application/json",
  "x-user-role": "ADMIN",
  "x-user-tag": "ADMIN001",
};

export default function AdminUsersClient({ users }: { users: any[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [userTagId, setUserTagId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function postUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/users`, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ name, userTagId, email }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setUserTagId("");
      setEmail("");
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function setActive(id: string, isActive: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`${API}/users/${id}`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="card">
        <h3>Opprett bruker</h3>
        <form className="row" onSubmit={postUser}>
          <input required placeholder="Navn" value={name} onChange={(e) => setName(e.target.value)} />
          <input required placeholder="UserTag" value={userTagId} onChange={(e) => setUserTagId(e.target.value)} />
          <input placeholder="E-post" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="primary" type="submit" disabled={busy}>
            Opprett
          </button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Tag</th>
              <th>Rolle</th>
              <th>Aktiv</th>
              <th>Aktive utlån</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.userTagId}</td>
                <td>{u.role}</td>
                <td>{u.isActive ? "Ja" : "Nei"}</td>
                <td>{u.assignments?.length ?? 0}</td>
                <td>
                  {u.isActive ? (
                    <button className="danger" disabled={busy} onClick={() => setActive(u.id, false)}>
                      Deaktiver
                    </button>
                  ) : (
                    <button disabled={busy} onClick={() => setActive(u.id, true)}>
                      Aktiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
