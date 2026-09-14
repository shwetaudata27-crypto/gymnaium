import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { localRepository } from '@/services/localRepository';
import { BackupRecord, BackupHistoryEntry, GoogleDriveAuthResult, DriveFileMetadata } from '@/types/backup';

// Feature flag to enable/disable Google Drive backup features at runtime
export const ENABLE_GOOGLE_DRIVE = false;

const GOOGLE_AUTH_MODULE_PATH = '@codetrix-studio/capacitor-google-auth';

async function importGoogleAuthModule() {
  return await import(/* @vite-ignore */ GOOGLE_AUTH_MODULE_PATH);
}

const BACKUP_HISTORY_KEY = 'usgym_backup_history';
const LAST_SYNC_KEY = 'usgym_last_sync';
const BACKUP_PREFIX = 'usgym_backup_';
const DRIVE_AUTH_KEY = 'usgym_drive_auth';
const DRIVE_FOLDER_NAME = 'USGymnasium';
const DRIVE_DB_FILENAME = 'us_gym_db.db';

function isNative() {
  return Capacitor.getPlatform() !== 'web';
}

function createFallbackKey(key: string) {
  return `${BACKUP_PREFIX}${key}`;
}

function getStoredDriveAuth(): GoogleDriveAuthResult | null {
  try {
    const raw = localStorage.getItem(DRIVE_AUTH_KEY);
    return raw ? JSON.parse(raw) as GoogleDriveAuthResult : null;
  } catch {
    return null;
  }
}

function setStoredDriveAuth(auth: GoogleDriveAuthResult) {
  try {
    localStorage.setItem(DRIVE_AUTH_KEY, JSON.stringify(auth));
  } catch {
    // no-op
  }
}

export function clearStoredDriveAuth() {
  try {
    localStorage.removeItem(DRIVE_AUTH_KEY);
  } catch {
    // no-op
  }
}

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(createFallbackKey(BACKUP_HISTORY_KEY));
    return raw ? JSON.parse(raw) as BackupHistoryEntry[] : [];
  } catch {
    return [];
  }
}

export async function addBackupHistory(entry: BackupHistoryEntry) {
  const history = await getBackupHistory();
  history.unshift(entry);
  localStorage.setItem(createFallbackKey(BACKUP_HISTORY_KEY), JSON.stringify(history.slice(0, 20)));
}

export async function getLastSyncTime(): Promise<string | null> {
  return localStorage.getItem(createFallbackKey(LAST_SYNC_KEY));
}

export async function setLastSyncTime(timestamp: string) {
  localStorage.setItem(createFallbackKey(LAST_SYNC_KEY), timestamp);
}

export async function buildBackupRecord(): Promise<BackupRecord> {
  return {
    timestamp: new Date().toISOString(),
    clients: await localRepository.getClients(),
    payments: await localRepository.getPayments(''),
    plans: await localRepository.getPlans(),
    syncQueue: await localRepository.getPendingSyncOperations(),
  };
}

