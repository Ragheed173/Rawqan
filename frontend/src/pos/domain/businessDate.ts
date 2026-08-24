import type { DeviceState } from "../types";

export function currentBusinessDate(
  state: Pick<DeviceState, "timezone" | "businessDayCutoff"> | undefined,
  now = new Date(),
) {
  const timezone = state?.timezone || "Asia/Hebron";
  const cutoff = state?.businessDayCutoff || "04:00";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const localMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const [cutoffHour, cutoffMinute] = cutoff.split(":").map(Number);
  const calendar = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
  );
  if (localMinutes < cutoffHour! * 60 + cutoffMinute!)
    calendar.setUTCDate(calendar.getUTCDate() - 1);
  return calendar.toISOString().slice(0, 10);
}

function zonedParts(date: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

/** Convert a datetime-local control value as restaurant wall time, independent of browser timezone. */
export function restaurantLocalToIso(value: string, timeZone = "Asia/Hebron") {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("INVALID_RESERVATION_TIME");
  const [, year, month, day, hour, minute] = match;
  const wallUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  let instant = wallUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant += wallUtc - represented;
  }
  const result = new Date(instant);
  const check = zonedParts(result, timeZone);
  if (
    `${check.year}-${check.month}-${check.day}T${check.hour}:${check.minute}` !==
    value
  )
    throw new Error("INVALID_RESERVATION_TIME");
  return result.toISOString();
}

export function isoToRestaurantLocal(value: string, timeZone = "Asia/Hebron") {
  const parts = zonedParts(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
