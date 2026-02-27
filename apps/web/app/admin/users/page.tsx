import { apiGet } from "../../lib/api";
import { requireAdmin } from "../../lib/session";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminUsersPage() {
  await requireAdmin();
  const users = await apiGet("/users");

  return (
    <section className="grid" style={{ gap: 14 }}>
      <h2>Admin: brukere</h2>
      <AdminUsersClient users={users} />
    </section>
  );
}
