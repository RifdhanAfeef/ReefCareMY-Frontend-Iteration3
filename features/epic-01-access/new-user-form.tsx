"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/forms/password-requirements";
import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordMeetsRequirements,
} from "@/lib/api/authApi";
import { createAdminUser } from "@/lib/api/adminApi";
import { ApiError } from "@/lib/api/client";
import { userFacingError } from "@/lib/api/user-facing-error";
import styles from "./access-ui.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewUserForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const displayNameValid =
    displayName.trim().length > 0 && displayName.trim().length <= MAX_DISPLAY_NAME_LENGTH;
  const emailValid = EMAIL_PATTERN.test(normalizedEmail);
  const passwordValid = passwordMeetsRequirements(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit =
    displayNameValid && emailValid && passwordValid && passwordsMatch && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Check the account details and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await createAdminUser({
        displayName: displayName.trim(),
        email: normalizedEmail,
        password,
        role: "observer",
      });

      router.push("/admin/users");
    } catch (createError) {
      setError(
        createError instanceof ApiError && createError.status === 409
          ? "An account with this email already exists."
          : userFacingError(
              createError,
              "The account could not be created. Please check the details and try again.",
            ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.createUserCard} onSubmit={handleSubmit} noValidate>
      <div>
        <h2 className={styles.sectionHeading}>Account details</h2>
        <p className={styles.sectionDescription}>
          Create a Registered Observer account. Coordinator access can be approved later from the user directory.
        </p>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label htmlFor="new-user-name">Display name</label>
          <input className={styles.input} id="new-user-name" type="text" autoComplete="name"
            maxLength={MAX_DISPLAY_NAME_LENGTH} value={displayName}
            onChange={(event) => setDisplayName(event.target.value)} disabled={submitting} required />
        </div>

        <div className={styles.field}>
          <label htmlFor="new-user-email">Email</label>
          <input className={styles.input} id="new-user-email" type="email" autoComplete="email"
            value={email} onChange={(event) => setEmail(event.target.value)}
            disabled={submitting} required />
        </div>

        <PasswordInput className={styles.field} inputClassName={styles.input}
          id="new-user-password" label="Temporary password" value={password}
          onChange={setPassword} disabled={submitting} />

        <div className={styles.field}>
          <label htmlFor="new-user-password-confirmation">Confirm temporary password</label>
          <input className={styles.input} id="new-user-password-confirmation" type="password"
            autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH}
            value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}
            aria-describedby="new-user-password-confirmation-help" disabled={submitting} required />
          <span className={confirmPassword.length > 0 && !passwordsMatch ? styles.fieldError : styles.fieldHelp}
            id="new-user-password-confirmation-help">
            {confirmPassword.length > 0 && !passwordsMatch
              ? "The passwords do not match."
              : "Enter the temporary password again."}
          </span>
        </div>
      </div>

      {error && <p className={styles.formError} role="alert">{error}</p>}

      <div className={styles.buttonRow}>
        <button className={styles.primaryButton} type="submit" disabled={!canSubmit}>
          {submitting ? "Creating account..." : "Create user account"}
        </button>
        <Link className={styles.secondaryButton} href="/admin/users">Cancel</Link>
      </div>
    </form>
  );
}
