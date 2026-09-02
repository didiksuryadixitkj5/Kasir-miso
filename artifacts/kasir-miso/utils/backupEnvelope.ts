import * as Crypto from 'expo-crypto';

export type StoredBackup = {
  format: 'kasir-miso-online-backup';
  version: 1 | 2;
  backupId: string;
  createdAt: string;
  checksumAlgorithm?: 'sha256';
  payloadChecksum?: string;
  storage: Record<string, string>;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

function canonicalStorage(storage: Record<string, string>) {
  return JSON.stringify(Object.fromEntries(
    Object.entries(storage).sort(([left], [right]) => left.localeCompare(right)),
  ));
}

async function checksumPayload(backupId: string, createdAt: string, storage: Record<string, string>) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify({ backupId, createdAt, storage: canonicalStorage(storage) }),
  );
}

export async function createStoredBackup(storage: Record<string, string>): Promise<StoredBackup> {
  const backupId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    format: 'kasir-miso-online-backup',
    version: 2,
    backupId,
    createdAt,
    checksumAlgorithm: 'sha256',
    payloadChecksum: await checksumPayload(backupId, createdAt, storage),
    storage,
  };
}

export async function parseStoredBackup(
  raw: string,
  isAllowedKey: (key: string) => boolean,
): Promise<StoredBackup> {
  let backup: unknown;
  try {
    backup = JSON.parse(raw);
  } catch {
    throw new Error('Format backup Google Drive tidak dikenali.');
  }

  if (!isObjectRecord(backup)
    || backup.format !== 'kasir-miso-online-backup'
    || (backup.version !== 1 && backup.version !== 2)
    || !isObjectRecord(backup.storage)) {
    throw new Error('Format backup Google Drive tidak dikenali.');
  }

  const storage = backup.storage;
  const state = storage['warung-state-v2'];
  if (typeof state !== 'string') {
    throw new Error('Backup Google Drive tidak memuat data warung yang valid.');
  }
  try {
    if (!isObjectRecord(JSON.parse(state))) throw new Error();
  } catch {
    throw new Error('Data warung di backup Google Drive tidak valid.');
  }
  for (const [key, value] of Object.entries(storage)) {
    if (!isAllowedKey(key) || typeof value !== 'string') {
      throw new Error('Isi backup Google Drive tidak valid.');
    }
  }

  const createdAt = typeof backup.createdAt === 'string' ? backup.createdAt : '';
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Waktu pembuatan backup Google Drive tidak valid.');
  }
  const normalizedStorage = storage as Record<string, string>;
  if (backup.version === 2) {
    if (typeof backup.backupId !== 'string'
      || backup.backupId.length < 16
      || backup.checksumAlgorithm !== 'sha256'
      || typeof backup.payloadChecksum !== 'string') {
      throw new Error('Manifest backup Google Drive tidak valid.');
    }
    const expectedChecksum = await checksumPayload(backup.backupId, createdAt, normalizedStorage);
    if (expectedChecksum !== backup.payloadChecksum) {
      throw new Error('Checksum backup Google Drive tidak cocok. Data tidak dipulihkan.');
    }
    return {
      format: 'kasir-miso-online-backup',
      version: 2,
      backupId: backup.backupId,
      createdAt,
      checksumAlgorithm: 'sha256',
      payloadChecksum: backup.payloadChecksum,
      storage: normalizedStorage,
    };
  }

  return {
    format: 'kasir-miso-online-backup',
    version: 1,
    backupId: `legacy-${createdAt}`,
    createdAt,
    storage: normalizedStorage,
  };
}

export function hasRemoteRevisionConflict(
  remoteModifiedTime: string | null,
  knownModifiedTime: string | null,
) {
  return Boolean(remoteModifiedTime && remoteModifiedTime !== knownModifiedTime);
}