"use client";

import { useEffect, useRef, useState } from "react";
import {
  displayDateToInputValue,
  formatDisplayDateInput,
  inputDateToDisplayValue,
  isValidDisplayDate,
  todayInputDateValue,
} from "@/lib/format/date";

type DisplayDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  label: string;
  allowFuture?: boolean;
  disabled?: boolean;
  id?: string;
  valueFormat?: "display" | "iso";
  maxDate?: string;
};

export function DisplayDateInput({
  value,
  onChange,
  required = false,
  invalid = false,
  describedBy,
  label,
  allowFuture = false,
  disabled = false,
  id,
  valueFormat = "display",
  maxDate,
}: DisplayDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  // ISO callers keep their API format, while partial typing stays visible locally.
  const [edit, setEdit] = useState<{ text: string; emittedValue: string } | null>(null);
  const textValue = edit?.emittedValue === value ? edit.text
    : valueFormat === "iso" ? inputDateToDisplayValue(value) : value;
  const calendarValue = displayDateToInputValue(textValue);
  const maximum = maxDate ?? (allowFuture ? undefined : todayInputDateValue());

  useEffect(() => {
    const message = textValue && !isValidDisplayDate(textValue)
      ? "Enter a valid date in dd/mm/yyyy format."
      : calendarValue && maximum && calendarValue > maximum
        ? `Choose a date on or before ${inputDateToDisplayValue(maximum)}.`
        : "";
    textRef.current?.setCustomValidity(message);
  }, [textValue, calendarValue, maximum]);

  function openCalendar() {
    const picker = pickerRef.current;
    if (!picker) return;

    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  }

  return (
    <div className="display-date-input" data-invalid={invalid || undefined}>
      <input
        ref={textRef}
        className="display-date-input__text"
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder="dd/mm/yyyy"
        value={textValue}
        onChange={(event) => {
          const text = formatDisplayDateInput(event.target.value);
          const emittedValue = valueFormat === "iso" ? displayDateToInputValue(text) : text;
          setEdit({ text, emittedValue });
          onChange(emittedValue);
        }}
        required={required}
        disabled={disabled}
        aria-label={`${label}, format dd/mm/yyyy`}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      <span className="display-date-input__picker-wrap">
        <button
          className="display-date-input__picker-button"
          type="button"
          onClick={openCalendar}
          disabled={disabled}
          aria-label={`Choose ${label.toLowerCase()} from calendar`}
        >
          <svg
            className="display-date-input__icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
          >
            <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={pickerRef}
          className="display-date-input__picker"
          type="date"
          value={calendarValue}
          max={maximum}
          disabled={disabled}
          onChange={(event) => {
            setEdit(null);
            onChange(valueFormat === "iso" ? event.target.value : inputDateToDisplayValue(event.target.value));
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </span>
    </div>
  );
}
