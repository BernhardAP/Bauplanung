import { createFileRoute, redirect } from '@tanstack/react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackupPanel } from '@/components/backup-panel';
import { StatusManagementPanel } from '@/components/status-management-panel';
import { UserManagementPanel } from '@/components/user-management-panel';
import { HelpButton } from '@/components/help-button';
import { useIsAdmin } from '@/lib/use-current-user';
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [{ title: 'Einstellungen' }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: '/' });
  }, [isAdmin, loading, navigate]);
  if (loading) return null;
  if (!isAdmin) return null;

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-4">
      <h1 className="text-xl font-semibold">Einstellungen</h1>
      <Tabs defaultValue="users">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="users">Nutzer</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4">
          <UserManagementPanel />
        </TabsContent>
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
