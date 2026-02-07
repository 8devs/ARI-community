import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Users, ClipboardList, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ReceptionTaskLog {
  id: string;
  task_id: string;
  entry: string;
  created_by: string;
  created_at: string;
  creator?: { id: string; name: string | null } | null;
}

interface ReceptionTaskRow {
  id: string;
  title: string;
  details: string | null;
  direction: ReceptionTaskDirection;
  status: ReceptionTaskStatus;
  created_by: string;
  organization_id: string | null;
  assigned_reception_id: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  organization?: { name: string | null } | null;
  creator?: { id: string; name: string | null; organization_id?: string | null } | null;
  assigned_reception?: { id: string; name: string | null } | null;
  reception_task_logs?: ReceptionTaskLog[];
}

type ReceptionTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE';
type ReceptionTaskDirection = 'USER_NOTE' | 'ORG_TODO';

const STATUS_LABELS: Record<ReceptionTaskStatus, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Arbeit',
  DONE: 'Erledigt',
};

const DIRECTION_LABELS: Record<ReceptionTaskDirection, { label: string; badge: 'secondary' | 'outline' }> = {
  USER_NOTE: { label: 'Meldung an Empfang', badge: 'secondary' },
  ORG_TODO: { label: 'Aufgabe für Organisation', badge: 'outline' },
};

const STATUS_FLOW: ReceptionTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE'];
const NO_ORGANIZATION_VALUE = '__none__';