export async function downloadBackupJson(record: BackupRecord) {
  const contents = JSON.stringify(record, null, 2);
  if (isNative()) {
    const fileName = `usgym-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await Filesystem.writeFile({ path: fileName, data: contents, directory: Directory.Documents, encoding: Encoding.UTF8 });
    return fileName;
  }

  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `usgym-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return link.download;
}

export async function restoreBackupJson(record: BackupRecord) {
  const now = new Date().toISOString();
  if (record.clients?.length) {
    for (const client of record.clients) {
      await localRepository.saveClient(client as any, { preserveUpdatedAt: true });
    }
  }
  if (record.payments?.length) {
    for (const payment of record.payments) {
      await localRepository.savePayment(payment as any, { preserveUpdatedAt: true });
    }
  }
  if (record.plans?.length) {
    for (const plan of record.plans) {
      await localRepository.savePlan(plan as any, { preserveUpdatedAt: true });
    }
  }
  if (record.syncQueue?.length) {
    for (const item of record.syncQueue) {
      await localRepository.addSyncOperation(item as any);
    }
  }
  await addBackupHistory({
    id: `restore-${Date.now()}`,
    type: 'restore',
    source: 'local',
    timestamp: now,
    description: `Restore from ${record.timestamp}`,
  });
}

export async function readBackupFile(file: File): Promise<BackupRecord> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        resolve(JSON.parse(text) as BackupRecord);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export async function signInWithGoogle() {
  if (!ENABLE_GOOGLE_DRIVE) {
    throw new Error('Google Drive integration is disabled in this build.');
  }

  try {
    const authModule = await importGoogleAuthModule();
    const user = await authModule.GoogleAuth.signIn();
    const accessToken = user?.authentication?.accessToken;
    if (!accessToken) {
      throw new Error('Google sign-in did not return an access token.');
    }
    const authResult: GoogleDriveAuthResult = {
      accessToken,
      idToken: user.authentication?.idToken,
      email: user.email,
      displayName: user.name,
    };
    setStoredDriveAuth(authResult);
    return authResult;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Google sign-in failed.');
  }
}

export async function getDriveAccessToken(): Promise<string | null> {
  if (!ENABLE_GOOGLE_DRIVE) {
    return null;
  }

  const auth = getStoredDriveAuth();
  return auth?.accessToken ?? null;
}

async function makeDriveQuery(accessToken: string, query: string, fields = 'files(id,name,mimeType,webViewLink,createdTime)') {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Drive query failed: ${response.status} ${message}`);
  }
  return response.json();
}

async function createDriveFolder(accessToken: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (!response.ok) {
    throw new Error('Unable to create Google Drive folder.');
  }
  const result = await response.json();
  return result.id as string;
}

async function findOrCreateDriveFolder(accessToken: string) {
  const query = `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const data = await makeDriveQuery(accessToken, query, 'files(id,name)');
  const folder = data.files?.[0];
  if (folder) {
    return folder.id;
  }
  return await createDriveFolder(accessToken);
}

async function findDriveFile(accessToken: string, folderId: string, name: string): Promise<DriveFileMetadata | null> {
  const query = `name = '${name}' and '${folderId}' in parents and trashed = false`;
  const data = await makeDriveQuery(accessToken, query, 'files(id,name,mimeType,webViewLink,createdTime)');
  return data.files?.[0] ?? null;
}

function buildMultipartBody(metadata: Record<string, any>, data: string) {
  const boundary = `USGYMBACKUP-${Date.now()}`;
  const bodyParts = [];
  bodyParts.push(`--${boundary}\r\n`);
  bodyParts.push(`Content-Type: application/json; charset=UTF-8\r\n\r\n`);
  bodyParts.push(JSON.stringify(metadata));
  bodyParts.push(`\r\n--${boundary}\r\n`);
  bodyParts.push(`Content-Type: ${metadata.mimeType}\r\n\r\n`);
  bodyParts.push(data);
  bodyParts.push(`\r\n--${boundary}--`);
  return { boundary, body: bodyParts.join('') };
}

async function uploadDriveFile(
  accessToken: string,
  folderId: string,
  name: string,
  contents: string,
  mimeType: string,
  fileId?: string,
): Promise<DriveFileMetadata> {
  const metadata: Record<string, any> = { name, mimeType, parents: [folderId] };
  const { boundary, body } = buildMultipartBody(metadata, contents);
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime`;
  const response = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Google Drive upload failed: ${response.status} ${message}`);
  }
  return response.json();
}

export async function uploadBackupToDrive(record: BackupRecord, accessToken: string) {
  if (!ENABLE_GOOGLE_DRIVE) {
    throw new Error('Google Drive upload is disabled in this build.');
  }

  const folderId = await findOrCreateDriveFolder(accessToken);
  const contents = JSON.stringify(record, null, 2);
  const currentFile = await findDriveFile(accessToken, folderId, DRIVE_DB_FILENAME);
  const currentResult = await uploadDriveFile(
    accessToken,
    folderId,
    DRIVE_DB_FILENAME,
    contents,
    'application/json',
    currentFile?.id,
  );

  const dailyName = `us_gym_db-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const dailyResult = await uploadDriveFile(accessToken, folderId, dailyName, contents, 'application/json');

  return {
    current: currentResult,
    daily: dailyResult,
  };
}

export async function uploadDatabaseBackupToDriveIfSignedIn() {
  if (!ENABLE_GOOGLE_DRIVE) {
    return null;
  }
  const accessToken = await getDriveAccessToken();
  if (!accessToken) {
    return null;
  }
  const record = await buildBackupRecord();
  return uploadBackupToDrive(record, accessToken);
}

export async function fetchLatestBackupFromDrive(accessToken: string) {
  if (!ENABLE_GOOGLE_DRIVE) {
    throw new Error('Google Drive fetch is disabled in this build.');
  }

  const folderId = await findOrCreateDriveFolder(accessToken);
  const query = `'${folderId}' in parents and trashed = false and name contains 'us_gym_db'`;
  const data = await makeDriveQuery(accessToken, query, 'files(id,name,mimeType,webViewLink,createdTime)');
  const file = data.files?.[0];
  if (!file) {
    throw new Error('No backup found on Google Drive');
  }

  const download = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!download.ok) {
    const message = await download.text();
    throw new Error(`Failed to download Google Drive backup: ${download.status} ${message}`);
  }

  const text = await download.text();
  return JSON.parse(text) as BackupRecord;
}

export async function scheduleDailyBackup() {
  const last = localStorage.getItem(createFallbackKey('daily_backup_timestamp')) || '';
  const now = new Date();
  const lastDate = last ? new Date(last) : null;
  if (!lastDate || now.getUTCDate() !== lastDate.getUTCDate() || now.getUTCMonth() !== lastDate.getUTCMonth() || now.getUTCFullYear() !== lastDate.getUTCFullYear()) {
    const record = await buildBackupRecord();
    await addBackupHistory({
      id: `daily-${Date.now()}`,
      type: 'daily',
      source: 'local',
      timestamp: record.timestamp,
      description: 'Automatic daily backup',
    });
    localStorage.setItem(createFallbackKey('daily_backup_timestamp'), now.toISOString());
    return record;
  }
  return null;
}
