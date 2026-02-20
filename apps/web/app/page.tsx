import ActionsPanel from "./ActionsPanel";

export default async function Home() {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const [assets, events] = await Promise.all([
    fetch(`${api}/assets`, { cache: "no-store" }).then(r => r.json()),
    fetch(`${api}/events`, { cache: "no-store" }).then(r => r.json()),
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Utstyrsstyring (MVP)</h1>

      <ActionsPanel />

      <section style={{ marginTop: 24 }}>
        <h2>Utstyr</h2>
        <table border={1} cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Tag</th>
              <th>Status</th>
              <th>Holder</th>
              <th>Sist oppdatert</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a: any) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.assetTagId}</td>
                <td>{a.status}</td>
                <td>{a.holderUser?.name ?? "-"}</td>
                <td>{new Date(a.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Events</h2>
        <ul>
          {events.map((e: any) => (
            <li key={e.id}>
              {new Date(e.ts).toLocaleString()} — <b>{e.type}</b> {e.assetTagId}
              {e.userTagId ? ` → ${e.userTagId}` : ""} (conf: {Number(e.confidence).toFixed(2)})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}