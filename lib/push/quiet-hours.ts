/**
 * Returns true if `now` falls within the user's quiet-hours window.
 *
 * Hours are 0-23 in the user's local `timezone`. A null on either bound
 * disables quiet hours. An overnight range (e.g. 22→7) is detected when
 * start > end and wraps midnight. The window is inclusive of `startHour`
 * and exclusive of `endHour`, so a 9→17 window blocks 09:00 but not 17:00.
 */
export function isWithinQuietHours(
  now: Date,
  startHour: number | null,
  endHour: number | null,
  timezone: string,
): boolean {
  if (startHour === null || endHour === null) return false
  if (startHour === endHour) return false

  const hourInTz = getHourInTimeZone(now, timezone)

  if (startHour < endHour) {
    return hourInTz >= startHour && hourInTz < endHour
  }
  return hourInTz >= startHour || hourInTz < endHour
}

function getHourInTimeZone(now: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
  return parseInt(formatter.format(now), 10)
}
