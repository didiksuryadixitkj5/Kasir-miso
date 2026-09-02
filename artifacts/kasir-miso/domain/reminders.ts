export type Reminder = { id: string; title: string; time: string; completed: boolean };
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

export function reminderSignature(item: Reminder) {
  return `${item.title}\u0000${item.time}`;
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
  input: { title: string; time: string },
  id: string,
) {
  const parsedTime = parseReminderTime(input.time);
  if (!input.title.trim() || !parsedTime) return reminders;
  return [...reminders, {
    id,
    title: input.title.trim(),
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