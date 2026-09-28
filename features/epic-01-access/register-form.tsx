"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/forms/password-requirements";
import {
  MAX_DISPLAY_NAME_LENGTH,
  passwordMeetsRequirements,
  register,
} from "@/lib/api/authApi";
import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";
import { useAuth } from "./auth-context";
import { returnPathForRole } from "./auth-return";
import styles from "./auth-form.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("next");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const displayNameValid =
    displayName.trim().length > 0 && displayName.trim().length <= MAX_DISPLAY_NAME_LENGTH;
  const passwordValid = passwordMeetsRequirements(password);
  const canSubmit = emailValid && displayNameValid && passwordValid && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      await register({ displayName, email, password });
      const signedInUser = await login(email, password);
      router.push(returnPathForRole(requestedPath, signedInUser.role) ?? "/my-reports");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "An account with this email already exists. Try logging in instead."
          : userFacingError(
              err,
              "We couldn’t create your account. Please check your details and try again.",
            ),
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
        <span>Display name</span>
        <input
          type="text"
          name="displayName"
          autoComplete="name"
          required
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={submitting}
        />
      </label>

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

      <PasswordInput
        className={styles.field}
        id="register-password"
        label="Password"
        value={password}
        onChange={setPassword}
        disabled={submitting}
      />

      <button className={styles.submit} type="submit" disabled={!canSubmit}>
        {submitting ? "Creating account…" : "Create account"}
      </button>

      <p className={styles.accountPrompt}>
        Already have an account?{" "}
        <Link href={requestedPath ? `/login?next=${encodeURIComponent(requestedPath)}` : "/login"}>
          Click here to log in
        </Link>.
      </p>
    </form>
  );
}
