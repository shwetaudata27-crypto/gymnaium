import { useEffect, useState, useRef } from 'react';
import { useGym } from '@/context/GymContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GymHeader } from '@/components/gym/GymHeader';
import { useToast } from '@/hooks/use-toast';
import {
  addBackupHistory,
  buildBackupRecord,
  downloadBackupJson,
  fetchLatestBackupFromDrive,
  getBackupHistory,
  readBackupFile,
  restoreBackupJson,
  scheduleDailyBackup,
  signInWithGoogle,
  uploadBackupToDrive,
  ENABLE_GOOGLE_DRIVE,
} from '@/services/backupService';
import { BackupHistoryEntry } from '@/types/backup';
import { RefreshCw, CloudDownload, CloudUpload, Download, Upload, Clock } from 'lucide-react';

const Settings = () => {
  const { syncNow, syncing, lastSyncAt } = useGym();
  const { toast } = useToast();
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [driveStatus, setDriveStatus] = useState<string>('Not signed in');
  const [driveFileUrl, setDriveFileUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadHistory = async () => {
    const history = await getBackupHistory();
    setBackupHistory(history);
  };

  useEffect(() => {
    loadHistory();
    scheduleDailyBackup().then((record) => {
      if (record) {
        loadHistory();
      }
    }).catch(console.warn);
  }, []);

  const handleManualSync = async () => {
    setIsProcessing(true);
    try {
      await syncNow();
      toast({ title: 'Sync complete', description: 'Offline changes and server updates are now synchronized.' });
    } catch (error) {
      toast({ title: 'Sync failed', description: error instanceof Error ? error.message : 'Unable to sync now.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackup = async () => {
    setIsProcessing(true);
    try {
      const record = await buildBackupRecord();
      await downloadBackupJson(record);
      await addBackupHistory({
        id: `manual-${Date.now()}`,
        type: 'manual',
        source: 'local',
        timestamp: record.timestamp,
        description: 'Manual local backup',
      });
      await loadHistory();
      toast({ title: 'Backup created', description: 'Local backup has been saved successfully.' });
    } catch (error) {
      toast({ title: 'Backup failed', description: error instanceof Error ? error.message : 'Unable to create backup.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const record = await readBackupFile(file);
      await restoreBackupJson(record);
      await loadHistory();
      toast({ title: 'Restore complete', description: 'Backup data has been restored locally.' });
    } catch (error) {
      toast({ title: 'Restore failed', description: error instanceof Error ? error.message : 'Could not restore backup.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    try {
      const authResult = await signInWithGoogle();
      setDriveStatus(`Signed in as ${authResult.email ?? authResult.displayName ?? 'Google user'}`);
      toast({ title: 'Google sign-in successful', description: 'You can now upload backups to Drive.' });
    } catch (error) {
      setDriveStatus('Drive sign-in failed');
      toast({ title: 'Google sign-in failed', description: error instanceof Error ? error.message : 'Cannot sign in to Google Drive.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadToDrive = async () => {
    setIsProcessing(true);
    try {
      const record = await buildBackupRecord();
      const authResult = await signInWithGoogle();
      const response = await uploadBackupToDrive(record, authResult.accessToken);
      const webViewLink = response.current.webViewLink || `https://drive.google.com/file/d/${response.current.id}/view`;
      setDriveFileUrl(webViewLink);
      setDriveStatus(`Uploaded backup to Drive (${response.current.name})`);
      await addBackupHistory({
        id: `drive-${Date.now()}`,
        type: 'manual',
        source: 'drive',
        timestamp: record.timestamp,
        description: `Uploaded backup to Drive: ${response.current.name}`,
      });
      await loadHistory();
      toast({ title: 'Drive backup uploaded', description: 'Your backup was uploaded to Google Drive.' });
    } catch (error) {
      toast({ title: 'Drive upload failed', description: error instanceof Error ? error.message : 'Unable to upload backup.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    setIsProcessing(true);
    try {
      const authResult = await signInWithGoogle();
      const record = await fetchLatestBackupFromDrive(authResult.accessToken);
      await restoreBackupJson(record);
      await loadHistory();
      toast({ title: 'Drive restore complete', description: 'Backup restored from Google Drive.' });
    } catch (error) {
      toast({ title: 'Drive restore failed', description: error instanceof Error ? error.message : 'Unable to restore from Drive.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <GymHeader />
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-4">Settings & Sync</h1>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Synchronization</CardTitle>
              <CardDescription>Keep local and server data aligned automatically or manually.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-xl border border-border p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">Last sync</p>
                <p className="font-semibold">{lastSyncAt ?? 'Never synced'}</p>
              </div>
              <Button variant="secondary" onClick={handleManualSync} disabled={syncing || isProcessing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {syncing || isProcessing ? 'Syncing...' : 'Sync Now'}
              </Button>
                {ENABLE_GOOGLE_DRIVE ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Google Drive status</p>
                    <p className="text-sm">{driveStatus}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleGoogleSignIn} disabled={isProcessing}>
                        Sign in to Google
                      </Button>
                      <Button variant="outline" onClick={handleUploadToDrive} disabled={isProcessing}>
                        <CloudUpload className="mr-2 h-4 w-4" /> Upload Backup to Drive
                      </Button>
                      <Button variant="outline" onClick={handleRestoreFromDrive} disabled={isProcessing}>
                        <CloudDownload className="mr-2 h-4 w-4" /> Restore from Drive
                      </Button>
                    </div>
                    {driveFileUrl && (
                      <p className="mt-3 text-sm text-foreground">
                        Drive backup available: <a href={driveFileUrl} target="_blank" rel="noreferrer" className="font-medium underline">Open latest backup</a>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Google Drive backup</p>
                    <p className="text-sm">Disabled in this build.</p>
                  </div>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore</CardTitle>
              <CardDescription>Export your local database and restore it at any time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="secondary" onClick={handleBackup} disabled={isProcessing}>
                <Download className="mr-2 h-4 w-4" /> Backup Database
              </Button>
              <Button variant="outline" onClick={handleRestoreClick} disabled={isProcessing}>
                <Upload className="mr-2 h-4 w-4" /> Restore Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                aria-label="Backup file upload"
                onChange={handleFileSelected}
              />
              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Automatic daily backup is enabled when the app is open.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-8" />

        <section className="grid gap-4">
          <h2 className="text-2xl font-semibold">Backup History</h2>
          {backupHistory.length > 0 ? (
            <div className="space-y-3">
              {backupHistory.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{entry.description}</p>
                        <p className="text-xs text-muted-foreground">{entry.source.toUpperCase()} • {entry.type}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="text-sm text-muted-foreground">No backup history found yet. Create a backup to see records here.</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
};

export default Settings;
