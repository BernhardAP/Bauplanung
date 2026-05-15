import { createFileRoute } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackupPanel } from '@/components/backup-panel';
import { StatusManagementPanel } from '@/components/status-management-panel';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Einstellungen' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-4">
      <h1 className="text-xl font-semibold">Einstellungen</h1>
      <Tabs defaultValue="status">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="status" className="mt-4">
          <StatusManagementPanel />
        </TabsContent>
        <TabsContent value="backup" className="mt-4">
          <BackupPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
