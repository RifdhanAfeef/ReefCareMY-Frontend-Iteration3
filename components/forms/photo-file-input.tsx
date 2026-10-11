"use client";

import { useId, useRef, type InputHTMLAttributes } from "react";
import styles from "./photo-file-input.module.css";

type PhotoFileInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  selectedCount: number;
};

/** Keep the website's upload labels independent of the browser's language. */
export function PhotoFileInput({ selectedCount, id, multiple, disabled, ...inputProps }: PhotoFileInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const statusId = `${inputId}-selection`;
  const input = useRef<HTMLInputElement>(null);
  const description = [inputProps["aria-describedby"], statusId].filter(Boolean).join(" ");

  return <div className={styles.control}>
    <input {...inputProps} ref={input} id={inputId} type="file" hidden
      multiple={multiple} disabled={disabled} aria-describedby={description} />
    <button className={styles.button} type="button" disabled={disabled}
      aria-describedby={description} onClick={() => input.current?.click()}>
      {multiple ? "Choose photos" : "Choose photo"}
    </button>
    <span className={styles.selection} id={statusId} role="status">
      {selectedCount > 0
        ? `${selectedCount} photo${selectedCount === 1 ? "" : "s"} selected`
        : multiple ? "No photos selected" : "No photo selected"}
    </span>
  </div>;
}
