import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_algorithm: string, value: string) => (
    createHash('sha256').update(value).digest('hex')
  ),
  randomUUID,
}));

import {
  createStoredBackup,
  hasRemoteRevisionConflict,
  parseStoredBackup,
} from './backupEnvelope';

const isAllowedKey = (key: string) => key.startsWith('warung-');

describe('backup envelope', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('creates and validates a versioned SHA-256 backup manifest', async () => {
    const backup = await createStoredBackup({
      'warung-state-v2': JSON.stringify({ menus: [], inventory: [] }),
      'warung-reminders-v1': '[]',
    });

    expect(backup.version).toBe(2);
    expect(backup.checksumAlgorithm).toBe('sha256');
    expect(backup.payloadChecksum).toMatch(/^[a-f0-9]{64}$/);
    await expect(parseStoredBackup(JSON.stringify(backup), isAllowedKey)).resolves.toEqual(backup);
  });

  it('rejects a backup whose business data was modified after creation', async () => {
    const backup = await createStoredBackup({
      'warung-state-v2': JSON.stringify({ inventory: [{ id: 'beras', qty: 10 }] }),
    });
    const tampered = {
      ...backup,
      storage: {
        ...backup.storage,
        'warung-state-v2': JSON.stringify({ inventory: [{ id: 'beras', qty: 999 }] }),
      },
    };

    await expect(parseStoredBackup(JSON.stringify(tampered), isAllowedKey))
      .rejects.toThrow('Checksum backup Google Drive tidak cocok');
  });

  it('detects a Drive revision that this device has never observed', () => {
    expect(hasRemoteRevisionConflict('2026-09-02T10:00:00.000Z', null)).toBe(true);
    expect(hasRemoteRevisionConflict(
      '2026-09-02T10:00:00.000Z',
      '2026-09-02T10:00:00.000Z',
    )).toBe(false);
    expect(hasRemoteRevisionConflict(null, '2026-09-02T10:00:00.000Z')).toBe(false);
  });
});