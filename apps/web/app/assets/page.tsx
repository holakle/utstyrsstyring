import Link from "next/link";
import { apiGet } from "../lib/api";
import { requireAuth } from "../lib/session";

type SearchParams = Promise<{
  search?: string;
  status?: string;
  category?: string;
  location?: string;
}>;

export default async function AssetsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireAuth();
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);
  if (params.category) qs.set("category", params.category);
  if (params.location) qs.set("location", params.location);

  const assets = await apiGet(`/assets${qs.toString() ? `?${qs}` : ""}`);

  return (
    <section className="grid" style={{ gap: 14 }}>
      {me.role === "ADMIN" ? (
        <div className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <h3 style={{ marginBottom: 6 }}>Hurtighandling</h3>
            <p className="muted" style={{ margin: 0 }}>
              Opprett ny bruker direkte fra forsiden.
            </p>
          </div>
          <Link href="/admin/users">
            <button className="primary" type="button">
              Lag bruker
            </button>
          </Link>
        </div>
      ) : null}

      <div className="card">
        <h2>Utstyr</h2>
        <form className="row" method="get">
          <input name="search" placeholder="Sok navn/tag/serial" defaultValue={params.search ?? ""} />
          <select name="status" defaultValue={params.status ?? ""}>
            <option value="">Alle statuser</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="CHECKED_OUT">CHECKED_OUT</option>
            <option value="MISSING">MISSING</option>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="RETIRED">RETIRED</option>
          </select>
          <input name="category" placeholder="Kategori" defaultValue={params.category ?? ""} />
          <input name="location" placeholder="Lokasjon" defaultValue={params.location ?? ""} />
          <button className="primary" type="submit">
            Filtrer
          </button>
        </form>
      </div>

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a: any) => {
              const active = a.assignments?.[0];
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.assetTagId}</td>
                  <td>
                    <span className={`badge ${a.status === "AVAILABLE" ? "ok" : "warn"}`}>{a.status}</span>
                  </td>
                  <td>{a.category?.name ?? "-"}</td>
                  <td>{a.location?.name ?? "-"}</td>
                  <td>{active?.user?.name ?? "-"}</td>
                  <td>
                    <Link href={`/assets/${a.id}`}>Detaljer</Link>
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
