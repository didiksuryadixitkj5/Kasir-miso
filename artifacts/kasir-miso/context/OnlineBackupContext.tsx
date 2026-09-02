import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@workspace/api-client-react';
import { GOOGLE_SESSION_TOKEN_KEY, useGoogleAccount } from '@/context/GoogleAccountContext';
import { useWarung } from '@/context/WarungContext';
import {
  createStoredBackup,
  hasRemoteRevisionConflict,
  parseStoredBackup,
  type StoredBackup,
} from '@/utils/backupEnvelope';

const LAST_BACKUP_KEY = 'warung-online-backup-last-v1';
const RECOVERY_SNAPSHOT_KEY = 'warung-online-restore-recovery-v1';
const RECOVERY_JOURNAL_KEY = 'warung-online-restore-journal-v1';
const REMOTE_REVISION_KEY = 'warung-online-backup-remote-revision-v1';
const EXCLUDED_BACKUP_KEYS = new Set([
  'warung-google-connection-v1',
  'warung-google-account-email-v1',
  GOOGLE_SESSION_TOKEN_KEY,
  'warung-offline-backup-v1',
  LAST_BACKUP_KEY,
  RECOVERY_SNAPSHOT_KEY,
  RECOVERY_JOURNAL_KEY,
  REMOTE_REVISION_KEY,
]);

type BackupStatus = 'idle' | 'backing-up' | 'restoring' | 'success' | 'error';

type OnlineBackupContextValue = {
  status: BackupStatus;
  lastBackupAt: string;
  error: string;
  backupNow: () => Promise<string>;
  restoreLatest: () => Promise<string>;
};

type RemoteRevision = {
  modifiedTime: string;
  backupId: string;
  createdAt: string;
  payloadChecksum: string | null;
};

const OnlineBackupContext = createContext<OnlineBackupContextValue | null>(null);

const isBackupDataKey = (key: string) => key.startsWith('warung-') && !EXCLUDED_BACKUP_KEYS.has(key);

async function collectBackup(): Promise<StoredBackup> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isBackupDataKey);
  const entries = await AsyncStorage.multiGet(keys);
  return createStoredBackup(
    Object.fromEntries(
      entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  );
}

function readRemoteRevision(raw: string | null): RemoteRevision | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RemoteRevision>;
    if (!parsed.modifiedTime || !parsed.backupId || !parsed.createdAt) return null;
    return {
      modifiedTime: parsed.modifiedTime,
      backupId: parsed.backupId,
      createdAt: parsed.createdAt,
      payloadChecksum: typeof parsed.payloadChecksum === 'string' ? parsed.payloadChecksum : null,
    };
  } catch {
    return null;
  }
}

async function saveRemoteRevision(backup: StoredBackup, modifiedTime: string) {
  const revision: RemoteRevision = {
    modifiedTime,
    backupId: backup.backupId,
    createdAt: backup.createdAt,
    payloadChecksum: backup.payloadChecksum ?? null,
  };
  await AsyncStorage.setItem(REMOTE_REVISION_KEY, JSON.stringify(revision));
}

