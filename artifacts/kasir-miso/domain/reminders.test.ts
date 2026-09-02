import { describe, expect, it } from 'vitest';
import {
  addReminderToList,
  deleteReminderFromList,
  localDate,
  normalizeReminderList,
  parseReminderTime,
  parseReminderDate,
  readScheduledReminderIndex,
  sortRemindersBySchedule,
  reminderSignature,
  toggleReminderInList,
} from './reminders';

describe('reminder state and scheduling metadata', () => {
  it('creates, completes, and deletes a reminder', () => {
    const created = addReminderToList([], { title: '  Cek stok  ', date: '2026-09-03', time: '09:15' }, 'reminder-1');
    expect(created).toEqual([{
      id: 'reminder-1',
      title: 'Cek stok',
      date: '2026-09-03',
      time: '09:15',
      completed: false,
    }]);

    const completed = toggleReminderInList(created, 'reminder-1');
    expect(completed[0].completed).toBe(true);
    expect(deleteReminderFromList(completed, 'reminder-1')).toEqual([]);
  });

  it('rejects invalid daily times and accepts the full valid range', () => {
    expect(parseReminderTime('00:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseReminderTime('24:00')).toBeNull();
    expect(parseReminderTime('12:60')).toBeNull();
  });

  it('validates calendar dates and sorts upcoming reminders chronologically', () => {
    expect(parseReminderDate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 });
    expect(parseReminderDate('2026-02-30')).toBeNull();
    expect(sortRemindersBySchedule([
      { id: 'later', title: 'L', date: '2026-09-04', time: '08:00', completed: false },
      { id: 'first', title: 'F', date: '2026-09-03', time: '12:00', completed: false },
      { id: 'second', title: 'S', date: '2026-09-03', time: '08:00', completed: false },
    ]).map((item) => item.id)).toEqual(['second', 'first', 'later']);
    expect(localDate(new Date(2026, 8, 2))).toBe('2026-09-02');
  });

  it('moves legacy daily reminders to their next valid date', () => {
    const now = new Date(2026, 8, 2, 19, 0);
    expect(normalizeReminderList([
      { id: 'morning', title: 'Pagi', time: '08:00', completed: false },
      { id: 'night', title: 'Malam', time: '20:00', completed: false },
    ], now).map((item) => [item.id, item.date])).toEqual([
      ['morning', '2026-09-03'],
      ['night', '2026-09-02'],
    ]);
  });

  it('keeps only valid persisted notification identifiers', () => {
    const index = readScheduledReminderIndex(JSON.stringify({
      valid: { notificationId: 'notification-1', signature: 'sig' },
      invalid: { notificationId: 7, signature: 'sig' },
    }));
    expect(index).toEqual({
      valid: { notificationId: 'notification-1', signature: 'sig' },
    });
    expect(reminderSignature({
      id: 'valid',
      title: 'Cek stok',
      date: '2026-09-02',
      time: '08:00',
      completed: false,
    })).toBe('Cek stok\u00002026-09-02\u000008:00');
  });
});