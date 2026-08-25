// Timezone-aware "today"/"hour of day" helpers — this app is Singapore-only (see Navbar's header
// clock), but nearly every place that buckets data by day or hour used to do it with plain
// `Date` methods (`.toDateString()`, `.getHours()`), which read the BROWSER's local timezone, not
// Singapore's. An operator whose machine isn't set to SGT would silently get "today" and
// hour-of-day boundaries computed against their own midnight/hour, not Singapore's — most visible
// right around SGT midnight, where a device in a timezone hours behind could show yesterday's
// last few hours as "today," or vice versa. These centralize the one correct definition (matching
// Navbar's own `Intl.DateTimeFormat` usage) so every date-bucketing call site agrees.

const SGT_TIME_ZONE = "Asia/Singapore";

const sgtDateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SGT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const sgtHourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, hour: "2-digit", hour12: false,
});
const sgtMinuteFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, minute: "2-digit",
});

/** Y-M-D key for `d` in Singapore time — use this instead of `.toDateString()` for "is this
 * today" comparisons. */
export function sgtDateKey(d: Date): string {
  return sgtDateKeyFormatter.format(d);
}

/** True if `a` and `b` fall on the same Singapore calendar day. */
export function isSameSgtDay(a: Date, b: Date): boolean {
  return sgtDateKey(a) === sgtDateKey(b);
}

/** True if `d` falls on today's Singapore calendar day (as of `now`, defaulting to the real
 * current time). */
export function isTodaySgt(d: Date, now: Date = new Date()): boolean {
  return isSameSgtDay(d, now);
}

/** Hour of day (0-23) for `d` in Singapore time — use this instead of `.getHours()` for
 * hour-of-day bucketing. */
export function sgtHour(d: Date): number {
  // Intl gives "24" for midnight with hour12:false in some engines instead of "00" — normalize.
  return parseInt(sgtHourFormatter.format(d), 10) % 24;
}

/** Minute of hour (0-59) for `d` in Singapore time — use this instead of `.getMinutes()` when
 * placing a point within its hour bucket. */
export function sgtMinute(d: Date): number {
  return parseInt(sgtMinuteFormatter.format(d), 10);
}

const sgtClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SGT_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

/** "HH:MM:SS" Singapore-time clock string for `d` — for showing an actual captured time rather
 * than a relative "Xh ago" label. */
export function sgtClockTime(d: Date): string {
  return sgtClockFormatter.format(d);
}

/** "Now," rounded down to the nearest 10 minutes. A server-render pass and the client-hydration
 * pass moments later read `Date.now()` at two genuinely different instants — rounding this
 * coarsely means both passes almost always land in the same bucket, avoiding a text hydration
 * mismatch on any display seeded from this. */
function coarseNow(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(d.getMinutes() / 10) * 10);
  return d;
}

/** A mock "recent detection" clock time — `minutesAgo` (+ optional `secondsAgo`) before a coarse,
 * hydration-safe "now," formatted as Singapore-time "HH:MM:SS". Use this instead of a literal
 * hardcoded clock string for canned/seed detection data, so it always reads as plausibly recent
 * relative to the ACTUAL current time instead of silently drifting into the past — or even the
 * future — as real time passes. */
export function recentSgtClockTime(minutesAgo: number, secondsAgo: number = 0): string {
  const t = new Date(coarseNow().getTime() - minutesAgo * 60000 - secondsAgo * 1000);
  return sgtClockTime(t);
}