export function OnlineBackupProvider({ children }: { children: React.ReactNode }) {
  const { hasDriveAccess, uploadDriveBackup, downloadDriveBackup } = useGoogleAccount();
  const warung = useWarung();
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [lastBackupAt, setLastBackupAt] = useState('');
  const [error, setError] = useState('');
  const backupInFlight = useRef(false);
  const backupQueued = useRef(false);
  const automaticBackupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupBaseline = useRef<string | null>(null);

  const businessStateSignature = useMemo(() => JSON.stringify({
    menus: warung.menus,
    activeOrders: warung.activeOrders,
    kitchenOrders: warung.kitchenOrders,
    inventory: warung.inventory,
    consignments: warung.consignments,
    expenses: warung.expenses,
    sales: warung.sales,
    savingsRules: warung.savingsRules,
    savingsEntries: warung.savingsEntries,
    qrisImageUri: warung.qrisImageUri,
  }), [
    warung.activeOrders,
    warung.consignments,
    warung.expenses,
    warung.inventory,
    warung.kitchenOrders,
    warung.menus,
    warung.qrisImageUri,
    warung.sales,
    warung.savingsEntries,
    warung.savingsRules,
  ]);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_BACKUP_KEY).then((saved) => setLastBackupAt(saved ?? ''));
  }, []);

  const runBackup = useCallback(async () => {
    if (!hasDriveAccess) throw new Error('Hubungkan akun Google Drive terlebih dahulu.');
    if (backupInFlight.current) {
      backupQueued.current = true;
      return '';
    }

    backupInFlight.current = true;
    setStatus('backing-up');
    setError('');
    try {
      const knownRevision = readRemoteRevision(await AsyncStorage.getItem(REMOTE_REVISION_KEY));
      let remote: Awaited<ReturnType<typeof downloadDriveBackup>> | null = null;
      try {
        remote = await downloadDriveBackup();
      } catch (reason) {
        if (!(reason instanceof ApiError && reason.status === 404)) throw reason;
      }
      if (hasRemoteRevisionConflict(remote?.modifiedTime ?? null, knownRevision?.modifiedTime ?? null)) {
        throw new Error(
          'Backup Google Drive lebih baru ditemukan dari perangkat lain. Pulihkan backup terbaru sebelum membuat perubahan baru.',
        );
      }
      const backup = await collectBackup();
      const uploaded = await uploadDriveBackup(JSON.stringify(backup), remote?.modifiedTime ?? null);
      await saveRemoteRevision(backup, uploaded.modifiedTime);
      await AsyncStorage.setItem(LAST_BACKUP_KEY, backup.createdAt);
      setLastBackupAt(backup.createdAt);
      setStatus('success');
      return backup.createdAt;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Backup Google Drive belum berhasil.';
      setError(message);
      setStatus('error');
      throw reason;
    } finally {
      backupInFlight.current = false;
      if (backupQueued.current) {
        backupQueued.current = false;
        setTimeout(() => void runBackup().catch(() => undefined), 500);
      }
    }
  }, [downloadDriveBackup, hasDriveAccess, uploadDriveBackup]);

  useEffect(() => {
    if (!hasDriveAccess || !warung.hydrated) {
      backupBaseline.current = null;
      if (automaticBackupTimer.current) clearTimeout(automaticBackupTimer.current);
      automaticBackupTimer.current = null;
      return;
    }

    // Hydration and a newly connected account establish a baseline only. They
    // must never be interpreted as a user change that needs uploading.
    if (backupBaseline.current === null) {
      backupBaseline.current = businessStateSignature;
      return;
    }
    if (backupBaseline.current === businessStateSignature) return;

    backupBaseline.current = businessStateSignature;
    if (automaticBackupTimer.current) clearTimeout(automaticBackupTimer.current);
    automaticBackupTimer.current = setTimeout(() => {
      automaticBackupTimer.current = null;
      void runBackup().catch(() => undefined);
    }, 2500);

    return () => {
      if (automaticBackupTimer.current) clearTimeout(automaticBackupTimer.current);
      automaticBackupTimer.current = null;
    };
  }, [businessStateSignature, hasDriveAccess, runBackup, warung.hydrated]);

  const restoreLatest = useCallback(async () => {
    if (!hasDriveAccess) throw new Error('Hubungkan akun Google Drive terlebih dahulu.');
    setStatus('restoring');
    setError('');
    try {
      const downloaded = await downloadDriveBackup();
      const backup = await parseStoredBackup(downloaded.content, isBackupDataKey);
      const currentKeys = (await AsyncStorage.getAllKeys()).filter(isBackupDataKey);
      const originalEntries = await AsyncStorage.multiGet(currentKeys);
      const originalLastBackupAt = await AsyncStorage.getItem(LAST_BACKUP_KEY);
      const entries = Object.entries(backup.storage);
      const replacementKeys = new Set(entries.map(([key]) => key));
      const staleKeys = currentKeys.filter((key) => !replacementKeys.has(key));
      const recoveryCreatedAt = new Date().toISOString();

      // Keep an excluded, local copy before touching live data. It is retained
      // as a recovery journal even after a successful restore.
      await AsyncStorage.setItem(RECOVERY_SNAPSHOT_KEY, JSON.stringify({
        createdAt: recoveryCreatedAt,
        storage: Object.fromEntries(originalEntries.filter(([, value]) => typeof value === 'string')),
        lastBackupAt: originalLastBackupAt,
      }));
      await AsyncStorage.setItem(RECOVERY_JOURNAL_KEY, JSON.stringify({
        createdAt: recoveryCreatedAt,
        sourceBackupAt: backup.createdAt,
        status: 'restore-started',
      }));

      let replacementStarted = false;
      try {
        // Preserve existing data until every replacement value has been written.
        replacementStarted = true;
        await AsyncStorage.multiSet(entries);
        if (staleKeys.length) await AsyncStorage.multiRemove(staleKeys);
        await AsyncStorage.setItem(LAST_BACKUP_KEY, backup.createdAt || recoveryCreatedAt);
        if (downloaded.modifiedTime) await saveRemoteRevision(backup, downloaded.modifiedTime);
      } catch (restoreReason) {
        if (replacementStarted) {
          const affectedKeys = [...new Set([...currentKeys, ...replacementKeys])];
          let rollbackFailure: unknown;
          try {
            if (affectedKeys.length) await AsyncStorage.multiRemove(affectedKeys);
          } catch (reason) {
            rollbackFailure = reason;
          }
          try {
            const entriesToRestore = originalEntries.filter((entry): entry is [string, string] => typeof entry[1] === 'string');
            if (entriesToRestore.length) await AsyncStorage.multiSet(entriesToRestore);
          } catch (reason) {
            rollbackFailure = rollbackFailure ?? reason;
          }
          try {
            if (originalLastBackupAt === null) await AsyncStorage.removeItem(LAST_BACKUP_KEY);
            else await AsyncStorage.setItem(LAST_BACKUP_KEY, originalLastBackupAt);
          } catch (reason) {
            rollbackFailure = rollbackFailure ?? reason;
          }
          if (rollbackFailure) {
            throw new Error('Pemulihan gagal dan rollback otomatis tidak lengkap. Salinan pemulihan lokal telah disimpan.');
          }
        }
        throw restoreReason;
      }

      setLastBackupAt(backup.createdAt || '');
      setStatus('success');
      return backup.createdAt || '';
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Pemulihan backup belum berhasil.';
      setError(message);
      setStatus('error');
      throw reason;
    }
  }, [downloadDriveBackup, hasDriveAccess]);

  const value = useMemo<OnlineBackupContextValue>(() => ({
    status,
    lastBackupAt,
    error,
    backupNow: runBackup,
    restoreLatest,
  }), [error, lastBackupAt, restoreLatest, runBackup, status]);

  return <OnlineBackupContext.Provider value={value}>{children}</OnlineBackupContext.Provider>;
}

export function useOnlineBackup() {
  const context = useContext(OnlineBackupContext);
  if (!context) throw new Error('useOnlineBackup harus dipakai di dalam OnlineBackupProvider');
  return context;
}