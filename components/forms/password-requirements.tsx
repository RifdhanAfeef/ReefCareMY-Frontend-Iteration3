"use client";

import { useId, useState } from "react";
import {
  MAX_PASSWORD_LENGTH,
  MIN_DISTINCT_PASSWORD_CHARACTERS,
  MIN_PASSWORD_LENGTH,
} from "@/lib/api/authApi";
import styles from "./password-requirements.module.css";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  minLength?: number;
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className,
  inputClassName,
  minLength = MIN_PASSWORD_LENGTH,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const requirementsId = useId();
  const lengthValid = value.length >= minLength;
  const distinctValid = new Set(value).size >= MIN_DISTINCT_PASSWORD_CHARACTERS;

  return (
    <div className={`${styles.passwordField}${className ? ` ${className}` : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.inputWrap}>
        <input
          className={inputClassName}
          id={id}
          type={visible ? "text" : "password"}
          name="password"
          autoComplete="new-password"
          required
          minLength={minLength}
          maxLength={MAX_PASSWORD_LENGTH}
          aria-describedby={requirementsId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
        <button
          className={styles.visibilityButton}
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          disabled={disabled}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      <ul className={styles.requirements} id={requirementsId} aria-label="Password requirements">
        <li data-valid={lengthValid}>
          {lengthValid ? "Met: " : "Required: "}At least {minLength} characters
        </li>
        <li data-valid={distinctValid}>
          {distinctValid ? "Met: " : "Required: "}At least {MIN_DISTINCT_PASSWORD_CHARACTERS} different characters
        </li>
      </ul>
    </div>
  );
}
