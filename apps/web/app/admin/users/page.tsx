import { adminHeaders, apiGet } from "../../lib/api";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const users = await apiGet("/users", { headers: adminHeaders });

  return (
    <section className="grid" style={{ gap: 14 }}>
      <h2>Admin: brukere</h2>
      <AdminUsersClient users={users} />
    </section>
  );
}
