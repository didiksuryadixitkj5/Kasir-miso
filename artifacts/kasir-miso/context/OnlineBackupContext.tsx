import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { GOOGLE_SESSION_TOKEN_KEY, useGoogleAccount } from '@/context/GoogleAccountContext';
import { useWarung } from '@/context/WarungContext';

const LAST_BACKUP_KEY = 'warung-online-backup-last-v1';
const EXCLUDED_BACKUP_KEYS = new Set([
  'warung-google-connection-v1',
  'warung-google-account-email-v1',
  GOOGLE_SESSION_TOKEN_KEY,
  'warung-offline-backup-v1',
  LAST_BACKUP_KEY,
]);

type BackupStatus = 'idle' | 'backing-up' | 'restoring' | 'success' | 'error';

type OnlineBackupContextValue = {
  status: BackupStatus;
  lastBackupAt: string;
  error: string;
  backupNow: () => Promise<string>;
  restoreLatest: () => Promise<string>;
};

type StoredBackup = {
  format: 'kasir-miso-online-backup';
  version: 1;
  createdAt: string;
  storage: Record<string, string>;
};

const OnlineBackupContext = createContext<OnlineBackupContextValue | null>(null);

const isBackupDataKey = (key: string) => key.startsWith('warung-') && !EXCLUDED_BACKUP_KEYS.has(key);

async function collectBackup(): Promise<StoredBackup> {
  const keys = (await AsyncStorage.getAllKeys()).filter(isBackupDataKey);
  const entries = await AsyncStorage.multiGet(keys);
  return {
    format: 'kasir-miso-online-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    storage: Object.fromEntries(
      entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  };
}

export function OnlineBackupProvider({ children }: { children: React.ReactNode }) {
  const { hasDriveAccess, uploadDriveBackup, downloadDriveBackup } = useGoogleAccount();
  const warung = useWarung();
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [lastBackupAt, setLastBackupAt] = useState('');
  const [error, setError] = useState('');
  const backupInFlight = useRef(false);
  const backupQueued = useRef(false);

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
      const backup = await collectBackup();
      await uploadDriveBackup(JSON.stringify(backup));
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
  }, [hasDriveAccess, uploadDriveBackup]);

  useEffect(() => {
    if (!hasDriveAccess || !warung.hydrated) return;
    const timer = setTimeout(() => void runBackup().catch(() => undefined), 2500);
    return () => clearTimeout(timer);
  }, [hasDriveAccess, runBackup, warung]);

  useEffect(() => {
    if (!hasDriveAccess || !warung.hydrated) return;
    const interval = setInterval(() => void runBackup().catch(() => undefined), 120000);
    return () => clearInterval(interval);
  }, [hasDriveAccess, runBackup, warung.hydrated]);

  const restoreLatest = useCallback(async () => {
    if (!hasDriveAccess) throw new Error('Hubungkan akun Google Drive terlebih dahulu.');
    setStatus('restoring');
    setError('');
    try {
      const raw = await downloadDriveBackup();
      const backup = JSON.parse(raw) as Partial<StoredBackup>;
      if (
        backup.format !== 'kasir-miso-online-backup'
        || backup.version !== 1
        || !backup.storage
        || typeof backup.storage !== 'object'
      ) {
        throw new Error('Format backup Google Drive tidak dikenali.');
      }

      const currentKeys = (await AsyncStorage.getAllKeys()).filter(isBackupDataKey);
      const entries = Object.entries(backup.storage)
        .filter(([key, value]) => isBackupDataKey(key) && typeof value === 'string');
      if (currentKeys.length) await AsyncStorage.multiRemove(currentKeys);
      if (entries.length) await AsyncStorage.multiSet(entries);
      await AsyncStorage.setItem(LAST_BACKUP_KEY, backup.createdAt || new Date().toISOString());
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