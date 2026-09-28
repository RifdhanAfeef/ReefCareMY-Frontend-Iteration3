export const REEFCARE_TIME_ZONE = "Asia/Kuala_Lumpur";

function malaysiaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REEFCARE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function formatDateTime(date = new Date()) {
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: REEFCARE_TIME_ZONE,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: REEFCARE_TIME_ZONE,
  }).format(date);
  return `${datePart}, ${timePart.toUpperCase()}`;
}

export function isValidDisplayDate(value: string) {
  if (!value) return true;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function isFutureDisplayDate(value: string, now = new Date()) {
  if (!isValidDisplayDate(value)) return false;
  const [day, month, year] = value.split("/").map(Number);
  const supplied = Date.UTC(year, month - 1, day);
  const malaysiaToday = malaysiaDateParts(now);
  const today = Date.UTC(
    Number(malaysiaToday.year),
    Number(malaysiaToday.month) - 1,
    Number(malaysiaToday.day),
  );
  return supplied > today;
}

export function isFutureDisplayDateTime(
  dateValue: string,
  timeValue: string,
  now = new Date(),
) {
  if (!isValidDisplayDate(dateValue) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    return false;
  }

  const [day, month, year] = dateValue.split("/").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const supplied = Date.parse(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
  );
  return supplied > now.getTime();
}

export function displayDateToInputValue(value: string) {
  if (!value || !isValidDisplayDate(value)) return "";
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export function inputDateToDisplayValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function dateToMalaysiaFormValues(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REEFCARE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const day = part("day");
  const month = part("month");
  const year = part("year");
  const hour = part("hour");
  const minute = part("minute");
  if (!day || !month || !year || !hour || !minute) return null;
  return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}` };
}

export function formatDisplayDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean);
  return parts.join("/");
}

export function todayInputDateValue(now = new Date()) {
  const { year, month, day } = malaysiaDateParts(now);
  return `${year}-${month}-${day}`;
}

export function displayDateToIsoDate(value: string) {
  if (!isValidDisplayDate(value) || !value) {
    throw new Error("Enter a valid date in dd/mm/yyyy format.");
  }
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export function displayDateAndTimeToIso(dateValue: string, timeValue: string) {
  const isoDate = displayDateToIsoDate(dateValue);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    throw new Error("Enter a valid time.");
  }
  return new Date(`${isoDate}T${timeValue}:00+08:00`).toISOString();
}
