import Link from "next/link";
import { apiGet } from "../lib/api";
import { requireAdmin } from "../lib/session";

export default async function AdminPage() {
  await requireAdmin();
  const [assets, active, events] = await Promise.all([
    apiGet("/assets"),
    apiGet("/assignments/active"),
    apiGet("/events"),
  ]);

  const overdue = active.filter((a: any) => a.dueAt && new Date(a.dueAt).getTime() < Date.now()).length;
  const missing = assets.filter((a: any) => a.status === "MISSING").length;

  return (
    <section className="grid" style={{ gap: 14 }}>
      <h2>Admin dashboard</h2>
      <div className="grid cols-3">
        <div className="card">
          <h3>Aktive utlån</h3>
          <p style={{ fontSize: "1.8rem", margin: 0 }}>{active.length}</p>
        </div>
        <div className="card">
          <h3>Overdue</h3>
          <p style={{ fontSize: "1.8rem", margin: 0 }}>{overdue}</p>
        </div>
        <div className="card">
          <h3>Mangler</h3>
          <p style={{ fontSize: "1.8rem", margin: 0 }}>{missing}</p>
        </div>
      </div>

      <div className="card row">
        <Link href="/admin/assets">Administrer utstyr</Link>
        <Link href="/admin/users">Administrer brukere</Link>
      </div>

      <div className="card">
        <h3>Siste hendelser</h3>
        <table>
          <thead>
            <tr>
              <th>Tid</th>
              <th>Type</th>
              <th>Utstyr</th>
              <th>Bruker</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 15).map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.type}</td>
                <td>{e.asset?.name ?? "-"}</td>
                <td>{e.user?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