export default function ReceptionTasks() {
  const { profile } = useCurrentProfile();
  const canManageReception = Boolean(profile?.is_receptionist);
  const [tasks, setTasks] = useState<ReceptionTaskRow[]>([]);
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReceptionTaskStatus>('OPEN');
  const [reportForm, setReportForm] = useState({
    title: '',
    details: '',
  });
  const [orgTaskForm, setOrgTaskForm] = useState({
    title: '',
    details: '',
    organization_id: '',
    due_at: '',
  });
  const [logDrafts, setLogDrafts] = useState<Record<string, string>>({});
  const [savingReport, setSavingReport] = useState(false);
  const [savingOrgTask, setSavingOrgTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [addingLogId, setAddingLogId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    loadTasks();
    // only load organizations once for form dropdowns
    loadOrganizations();
  }, [profile?.id, canManageReception]);

  const loadOrganizations = async () => {
    setLoadingOrganizations(true);
    try {
      const result = await api.query<{ data: { id: string; name: string }[] }>('/api/organizations/simple');
      setOrganizations(result.data ?? []);
    } catch (err) {
      console.error('Error loading organizations', err);
      toast.error('Organisationen konnten nicht geladen werden');
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const result = await api.query<{ data: ReceptionTaskRow[] }>('/api/reception-tasks');
      setTasks(result.data ?? []);
    } catch (err) {
      console.error('Error loading reception tasks', err);
      toast.error('Aufgaben konnten nicht geladen werden');
    } finally {
      setLoadingTasks(false);
    }
  };

  const visibleTasks = useMemo(() => {
    const base = canManageReception
      ? tasks
      : tasks.filter(
          (task) =>
            task.created_by === profile?.id ||
            (task.direction === 'ORG_TODO' && task.organization_id && task.organization_id === profile?.organization_id),
        );
    return base.filter((task) => task.status === statusFilter);
  }, [tasks, canManageReception, profile?.id, profile?.organization_id, statusFilter]);

  const handleCreateReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id) return;
    if (!reportForm.title.trim()) {
      toast.error('Bitte gib einen Kurz-Titel an');
      return;
    }
    setSavingReport(true);
    try {
      await api.mutate('/api/reception-tasks', {
        title: reportForm.title.trim(),
        details: reportForm.details.trim() || null,
        direction: 'USER_NOTE',
        organization_id: profile.organization_id || null,
      });
      setReportForm({ title: '', details: '' });
      toast.success('Meldung wurde an den Empfang gesendet');
      loadTasks();
    } catch (err) {
      console.error('Error creating reception report', err);
      toast.error('Meldung konnte nicht übermittelt werden');
    } finally {
      setSavingReport(false);
    }
  };

  const handleCreateOrgTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id || !canManageReception) return;
    if (!orgTaskForm.title.trim() || !orgTaskForm.organization_id) {
      toast.error('Bitte gib Titel und Organisation an');
      return;
    }
    setSavingOrgTask(true);
    try {
      await api.mutate('/api/reception-tasks', {
        title: orgTaskForm.title.trim(),
        details: orgTaskForm.details.trim() || null,
        direction: 'ORG_TODO',
        organization_id: orgTaskForm.organization_id,
        due_at: orgTaskForm.due_at ? new Date(orgTaskForm.due_at).toISOString() : null,
      });
      setOrgTaskForm({ title: '', details: '', organization_id: '', due_at: '' });
      toast.success('Aufgabe veröffentlicht');
      loadTasks();
    } catch (err) {
      console.error('Error creating org task', err);
      toast.error('Aufgabe konnte nicht erstellt werden');
    } finally {
      setSavingOrgTask(false);
    }
  };

  const handleStatusChange = async (taskId: string, nextStatus: ReceptionTaskStatus) => {
    if (!canManageReception) {
      toast.error('Nur Empfangspersonen können den Status ändern.');
      return;
    }
    setUpdatingTaskId(taskId);
    try {
      await api.mutate(`/api/reception-tasks/${taskId}`, { status: nextStatus }, 'PATCH');
      loadTasks();
    } catch (err) {
      console.error('Error updating task status', err);
      toast.error('Status konnte nicht aktualisiert werden');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleAssignToMe = async (taskId: string) => {
    if (!canManageReception || !profile?.id) {
      toast.error('Nur Empfangspersonen können Aufgaben übernehmen.');
      return;
    }
    setUpdatingTaskId(taskId);
    try {
      await api.mutate(`/api/reception-tasks/${taskId}`, { assigned_reception_id: profile.id, status: 'IN_PROGRESS' }, 'PATCH');
      loadTasks();
    } catch (err) {
      console.error('Error assigning task', err);
      toast.error('Aufgabe konnte nicht übernommen werden');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleAddLog = async (taskId: string) => {
    if (!canManageReception) {
      toast.error('Nur Empfangspersonen können Kommentare ergänzen.');
      return;
    }
    const text = (logDrafts[taskId] ?? '').trim();
    if (!text) return;
    setAddingLogId(taskId);
    try {
      await api.mutate('/api/reception-task-logs', { task_id: taskId, entry: text });
      setLogDrafts((prev) => ({ ...prev, [taskId]: '' }));
      loadTasks();
    } catch (err) {
      console.error('Error adding log entry', err);
      toast.error('Protokoll konnte nicht gespeichert werden');
    } finally {
      setAddingLogId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!canDeleteTask) {
      toast.error('Nur Empfangspersonen können Aufgaben löschen.');
      return;
    }
    setDeletingTaskId(taskId);
    try {
      await api.mutate(`/api/reception-tasks/${taskId}`, {}, 'DELETE');
      toast.success('Aufgabe gelöscht');
      loadTasks();
    } catch (err) {
      console.error('Error deleting reception task', err);
      toast.error('Aufgabe konnte nicht gelöscht werden');
    } finally {
      setDeletingTaskId(null);
    }
  };

  const canUpdateTask = canManageReception;
  const canDeleteTask = canManageReception;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Empfang</p>
            <h1 className="text-4xl font-bold">Empfang & Aufgaben</h1>
            <p className="text-muted-foreground">
              Melde Anliegen an den Empfang oder verwalte offene Aufgaben für Organisationen am Adenauerring.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Meldung an den Empfang senden</CardTitle>
              <CardDescription>Nutze dieses Formular, wenn Du Unterstützung oder eine Information teilen möchtest.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreateReport}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Betreff</label>
                  <Input
                    value={reportForm.title}
                    onChange={(event) => setReportForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="z. B. Paket liegt bereit"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Details</label>
                  <Textarea
                    value={reportForm.details}
                    onChange={(event) => setReportForm((prev) => ({ ...prev, details: event.target.value }))}
                    rows={4}
                    placeholder="Kurze Beschreibung oder Hinweise (optional)"
                  />
                </div>
                <Button type="submit" disabled={savingReport}>
                  {savingReport ? 'Wird gesendet...' : 'Meldung senden'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {canManageReception && (
            <Card>
              <CardHeader>
                <CardTitle>Aufgabe für Organisation anlegen</CardTitle>
                <CardDescription>Weise To-Dos an eine Organisation zu und halte die Kolleg:innen informiert.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleCreateOrgTask}>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Organisation</label>
                    <Select
                      value={orgTaskForm.organization_id || NO_ORGANIZATION_VALUE}
                      onValueChange={(value) =>
                        setOrgTaskForm((prev) => ({
                          ...prev,
                          organization_id: value === NO_ORGANIZATION_VALUE ? '' : value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingOrganizations ? 'Lädt...' : 'Organisation wählen'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ORGANIZATION_VALUE}>Bitte wählen</SelectItem>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Titel</label>
                    <Input
                      value={orgTaskForm.title}
                      onChange={(event) => setOrgTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="z. B. Paket im Backoffice abholen"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Details</label>
                    <Textarea
                      value={orgTaskForm.details}
                      onChange={(event) => setOrgTaskForm((prev) => ({ ...prev, details: event.target.value }))}
                      rows={4}
                      placeholder="Was ist zu tun? Welche Person ist zu kontaktieren?"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Fällig am (optional)</label>
                    <Input
                      type="date"
                      value={orgTaskForm.due_at}
                      onChange={(event) => setOrgTaskForm((prev) => ({ ...prev, due_at: event.target.value }))}
                    />
                  </div>
                  <Button type="submit" disabled={savingOrgTask}>
                    {savingOrgTask ? 'Speichert...' : 'Aufgabe erstellen'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aufgabenübersicht</CardTitle>
            <CardDescription>Filtere nach Status und dokumentiere die Bearbeitung.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReceptionTaskStatus)}>
              <TabsList className="grid w-full grid-cols-3">
                {STATUS_FLOW.map((status) => (
                  <TabsTrigger key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value={statusFilter} className="mt-6 space-y-4">
                {loadingTasks ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aufgaben werden geladen...
                  </div>
                ) : visibleTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Keine Aufgaben für diesen Status.
                  </div>
                ) : (
                  visibleTasks.map((task) => {
                    const directionInfo = DIRECTION_LABELS[task.direction];
                    const assigneeName = task.assigned_reception?.name || 'Empfang';
                    return (
                      <div key={task.id} className="space-y-3 rounded-2xl border bg-card/70 p-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={directionInfo.badge}>{directionInfo.label}</Badge>
                          <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
                          {task.organization?.name && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {task.organization.name}
                            </Badge>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true, locale: de })}
                          </span>
                          {canDeleteTask && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  Löschen
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Aufgabe löschen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Diese Aufgabe wird dauerhaft entfernt.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteTask(task.id)}
                                    disabled={deletingTaskId === task.id}
                                  >
                                    {deletingTaskId === task.id ? 'Löscht...' : 'Löschen'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{task.title}</h3>
                          {task.details && <p className="text-sm text-muted-foreground">{task.details}</p>}
                          {task.due_at && (
                            <p className="text-xs text-muted-foreground">
                              Fällig am {new Date(task.due_at).toLocaleDateString('de-DE')}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Verantwortlich: <span className="font-medium text-foreground">{assigneeName}</span>
                        </div>
                        {canUpdateTask && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={task.status}
                              onValueChange={(value) => handleStatusChange(task.id, value as ReceptionTaskStatus)}
                              disabled={updatingTaskId === task.id}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Status setzen" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_FLOW.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {STATUS_LABELS[status]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {canManageReception && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAssignToMe(task.id)}
                                disabled={updatingTaskId === task.id}
                              >
                                Mir zuweisen
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Vorgangsprotokoll
                          </p>
                          {task.reception_task_logs && task.reception_task_logs.length > 0 ? (
                            <div className="space-y-2">
                              {task.reception_task_logs.map((log) => (
                                <div key={log.id} className="rounded-lg border bg-background/70 p-2 text-sm">
                                  <p className="font-medium">{log.creator?.name ?? 'System'}</p>
                                  <p className="text-muted-foreground">{log.entry}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: de })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">Noch keine Notizen.</p>
                          )}
                          {canUpdateTask && (
                            <div className="space-y-2">
                              <Textarea
                                value={logDrafts[task.id] ?? ''}
                                onChange={(event) =>
                                  setLogDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))
                                }
                                rows={2}
                                placeholder="Neuen Eintrag hinzufügen..."
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddLog(task.id)}
                                disabled={addingLogId === task.id || !logDrafts[task.id]?.trim()}
                              >
                                {addingLogId === task.id ? 'Speichert...' : 'Kommentar sichern'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
