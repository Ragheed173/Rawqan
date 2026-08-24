export interface BusinessClockConfig {
  timeZone: string;
  businessDayCutoff: string;
}

export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface BusinessDayBounds {
  start: Date;
  endExclusive: Date;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CUTOFF_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseCalendarDate(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = DATE_RE.exec(date);
  if (!match) throw new TypeError("businessDate must use YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new RangeError("businessDate must be a valid calendar date");
  }
  return { year, month, day };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function parseBusinessDayCutoff(cutoff: string): {
  hour: number;
  minute: number;
} {
  const match = CUTOFF_RE.exec(cutoff);
  if (!match)
    throw new TypeError("businessDayCutoff must use HH:mm in 24-hour time");
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function getZonedDateTimeParts(
  timestamp: Date,
  timeZone: string,
): ZonedDateTimeParts {
  if (!isValidTimeZone(timeZone))
    throw new RangeError(`Invalid IANA time zone: ${timeZone}`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const hour = value("hour");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: hour === 24 ? 0 : hour,
    minute: value("minute"),
    second: value("second"),
  };
}

function calendarDate(
  parts: Pick<ZonedDateTimeParts, "year" | "month" | "day">,
): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day
    .toString()
    .padStart(2, "0")}`;
}

function addCalendarDays(date: string, days: number): string {
  const { year, month, day } = parseCalendarDate(date);
  const shifted = new Date(0);
  shifted.setUTCHours(0, 0, 0, 0);
  shifted.setUTCFullYear(year, month - 1, day + days);
  return shifted.toISOString().slice(0, 10);
}

/** Returns the restaurant business date containing the timestamp. */
export function businessDateFor(
  timestamp: Date,
  config: BusinessClockConfig,
): string {
  const local = getZonedDateTimeParts(timestamp, config.timeZone);
  const cutoff = parseBusinessDayCutoff(config.businessDayCutoff);
  const beforeCutoff =
    local.hour < cutoff.hour ||
    (local.hour === cutoff.hour && local.minute < cutoff.minute);
  const localDate = calendarDate(local);
  return beforeCutoff ? addCalendarDays(localDate, -1) : localDate;
}

/** Converts a wall-clock time in an IANA zone to its UTC instant. */
function zonedWallClockToUtc(
  local: ZonedDateTimeParts,
  timeZone: string,
): Date {
  const targetAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  let guess = targetAsUtc;
  for (let i = 0; i < 5; i++) {
    const observed = getZonedDateTimeParts(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const adjustment = targetAsUtc - observedAsUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return new Date(guess);
}

/** Returns [start, endExclusive) UTC boundaries for a restaurant business date. */
export function businessDayBoundsFor(
  businessDate: string,
  config: BusinessClockConfig,
): BusinessDayBounds {
  const date = parseCalendarDate(businessDate);
  const cutoff = parseBusinessDayCutoff(config.businessDayCutoff);
  const localStart: ZonedDateTimeParts = {
    year: date.year,
    month: date.month,
    day: date.day,
    hour: cutoff.hour,
    minute: cutoff.minute,
    second: 0,
  };
  const nextDate = DATE_RE.exec(addCalendarDays(businessDate, 1))!;
  const localEnd: ZonedDateTimeParts = {
    ...localStart,
    year: Number(nextDate[1]),
    month: Number(nextDate[2]),
    day: Number(nextDate[3]),
  };
  return {
    start: zonedWallClockToUtc(localStart, config.timeZone),
    endExclusive: zonedWallClockToUtc(localEnd, config.timeZone),
  };
}
