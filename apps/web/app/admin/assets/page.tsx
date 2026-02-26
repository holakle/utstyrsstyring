import AdminAssetActions from "../AdminAssetActions";
import { adminHeaders, apiGet } from "../../lib/api";

export default async function AdminAssetsPage() {
  const [assets, users, activeAssignments] = await Promise.all([
    apiGet("/assets", { headers: adminHeaders }),
    apiGet("/users", { headers: adminHeaders }),
    apiGet("/assignments/active", { headers: adminHeaders }),
  ]);

  const activeMap = new Map<string, any>();
  activeAssignments.forEach((a: any) => activeMap.set(a.assetId, a));

  return (
    <section className="grid" style={{ gap: 14 }}>
      <h2>Admin: utstyr</h2>
      <AdminAssetActions users={users} assets={assets} />

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Tag</th>
              <th>Status</th>
              <th>Kategori</th>
              <th>Lokasjon</th>
              <th>Tildelt til</th>
              <th>Forfall</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a: any) => {
              const active = activeMap.get(a.id);
              const overdue = active?.dueAt && new Date(active.dueAt).getTime() < Date.now();
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.assetTagId}</td>
                  <td>{a.status}</td>
                  <td>{a.category?.name ?? "-"}</td>
                  <td>{a.location?.name ?? "-"}</td>
                  <td>{active?.user?.name ?? "-"}</td>
                  <td>
                    {active?.dueAt
                      ? `${new Date(active.dueAt).toLocaleDateString()}${overdue ? " (OVERDUE)" : ""}`
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
