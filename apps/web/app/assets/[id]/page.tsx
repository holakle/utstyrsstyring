import { apiGet } from "../../lib/api";

type Params = Promise<{ id: string }>;

export default async function AssetDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const [asset, history] = await Promise.all([apiGet(`/assets/${id}`), apiGet(`/assets/${id}/history`)]);

  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="card">
        <h2>{asset.name}</h2>
        <p className="muted">Tag: {asset.assetTagId}</p>
        <div className="row">
          <span className={`badge ${asset.status === "AVAILABLE" ? "ok" : "warn"}`}>{asset.status}</span>
          <span className="badge">Kategori: {asset.category?.name ?? "-"}</span>
          <span className="badge">Lokasjon: {asset.location?.name ?? "-"}</span>
          {asset.assignments?.[0] && <span className="badge warn">Aktiv: {asset.assignments[0].user.name}</span>}
        </div>
      </div>

      <div className="card">
        <h3>Tildelingshistorikk</h3>
        <table>
          <thead>
            <tr>
              <th>Bruker</th>
              <th>Utlant</th>
              <th>Forfall</th>
              <th>Returnert</th>
            </tr>
          </thead>
          <tbody>
            {history.assignments.map((a: any) => (
              <tr key={a.id}>
                <td>{a.user.name}</td>
                <td>{new Date(a.checkedOutAt).toLocaleString()}</td>
                <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "-"}</td>
                <td>{a.returnedAt ? new Date(a.returnedAt).toLocaleString() : "Aktiv"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Events</h3>
        <table>
          <thead>
            <tr>
              <th>Tid</th>
              <th>Type</th>
              <th>Bruker</th>
            </tr>
          </thead>
          <tbody>
            {history.events.map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{e.type}</td>
                <td>{e.user?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
