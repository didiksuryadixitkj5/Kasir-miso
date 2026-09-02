import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, googleDriveConnectionsTable, type GoogleDriveConnection } from "@workspace/db";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_DRIVE_ENDPOINT = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3";
export const DRIVE_BACKUP_FILENAME = "Kasir Miso Backup.json";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
};

type DriveFile = {
  id: string;
  modifiedTime?: string;
};

type DriveFileList = { files?: DriveFile[] };
type DriveFileMetadata = { id?: string };

export class GoogleAuthorizationError extends Error {
  readonly code = "GOOGLE_AUTHORIZATION_ERROR";
}

export class GoogleDriveNotFoundError extends Error {
  readonly code = "GOOGLE_DRIVE_NOT_FOUND";
}

export class GoogleConfigurationError extends Error {
  readonly code = "GOOGLE_CONFIGURATION_ERROR";
}

const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new GoogleConfigurationError("SESSION_SECRET must be configured.");
  }
  return createHash("sha256").update(secret).digest();
}

function encryptRefreshToken(refreshToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptRefreshToken(value: string): string {
  const [ivValue, tagValue, ciphertextValue] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new GoogleConfigurationError("Stored Google credentials are invalid.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new GoogleConfigurationError("Stored Google credentials cannot be decrypted.");
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function getConfiguredClientIds(): Set<string> {
  const configured = [
    process.env.GOOGLE_OAUTH_CLIENT_IDS,
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  ]
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(configured);
}

function assertConfiguredClientId(clientId: string): void {
  const allowedClientIds = getConfiguredClientIds();
  if (!allowedClientIds.size) {
    throw new GoogleConfigurationError(
      "Configure GOOGLE_OAUTH_CLIENT_IDS with the Google OAuth client IDs used by the app.",
    );
  }
  if (!allowedClientIds.has(clientId)) {
    throw new GoogleAuthorizationError("The Google OAuth client is not configured for this app.");
  }
}

async function parseTokenResponse(response: Response): Promise<GoogleTokenResponse> {
  return (await response.json().catch(() => ({}))) as GoogleTokenResponse;
}

export async function exchangeGoogleCode(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<{ accessToken: string; refreshToken?: string; email: string; googleSubject: string }> {
  assertConfiguredClientId(input.clientId);

  const form = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const confidentialClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (clientSecret && input.clientId === confidentialClientId) {
    form.set("client_secret", clientSecret);
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const tokenData = await parseTokenResponse(tokenResponse);
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new GoogleAuthorizationError(
      tokenData.error === "invalid_grant"
        ? "Google authorization expired or was revoked."
        : "Google authorization could not be completed.",
    );
  }

  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = (await profileResponse.json().catch(() => ({}))) as GoogleUserInfo;
  if (!profileResponse.ok || !profile.sub || !profile.email) {
    throw new GoogleAuthorizationError("Google did not return a valid account profile.");
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    email: profile.email,
    googleSubject: profile.sub,
  };
}

async function refreshAccessToken(connection: GoogleDriveConnection): Promise<string> {
  const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken);
  const form = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  form.set("client_id", connection.googleClientId);
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const confidentialClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (clientSecret && connection.googleClientId === confidentialClientId) {
    form.set("client_secret", clientSecret);
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const tokenData = await parseTokenResponse(response);
  if (!response.ok || !tokenData.access_token) {
    accessTokenCache.delete(connection.id);
    if (tokenData.error === "invalid_grant") {
      throw new GoogleAuthorizationError("Google Drive authorization expired or was revoked.");
    }
    throw new Error("Google Drive authorization could not be refreshed.");
  }

  accessTokenCache.set(connection.id, {
    token: tokenData.access_token,
    expiresAt: Date.now() + Math.max((tokenData.expires_in ?? 3600) - 60, 60) * 1000,
  });
  return tokenData.access_token;
}

async function getAccessToken(connection: GoogleDriveConnection): Promise<string> {
  const cached = accessTokenCache.get(connection.id);
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  return refreshAccessToken(connection);
}

async function driveFetch(
  connection: GoogleDriveConnection,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  let token = await getAccessToken(connection);
  let response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });

  if (response.status === 401) {
    accessTokenCache.delete(connection.id);
    token = await refreshAccessToken(connection);
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
  }

  if (response.status === 401) {
    throw new GoogleAuthorizationError("Google Drive authorization expired or was revoked.");
  }
  return response;
}

async function parseDriveError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return payload.error?.message ?? "Google Drive returned an error.";
}

export async function findBackupFile(connection: GoogleDriveConnection): Promise<DriveFile | null> {
  const query = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}' and trashed=false`);
  const response = await driveFetch(
    connection,
    `${GOOGLE_DRIVE_ENDPOINT}/files?q=${query}&spaces=drive&orderBy=modifiedTime%20desc&pageSize=1&fields=files(id,modifiedTime)`,
  );
  if (!response.ok) throw new Error(await parseDriveError(response));
  const result = (await response.json()) as DriveFileList;
  return result.files?.[0] ?? null;
}

export async function uploadBackup(connection: GoogleDriveConnection, content: string): Promise<void> {
  const existing = await findBackupFile(connection);
  let fileId = existing?.id;

  if (!fileId) {
    const metadataResponse = await driveFetch(
      connection,
      `${GOOGLE_DRIVE_ENDPOINT}/files?fields=id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: DRIVE_BACKUP_FILENAME, mimeType: "application/json" }),
      },
    );
    if (!metadataResponse.ok) throw new Error(await parseDriveError(metadataResponse));
    const metadata = (await metadataResponse.json()) as DriveFileMetadata;
    fileId = metadata.id;
  }

  if (!fileId) throw new Error("Google Drive did not return a backup file ID.");

  const uploadResponse = await driveFetch(
    connection,
    `${GOOGLE_DRIVE_UPLOAD_ENDPOINT}/files/${encodeURIComponent(fileId)}?uploadType=media`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json;charset=utf-8" },
      body: content,
    },
  );
  if (!uploadResponse.ok) throw new Error(await parseDriveError(uploadResponse));
}

export async function downloadBackup(
  connection: GoogleDriveConnection,
): Promise<{ content: string; modifiedTime: string | null }> {
  const existing = await findBackupFile(connection);
  if (!existing) throw new GoogleDriveNotFoundError("Belum ada backup Kasir Miso di Google Drive.");

  const response = await driveFetch(
    connection,
    `${GOOGLE_DRIVE_ENDPOINT}/files/${encodeURIComponent(existing.id)}?alt=media`,
  );
  if (!response.ok) throw new Error(await parseDriveError(response));
  return { content: await response.text(), modifiedTime: existing.modifiedTime ?? null };
}

export async function deleteConnection(connection: GoogleDriveConnection): Promise<void> {
  accessTokenCache.delete(connection.id);
  await db
    .delete(googleDriveConnectionsTable)
    .where(eq(googleDriveConnectionsTable.id, connection.id));
}

export function encryptGoogleRefreshToken(refreshToken: string): string {
  return encryptRefreshToken(refreshToken);
}