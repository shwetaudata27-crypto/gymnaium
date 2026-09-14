import { Client, Payment, Plan, SyncOperation } from '@/types/gym';

export interface BackupHistoryEntry {
  id: string;
  type: 'manual' | 'restore' | 'daily';
  source: 'local' | 'drive';
  timestamp: string;
  description: string;
}

export interface BackupRecord {
  timestamp: string;
  clients: Client[];
  payments: Payment[];
  plans: Plan[];
  syncQueue: SyncOperation[];
}

export interface GoogleDriveAuthResult {
  accessToken: string;
  idToken?: string;
  email?: string;
  displayName?: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  webViewLink?: string;
}
