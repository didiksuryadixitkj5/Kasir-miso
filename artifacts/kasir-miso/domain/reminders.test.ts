import { describe, expect, it } from 'vitest';
import {
  addReminderToList,
  deleteReminderFromList,
  parseReminderTime,
  readScheduledReminderIndex,
  reminderSignature,
  toggleReminderInList,
} from './reminders';

describe('reminder state and scheduling metadata', () => {
  it('creates, completes, and deletes a reminder', () => {
    const created = addReminderToList([], { title: '  Cek stok  ', time: '09:15' }, 'reminder-1');
    expect(created).toEqual([{
      id: 'reminder-1',
      title: 'Cek stok',
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
      time: '08:00',
      completed: false,
    })).toBe('Cek stok\u000008:00');
  });
});