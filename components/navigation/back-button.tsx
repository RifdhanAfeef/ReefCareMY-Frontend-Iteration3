"use client";

import { useRouter } from "next/navigation";
import styles from "./back-button.module.css";

export function BackButton({
  fallbackHref = "/",
  label = "Back",
  className = "",
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer?.origin === window.location.origin) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      className={`${styles.backButton} ${className}`.trim()}
      onClick={goBack}
    >
      <span aria-hidden="true">←</span>
      {label}
    </button>
  );
}
