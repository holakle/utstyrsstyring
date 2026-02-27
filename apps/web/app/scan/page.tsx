import ScanClient from "./ScanClient";
import { requireAuth } from "../lib/session";

export default async function ScanPage() {
  await requireAuth();
  return (
    <section className="grid" style={{ gap: 14 }}>
      <div className="card">
        <h2>Mobil skanning (pilot)</h2>
        <p className="muted">
          Start kamera, skann en strekkode, og koble koden til valgt gjenstand som <code>barcode</code>.
        </p>
      </div>
      <ScanClient />
    </section>
  );
}
