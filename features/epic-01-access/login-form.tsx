"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";
import { useAuth } from "./auth-context";
import { returnPathForRole } from "./auth-return";
import styles from "./auth-form.module.css";

/** Keep analysis deep links across login without accepting external redirects. */
export function hotspotLoginReturn(next: string | null, origin: string): string | null {
  if (!next?.startsWith("/coordinator/hotspots")) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin || !(url.pathname === "/coordinator/hotspots" || /^\/coordinator\/hotspots\/reports\/[^/]+$/.test(url.pathname))) return null;
    return url.pathname + url.search;
  } catch { return null; }
}

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const signedInUser = await login(email, password);
      const roleDefault = signedInUser.role === "case_coordinator"
        ? "/coordinator/report-queue"
        : signedInUser.role === "system_administrator"
          ? "/admin/users"
          : "/";
      const returnTo = signedInUser.role === "case_coordinator"
        ? hotspotLoginReturn(new URLSearchParams(window.location.search).get("next"), window.location.origin)
        : null;
      const destination = returnPathForRole(requestedPath, signedInUser.role) ?? roleDefault;
      router.push(returnTo ?? destination);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Email or password is incorrect."
          : userFacingError(err, "We couldn’t log you in. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
      </label>

      <button className={styles.submit} type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Log in"}
      </button>

      <p className={styles.accountPrompt}>
        Don&apos;t have an account?{" "}
        <Link href={requestedPath ? `/register?next=${encodeURIComponent(requestedPath)}` : "/register"}>
          Click here to register
        </Link>.
      </p>
    </form>
  );
}
