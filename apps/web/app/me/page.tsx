import { apiGet } from "../lib/api";
import { requireAuth } from "../lib/session";

export default async function MePage() {
  await requireAuth();
  const me = await apiGet("/me");
  const [active, events] = await Promise.all([
    apiGet(`/assignments/active?userId=${me.id}`),
    apiGet(`/events?userId=${me.id}`),
  ]);

  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="card">
        <h2>Min side</h2>
        <p>
          {me.name} ({me.userTagId})
        </p>
      </div>

      <div className="card">
        <h3>Mine aktive utlån</h3>
        <table>
          <thead>
            <tr>
              <th>Utstyr</th>
              <th>Status</th>
              <th>Utlant</th>
              <th>Forfall</th>
            </tr>
          </thead>
          <tbody>
            {active.map((a: any) => (
              <tr key={a.id}>
                <td>{a.asset.name}</td>
                <td>{a.asset.status}</td>
                <td>{new Date(a.checkedOutAt).toLocaleString()}</td>
                <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Min historikk</h3>
        <table>
          <thead>
            <tr>
              <th>Tid</th>
              <th>Type</th>
              <th>Utstyr</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.type}</td>
                <td>{e.asset?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
