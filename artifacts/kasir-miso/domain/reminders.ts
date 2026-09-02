export type Reminder = { id: string; title: string; date: string; time: string; completed: boolean };
export type ScheduledReminder = { notificationId: string; signature: string };
export type ScheduledReminderIndex = Record<string, ScheduledReminder>;

export function parseReminderTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function parseReminderDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) return null;
  return { year, month, day };
}

export function localDate(value = new Date()) {
  return [
    String(value.getFullYear()).padStart(4, '0'),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

export function reminderDateTime(date: string, time: string) {
  const parsedDate = parseReminderDate(date);
  const parsedTime = parseReminderTime(time);
  if (!parsedDate || !parsedTime) return null;
  return new Date(
    parsedDate.year,
    parsedDate.month - 1,
    parsedDate.day,
    parsedTime.hour,
    parsedTime.minute,
    0,
    0,
  );
}

export function reminderSignature(item: Reminder) {
  return `${item.title}\u0000${item.date}\u0000${item.time}`;
}

export function normalizeReminderList(value: unknown, now = new Date()) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Partial<Reminder>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const time = typeof item.time === 'string' ? item.time.trim() : '';
    if (!title || !parseReminderTime(time)) return [];
    let date = typeof item.date === 'string' && parseReminderDate(item.date)
      ? item.date.trim()
      : localDate(now);
    const todaySchedule = reminderDateTime(date, time);
    if (!item.date && todaySchedule && todaySchedule.getTime() <= now.getTime()) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = localDate(tomorrow);
    }
    if (!parseReminderDate(date)) return [];
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : `${Date.now()}-${Math.random()}`,
      title,
      date,
      time,
      completed: item.completed === true,
    }];
  });
}

export function sortRemindersBySchedule(reminders: Reminder[]) {
  return [...reminders].sort((left, right) => {
    const leftTime = reminderDateTime(left.date, left.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightTime = reminderDateTime(right.date, right.time)?.getTime() ?? Number.POSITIVE_INFINITY;
    return leftTime - rightTime || left.id.localeCompare(right.id);
  });
}

export function readScheduledReminderIndex(raw: string | null): ScheduledReminderIndex {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([reminderId, value]) => {
        if (
          value
          && typeof value === 'object'
          && typeof (value as ScheduledReminder).notificationId === 'string'
          && typeof (value as ScheduledReminder).signature === 'string'
        ) {
          return [[reminderId, value as ScheduledReminder]];
        }
        return [];
      }),
    );
  } catch {
    return {};
  }
}

export function addReminderToList(
  reminders: Reminder[],
  input: { title: string; date: string; time: string },
  id: string,
) {
  const parsedDate = parseReminderDate(input.date);
  const parsedTime = parseReminderTime(input.time);
  if (!input.title.trim() || !parsedDate || !parsedTime) return reminders;
  return [...reminders, {
    id,
    title: input.title.trim(),
    date: input.date.trim(),
    time: input.time.trim(),
    completed: false,
  }];
}

export function toggleReminderInList(reminders: Reminder[], id: string) {
  return reminders.map((item) => item.id === id ? { ...item, completed: !item.completed } : item);
}

export function deleteReminderFromList(reminders: Reminder[], id: string) {
  return reminders.filter((item) => item.id !== id);
}