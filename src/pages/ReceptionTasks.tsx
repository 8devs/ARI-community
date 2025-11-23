import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Users, ClipboardList, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReceptionTaskStatus = Database['public']['Enums']['reception_task_status'];
type ReceptionTaskDirection = Database['public']['Enums']['reception_task_direction'];
type ReceptionTaskRow = Tables<'reception_tasks'> & {
  organization?: { name: string | null } | null;
  creator?: { id: string; name: string | null; email: string | null } | null;
  assignee?: { id: string; name: string | null } | null;
  logs?: (Tables<'reception_task_logs'> & { actor?: { name: string | null } | null })[];
};

type Recipient = { id: string; email: string | null; name: string | null };

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
    organization_id: '',
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

  useEffect(() => {
    if (!profile?.id) return;
    loadTasks();
    // only load organizations once for form dropdowns
    loadOrganizations();
  }, [profile?.id, canManageReception]);

  const loadOrganizations = async () => {
    setLoadingOrganizations(true);
    const { data, error } = await supabase.from('organizations').select('id, name').order('name');
    setLoadingOrganizations(false);
    if (error) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
      return;
    }
    setOrganizations(data ?? []);
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from('reception_tasks')
      .select(
        `
          *,
          organization:organizations(name),
          creator:profiles(id, name, email),
          assignee:profiles!reception_tasks_assigned_reception_id_fkey(id, name),
          logs:reception_task_logs(
            id,
            entry,
            created_at,
            created_by,
            actor:profiles(name)
          )
        `,
      )
      .order('created_at', { ascending: false });
    setLoadingTasks(false);
    if (error) {
      console.error('Error loading reception tasks', error);
      toast.error('Aufgaben konnten nicht geladen werden');
      return;
    }
    setTasks((data as ReceptionTaskRow[]) ?? []);
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

  const recipientsForReception = async (): Promise<Recipient[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('is_receptionist', true);
    if (error) {
      console.error('Error loading reception recipients', error);
      return [];
    }
    return data ?? [];
  };

  const recipientsForOrganization = async (organizationId: string): Promise<Recipient[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name')
      .eq('organization_id', organizationId)
      .in('role', ['ORG_ADMIN', 'SUPER_ADMIN']);
    if (error) {
      console.error('Error loading org recipients', error);
      return [];
    }
    return data ?? [];
  };

  const notifyRecipients = async (recipients: Recipient[], subject: string, body: string, badge: string) => {
    if (!recipients.length) return;
    await Promise.all(
      recipients.map(async (recipient) => {
        await supabase.rpc('create_notification', {
          _user_id: recipient.id,
          _title: subject,
          _body: body,
          _type: 'MESSAGE',
          _url: '#/empfang',
        });
      }),
    );
    const emails = recipients.map((recipient) => recipient.email).filter((email): email is string => Boolean(email));
    if (emails.length) {
      await supabase.functions.invoke('send-email-notification', {
        body: {
          to: emails,
          subject,
          html: `<p>${body}</p><p>Zur Übersicht: <a href="https://www.ari-worms.de/#/empfang">Empfang & Aufgaben</a></p>`,
          badge,
        },
      });
    }
  };

  const handleCreateReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id) return;
    if (!reportForm.title.trim()) {
      toast.error('Bitte gib einen Kurz-Titel an');
      return;
    }
    setSavingReport(true);
    const { data, error } = await supabase
      .from('reception_tasks')
      .insert({
        title: reportForm.title.trim(),
        details: reportForm.details.trim() || null,
        direction: 'USER_NOTE',
        created_by: profile.id,
        organization_id: reportForm.organization_id || profile.organization_id || null,
      })
      .select('id, title, details')
      .single();
    setSavingReport(false);
    if (error) {
      console.error('Error creating reception report', error);
      toast.error('Meldung konnte nicht übermittelt werden');
      return;
    }
    setReportForm({ title: '', details: '', organization_id: '' });
    toast.success('Meldung wurde an den Empfang gesendet');
    loadTasks();
    const recipients = await recipientsForReception();
    await notifyRecipients(
      recipients,
      `Neue Meldung: ${data?.title ?? 'Empfang'}`,
      `Es liegt eine neue Meldung vom Empfang an: ${data?.details ?? ''}`.trim(),
      'Empfang',
    );
  };

  const handleCreateOrgTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id || !canManageReception) return;
    if (!orgTaskForm.title.trim() || !orgTaskForm.organization_id) {
      toast.error('Bitte gib Titel und Organisation an');
      return;
    }
    setSavingOrgTask(true);
    const { data, error } = await supabase
      .from('reception_tasks')
      .insert({
        title: orgTaskForm.title.trim(),
        details: orgTaskForm.details.trim() || null,
        direction: 'ORG_TODO',
        created_by: profile.id,
        organization_id: orgTaskForm.organization_id,
        due_at: orgTaskForm.due_at ? new Date(orgTaskForm.due_at).toISOString() : null,
      })
      .select('id, title, details, organization_id')
      .single();
    setSavingOrgTask(false);
    if (error) {
      console.error('Error creating org task', error);
      toast.error('Aufgabe konnte nicht erstellt werden');
      return;
    }
    setOrgTaskForm({ title: '', details: '', organization_id: '', due_at: '' });
    toast.success('Aufgabe veröffentlicht');
    loadTasks();
    if (data?.organization_id) {
      const recipients = await recipientsForOrganization(data.organization_id);
      await notifyRecipients(
        recipients,
        `Neue Aufgabe vom Empfang: ${data.title}`,
        `Für Eure Organisation liegt eine neue Aufgabe vor: ${data.details ?? ''}`.trim(),
        'Empfang',
      );
    }
  };

  const handleStatusChange = async (taskId: string, nextStatus: ReceptionTaskStatus) => {
    if (!canManageReception) {
      toast.error('Nur Empfangspersonen können den Status ändern.');
      return;
    }
    setUpdatingTaskId(taskId);
    const { error } = await supabase.from('reception_tasks').update({ status: nextStatus }).eq('id', taskId);
    setUpdatingTaskId(null);
    if (error) {
      console.error('Error updating task status', error);
      toast.error('Status konnte nicht aktualisiert werden');
      return;
    }
    loadTasks();
  };

  const handleAssignToMe = async (taskId: string) => {
    if (!canManageReception || !profile?.id) {
      toast.error('Nur Empfangspersonen können Aufgaben übernehmen.');
      return;
    }
    setUpdatingTaskId(taskId);
    const { error } = await supabase
      .from('reception_tasks')
      .update({ assigned_reception_id: profile.id, status: 'IN_PROGRESS' })
      .eq('id', taskId);
    setUpdatingTaskId(null);
    if (error) {
      console.error('Error assigning task', error);
      toast.error('Aufgabe konnte nicht übernommen werden');
      return;
    }
    loadTasks();
  };

  const handleAddLog = async (taskId: string) => {
    if (!canManageReception) {
      toast.error('Nur Empfangspersonen können Kommentare ergänzen.');
      return;
    }
    const text = (logDrafts[taskId] ?? '').trim();
    if (!text) return;
    setAddingLogId(taskId);
    const { error } = await supabase.from('reception_task_logs').insert({ task_id: taskId, entry: text });
    setAddingLogId(null);
    if (error) {
      console.error('Error adding log entry', error);
      toast.error('Protokoll konnte nicht gespeichert werden');
      return;
    }
    setLogDrafts((prev) => ({ ...prev, [taskId]: '' }));
    loadTasks();
  };

  const canUpdateTask = canManageReception;

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
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Organisation (optional)</label>
                  <Select
                    value={reportForm.organization_id || NO_ORGANIZATION_VALUE}
                    onValueChange={(value) =>
                      setReportForm((prev) => ({
                        ...prev,
                        organization_id: value === NO_ORGANIZATION_VALUE ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingOrganizations ? 'Lädt...' : 'Organisation auswählen'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ORGANIZATION_VALUE}>Keine Angabe</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    const assigneeName = task.assignee?.name || 'Empfang';
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
                          {task.logs && task.logs.length > 0 ? (
                            <div className="space-y-2">
                              {task.logs.map((log) => (
                                <div key={log.id} className="rounded-lg border bg-background/70 p-2 text-sm">
                                  <p className="font-medium">{log.actor?.name ?? 'System'}</p>
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
