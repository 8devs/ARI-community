import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { CalendarDays, Clock, Globe, Lock, MapPin, Plus } from 'lucide-react';

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  audience: 'PUBLIC' | 'INTERNAL';
  is_open_to_all: boolean;
  external_registration_url: string | null;
  owner_id: string;
  owner?: {
    name: string | null;
  } | null;
}

const audienceOptions: EventRow['audience'][] = ['PUBLIC', 'INTERNAL'];

export default function Events() {
  const { user } = useAuth();
  const { profile } = useCurrentProfile();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showInternal, setShowInternal] = useState(Boolean(user));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    location: '',
    description: '',
    starts_at: '',
    ends_at: '',
    audience: 'INTERNAL' as EventRow['audience'],
    is_open_to_all: true,
    external_registration_url: '',
  });

  const isEventManager = Boolean(profile && (profile.role === 'SUPER_ADMIN' || profile.is_event_manager));

  useEffect(() => {
    if (!user) {
      setShowInternal(false);
    }
  }, [user]);

  useEffect(() => {
    loadEvents();
  }, [currentMonth, showInternal, user]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const rangeStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
      const rangeEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

      const params: Record<string, string> = {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
      };

      if (!user || !showInternal) {
        params.audience = 'PUBLIC';
      }

      const { data } = await api.query<{ data: EventRow[] }>('/api/events', params);
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events', error);
      toast.error('Events konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const openEventDialog = (event?: EventRow) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title,
        location: event.location ?? '',
        description: event.description ?? '',
        starts_at: event.starts_at.slice(0, 16),
        ends_at: event.ends_at.slice(0, 16),
        audience: event.audience,
        is_open_to_all: Boolean(event.is_open_to_all),
        external_registration_url: event.external_registration_url ?? '',
      });
    } else {
      setEditingEvent(null);
      const baseDate = format(currentMonth, "yyyy-MM-dd'T'HH:00");
      setEventForm({
        title: '',
        location: '',
        description: '',
        starts_at: baseDate,
        ends_at: baseDate,
        audience: 'INTERNAL',
        is_open_to_all: true,
        external_registration_url: '',
      });
    }
    setDialogOpen(true);
  };

  const handleEventFormChange = (field: keyof typeof eventForm, value: string | boolean) => {
    setEventForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      toast.error('Nur angemeldete Eventmanager können Events verwalten.');
      return;
    }
    if (!eventForm.title.trim()) {
      toast.error('Bitte gib einen Titel ein.');
      return;
    }
    if (!eventForm.starts_at || !eventForm.ends_at) {
      toast.error('Bitte Start- und Endzeit angeben.');
      return;
    }
    if (new Date(eventForm.starts_at) > new Date(eventForm.ends_at)) {
      toast.error('Das Enddatum muss nach dem Startdatum liegen.');
      return;
    }

    setSavingEvent(true);
    try {
      const payload = {
        title: eventForm.title.trim(),
        description: eventForm.description.trim() || null,
        location: eventForm.location.trim() || null,
        starts_at: new Date(eventForm.starts_at).toISOString(),
        ends_at: new Date(eventForm.ends_at).toISOString(),
        audience: eventForm.audience,
        is_open_to_all: eventForm.is_open_to_all,
        external_registration_url: eventForm.external_registration_url.trim() || null,
        owner_id: profile.id,
      };

      if (editingEvent) {
        await api.mutate(`/api/events/${editingEvent.id}`, payload, 'PATCH');
      } else {
        await api.mutate('/api/events', payload);
      }

      toast.success(editingEvent ? 'Event aktualisiert' : 'Event erstellt');
      setDialogOpen(false);
      setEditingEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Error saving event', error);
      toast.error('Event konnte nicht gespeichert werden');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Event wirklich löschen?')) return;
    setDeletingId(eventId);
    try {
      await api.mutate(`/api/events/${eventId}`, {}, 'DELETE');
      toast.success('Event gelöscht');
      loadEvents();
    } catch (error) {
      console.error('Error deleting event', error);
      toast.error('Event konnte nicht gelöscht werden');
    }
    setDeletingId(null);
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    events.forEach((event) => {
      const key = format(new Date(event.starts_at), 'yyyy-MM-dd');
      map[key] = map[key] ? [...map[key], event] : [event];
    });
    return map;
  }, [events]);

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Events & Kalender</h1>
            <p className="text-muted-foreground">
              Öffentliche und interne Veranstaltungen am Adenauerring.
            </p>
          </div>
          {isEventManager && (
            <Button onClick={() => openEventDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Event
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-between border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => changeMonth('prev')}>
              Vorheriger Monat
            </Button>
            <p className="text-lg font-semibold">{format(currentMonth, 'LLLL yyyy', { locale: de })}</p>
            <Button variant="outline" size="sm" onClick={() => changeMonth('next')}>
              Nächster Monat
            </Button>
          </div>
          {user ? (
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={showInternal} onCheckedChange={setShowInternal} />
              <span>Interne Events anzeigen</span>
            </div>
          ) : (
            <Badge variant="secondary">Nur öffentliche Events sichtbar</Badge>
          )}
        </div>

        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'calendar')}>
          <TabsList className="grid w-full grid-cols-2 md:w-auto">
            <TabsTrigger value="list">Liste</TabsTrigger>
            <TabsTrigger value="calendar">Kalender</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Events werden geladen...
                </CardContent>
              </Card>
            ) : upcomingEvents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Keine Events in diesem Zeitraum.
                </CardContent>
              </Card>
            ) : (
              upcomingEvents.map((event) => (
                <Card key={event.id} className="border border-border/60">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle>{event.title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(event.starts_at), 'dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                            {format(new Date(event.ends_at), 'HH:mm', { locale: de })}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={event.audience === 'PUBLIC' ? 'default' : 'secondary'}>
                          {event.audience === 'PUBLIC' ? (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              Öffentlich
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Intern
                            </span>
                          )}
                        </Badge>
                        {event.owner?.name && (
                          <Badge variant="outline">von {event.owner.name}</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {event.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {event.description}
                      </p>
                    )}
                    {event.external_registration_url && (
                      <a
                        href={event.external_registration_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary underline"
                      >
                        Zur Anmeldung
                      </a>
                    )}
                    {isEventManager && (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => openEventDialog(event)}>
                          Bearbeiten
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deletingId === event.id}
                        >
                          {deletingId === event.id ? 'Löschen...' : 'Löschen'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Monatsübersicht</CardTitle>
                <CardDescription>Tippe auf ein Datum, um Events einzusehen.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground mb-2">
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDay[key] || [];
                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-2 text-left min-h-[100px] ${
                          isSameMonth(day, currentMonth) ? 'bg-card' : 'bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <div className={`text-sm font-semibold ${isSameDay(day, new Date()) ? 'text-primary' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className="rounded bg-muted px-2 py-1 text-xs"
                              title={event.title}
                            >
                              <span className="font-medium">{event.title}</span>
                              <div className="text-[11px]">
                                {format(new Date(event.starts_at), 'HH:mm')} •{' '}
                                {event.audience === 'PUBLIC' ? 'Öffentlich' : 'Intern'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isEventManager && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Event bearbeiten' : 'Neues Event erstellen'}</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSaveEvent}>
              <div className="space-y-2">
                <Label htmlFor="event-title">Titel</Label>
                <Input
                  id="event-title"
                  value={eventForm.title}
                  onChange={(e) => handleEventFormChange('title', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-start">Start</Label>
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={eventForm.starts_at}
                    onChange={(e) => handleEventFormChange('starts_at', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-end">Ende</Label>
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={eventForm.ends_at}
                    onChange={(e) => handleEventFormChange('ends_at', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-location">Ort</Label>
                  <Input
                    id="event-location"
                    value={eventForm.location}
                    onChange={(e) => handleEventFormChange('location', e.target.value)}
                    placeholder="z.B. Innovationsraum, Gebäude A"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={eventForm.audience}
                    onValueChange={(value: EventRow['audience']) =>
                      handleEventFormChange('audience', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sichtbarkeit wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Öffentlich</SelectItem>
                      <SelectItem value="INTERNAL">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-description">Beschreibung</Label>
                <Textarea
                  id="event-description"
                  rows={4}
                  value={eventForm.description}
                  onChange={(e) => handleEventFormChange('description', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-url">Externer Link</Label>
                <Input
                  id="event-url"
                  type="url"
                  placeholder="https://example.com/anmeldung"
                  value={eventForm.external_registration_url}
                  onChange={(e) => handleEventFormChange('external_registration_url', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Frei zugänglich
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kennzeichnet Events ohne gesonderte Anmeldung.
                  </p>
                </div>
                <Switch
                  checked={eventForm.is_open_to_all}
                  onCheckedChange={(checked) => handleEventFormChange('is_open_to_all', checked)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={savingEvent}>
                  {savingEvent ? 'Speichert...' : editingEvent ? 'Event aktualisieren' : 'Event erstellen'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Layout>
  );
}
