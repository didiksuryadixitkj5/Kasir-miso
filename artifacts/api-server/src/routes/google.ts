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
  downloadBackup,
  encryptGoogleRefreshToken,
  exchangeGoogleCode,
  GoogleAuthorizationError,
  GoogleConfigurationError,
  GoogleDriveNotFoundError,
  hashSessionToken,
  uploadBackup,
} from "../lib/google-drive";

const router: IRouter = Router();

function getBearerToken(req: Request): string | null {
  const value = req.get("authorization");
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice("Bearer ".length).trim();
  return token || null;
}

async function getConnection(req: Request): Promise<{ connection: GoogleDriveConnection; token: string } | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const [connection] = await db
    .select()
    .from(googleDriveConnectionsTable)
    .where(eq(googleDriveConnectionsTable.sessionTokenHash, hashSessionToken(token)))
    .limit(1);
  return connection ? { connection, token } : null;
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
      : current?.connection.encryptedRefreshToken;

    if (!refreshToken) {
      res.status(400).json({
        error: "Google tidak memberikan izin refresh. Hubungkan ulang dan setujui izin Drive.",
      });
      return;
    }

    const sessionToken = current?.token ?? createSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    if (current) {
      await db
        .update(googleDriveConnectionsTable)
        .set({
          googleSubject: exchanged.googleSubject,
          email: exchanged.email,
          googleClientId: parsed.data.clientId,
          encryptedRefreshToken: refreshToken,
          updatedAt: new Date(),
        })
        .where(eq(googleDriveConnectionsTable.id, current.connection.id));
    } else {
      await db.insert(googleDriveConnectionsTable).values({
        sessionTokenHash,
        googleSubject: exchanged.googleSubject,
        email: exchanged.email,
        googleClientId: parsed.data.clientId,
        encryptedRefreshToken: refreshToken,
      });
    }

    res.json(ConnectGoogleAccountResponse.parse({
      sessionToken,
      email: exchanged.email,
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
  await deleteConnection(authenticated.connection);
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
    await uploadBackup(authenticated.connection, parsed.data.content);
    res.json(UploadGoogleDriveBackupResponse.parse({ savedAt: new Date().toISOString() }));
  } catch (error) {
    sendGoogleError(req, res, error);
  }
});

export default router;