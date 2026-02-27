"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiBase } from "../../lib/api";

export default function AdminUsersClient({ users }: { users: any[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userTagId, setUserTagId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function postUser(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, userTagId, email }),
      });
      if (!res.ok) throw new Error(await res.text());
      setName("");
      setUsername("");
      setPassword("");
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
      const res = await fetch(`${getApiBase()}/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
          <input required placeholder="Brukernavn" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input
            required
            placeholder="Passord"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
              <th>Brukernavn</th>
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
                <td>{u.username}</td>
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
