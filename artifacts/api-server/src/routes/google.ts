import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import {
  ConnectGoogleAccountBody,
  ConnectGoogleAccountResponse,
  DisconnectGoogleAccountResponse,
  DownloadGoogleDriveBackupResponse,
  GetGoogleConnectionResponse,
  UploadGoogleDriveBackupBody,
  UploadGoogleDriveBackupResponse,
} from "@workspace/api-zod";
import { db, googleDriveConnectionsTable, type GoogleDriveConnection } from "@workspace/db";
import {
  createSessionToken,
  deleteConnection,
  deleteConnectionsForGoogleSubject,
  downloadBackup,
  encryptGoogleRefreshToken,
  exchangeGoogleCode,
  GoogleAuthorizationError,
  GoogleConfigurationError,
  GoogleDriveConflictError,
  GoogleDriveNotFoundError,
  hashSessionToken,
  hashDeviceId,
  uploadBackup,
} from "../lib/google-drive";

const router: IRouter = Router();
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_USED_WRITE_INTERVAL_MS = 15 * 60 * 1000;
const backupUploadQueues = new Map<string, Promise<void>>();

async function serializeBackupUpload<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = backupUploadQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  backupUploadQueues.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (backupUploadQueues.get(key) === queued) backupUploadQueues.delete(key);
  }
}

function getBearerToken(req: Request): string | null {
  const value = req.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

async function getConnection(req: Request): Promise<{ connection: GoogleDriveConnection; token: string } | null> {
  const token = getBearerToken(req);
  const deviceId = req.get("x-device-id")?.trim();
  if (!token || !deviceId) return null;
  const [connection] = await db
    .select()
    .from(googleDriveConnectionsTable)
    .where(eq(googleDriveConnectionsTable.sessionTokenHash, hashSessionToken(token)))
    .limit(1);
  if (!connection) return null;
  if (!connection.deviceIdHash || connection.deviceIdHash !== hashDeviceId(deviceId)) return null;
  if (!connection.sessionExpiresAt
    || connection.sessionExpiresAt.getTime() <= Date.now()
    || connection.lastUsedAt.getTime() + SESSION_IDLE_TIMEOUT_MS <= Date.now()) {
    await deleteConnection(connection);
    return null;
  }
  if (connection.lastUsedAt.getTime() + LAST_USED_WRITE_INTERVAL_MS <= Date.now()) {
    const now = new Date();
    await db
      .update(googleDriveConnectionsTable)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(googleDriveConnectionsTable.id, connection.id));
    connection.lastUsedAt = now;
  }
  return { connection, token };
}

function sendUnauthorized(res: Parameters<Parameters<typeof router.get>[1]>[1]): void {
  res.status(401).json({ error: "Koneksi Google Drive berakhir. Hubungkan ulang akun Google." });
}

function sendGoogleError(
  req: Request,
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  error: unknown,
): void {
  if (error instanceof GoogleAuthorizationError) {
    req.log.warn({ code: error.code }, "Google authorization is no longer valid");
    res.status(401).json({ error: error.message });
    return;
  }
  if (error instanceof GoogleDriveNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof GoogleDriveConflictError) {
    res.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof GoogleConfigurationError) {
    req.log.error({ code: error.code }, "Google Drive server configuration is incomplete");
    res.status(500).json({ error: "Backup Google Drive belum dikonfigurasi di server." });
    return;
  }
  req.log.error({ err: error }, "Google Drive request failed");
  res.status(502).json({ error: "Google Drive belum dapat dihubungi. Coba lagi nanti." });
}

router.get("/google/connection", async (req, res): Promise<void> => {
  const authenticated = await getConnection(req);
  if (!authenticated) {
    sendUnauthorized(res);
    return;
  }
  res.json(GetGoogleConnectionResponse.parse({
    sessionToken: authenticated.token,
    email: authenticated.connection.email,
  }));
});

router.post("/google/connection", async (req, res): Promise<void> => {
  const parsed = ConnectGoogleAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const current = await getConnection(req);
    const exchanged = await exchangeGoogleCode(parsed.data);
    const refreshToken = exchanged.refreshToken
      ? encryptGoogleRefreshToken(exchanged.refreshToken)
      : current?.connection.googleSubject === exchanged.googleSubject
        ? current.connection.encryptedRefreshToken
        : undefined;

    if (!refreshToken) {
      res.status(400).json({
        error: "Google tidak memberikan izin refresh. Hubungkan ulang dan setujui izin Drive.",
      });
      return;
    }

    const sessionToken = createSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
    if (current) await deleteConnection(current.connection);
    await deleteConnectionsForGoogleSubject(exchanged.googleSubject);
    await db.insert(googleDriveConnectionsTable).values({
      sessionTokenHash,
      deviceIdHash: hashDeviceId(parsed.data.deviceId),
      sessionExpiresAt: expiresAt,
      lastUsedAt: now,
      googleSubject: exchanged.googleSubject,
      email: exchanged.email,
      googleClientId: parsed.data.clientId,
      encryptedRefreshToken: refreshToken,
    });

    res.json(ConnectGoogleAccountResponse.parse({
      sessionToken,
      email: exchanged.email,
      expiresAt: expiresAt.toISOString(),
    }));
  } catch (error) {
    sendGoogleError(req, res, error);
  }
});

router.delete("/google/connection", async (req, res): Promise<void> => {
  const authenticated = await getConnection(req);
  if (!authenticated) {
    sendUnauthorized(res);
    return;
  }
  await deleteConnectionsForGoogleSubject(authenticated.connection.googleSubject);
  res.status(204).send(DisconnectGoogleAccountResponse.parse(undefined));
});

router.get("/google/drive/backup", async (req, res): Promise<void> => {
  const authenticated = await getConnection(req);
  if (!authenticated) {
    sendUnauthorized(res);
    return;
  }
  try {
    const backup = await downloadBackup(authenticated.connection);
    res.json(DownloadGoogleDriveBackupResponse.parse(backup));
  } catch (error) {
    sendGoogleError(req, res, error);
  }
});

router.post("/google/drive/backup", async (req, res): Promise<void> => {
  const authenticated = await getConnection(req);
  if (!authenticated) {
    sendUnauthorized(res);
    return;
  }
  const parsed = UploadGoogleDriveBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const uploaded = await serializeBackupUpload(
      authenticated.connection.googleSubject,
      () => uploadBackup(
        authenticated.connection,
        parsed.data.content,
        parsed.data.expectedModifiedTime,
      ),
    );
    res.json(UploadGoogleDriveBackupResponse.parse({
      savedAt: new Date().toISOString(),
      modifiedTime: uploaded.modifiedTime,
    }));
  } catch (error) {
    sendGoogleError(req, res, error);
  }
});

export default router;