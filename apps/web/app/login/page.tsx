import { redirect } from "next/navigation";
import { apiGet, ApiError } from "../lib/api";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  try {
    await apiGet("/auth/me");
    redirect("/assets");
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 401 || error.status === 403))) {
      throw error;
    }
  }

  return (
    <section className="grid" style={{ gap: 14, maxWidth: 480, margin: "30px auto" }}>
      <div className="card">
        <h2>Logg inn</h2>
        <p className="muted">Bruk konto for mobil/PC admin eller vanlig bruker.</p>
        <LoginForm />
      </div>
    </section>
  );
}
