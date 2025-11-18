import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { toast } from 'sonner';
import { addHours, addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, CalendarDays, MapPin, Users, Plus, Edit, DoorClosed, Trash2, Search, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

type Room = Tables<'rooms'>;
type Booking = Tables<'room_bookings'> & {
  creator?: {
    name: string | null;
  } | null;
  organization?: {
    name: string | null;
  } | null;
};

const emptyRoomForm = {
  name: '',
  location: '',
  description: '',
  capacity: '',
  equipment: '',
  is_active: true,
};

const emptyBookingForm = {
  title: '',
  description: '',
  start: '',
  end: '',
};

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 22;

export default function Rooms() {
  const { profile } = useCurrentProfile();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(startOfDay(new Date()));

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [bookingForm, setBookingForm] = useState(emptyBookingForm);
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [roomsSheetOpen, setRoomsSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline'>('calendar');

  const isRoomAdmin = Boolean(profile && (profile.role === 'SUPER_ADMIN' || profile.role === 'ORG_ADMIN'));

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    loadBookings(currentMonth);
  }, [currentMonth]);

  const loadRooms = async () => {
    setRoomsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('name');
      if (error) throw error;
      setRooms(data || []);
      if (!selectedRoomId && data && data.length > 0) {
        const activeRoom = data.find(room => room.is_active) || data[0];
        setSelectedRoomId(activeRoom.id);
      }
    } catch (error) {
      console.error('Error loading rooms', error);
      toast.error('Räume konnten nicht geladen werden.');
    } finally {
      setRoomsLoading(false);
    }
  };

  const loadBookings = async (month: Date) => {
    setBookingsLoading(true);
    try {
      const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
      const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

      const { data, error } = await supabase
        .from('room_bookings')
        .select(`
          *,
          creator:profiles!room_bookings_created_by_fkey(name),
          organization:organizations(name)
        `)
        .gte('start_time', rangeStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())
        .order('start_time');
      if (error) throw error;
      const todayStart = startOfDay(new Date());
      const filtered = ((data as Booking[]) || []).filter(
        (booking) => new Date(booking.end_time) >= todayStart,
      );
      setBookings(filtered);
    } catch (error: any) {
      console.error('Error loading bookings', error);
      toast.error('Buchungen konnten nicht geladen werden.');
    } finally {
      setBookingsLoading(false);
    }
  };

  const openRoomDialog = (room?: Room) => {
    if (!isRoomAdmin) return;
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        name: room.name,
        location: room.location ?? '',
        description: room.description ?? '',
        capacity: room.capacity?.toString() ?? '',
        equipment: room.equipment ?? '',
        is_active: Boolean(room.is_active),
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        ...emptyRoomForm,
        is_active: true,
      });
    }
    setRoomDialogOpen(true);
  };

  const openBookingDialog = (booking?: Booking) => {
    if (!selectedRoomId) {
      toast.error('Bitte zuerst einen Raum auswählen.');
      return;
    }
    if (booking) {
      setEditingBooking(booking);
      setBookingForm({
        title: booking.title,
        description: booking.description ?? '',
        start: booking.start_time.slice(0, 16),
        end: booking.end_time.slice(0, 16),
      });
    } else {
      setEditingBooking(null);
      const now = new Date();
      const start = format(now, "yyyy-MM-dd'T'HH:00");
      const end = format(addHours(new Date(start), 1), "yyyy-MM-dd'T'HH:00");
      setBookingForm({
        title: '',
        description: '',
        start,
        end,
      });
    }
    setBookingDialogOpen(true);
  };

  const handleRoomFormChange = (field: keyof typeof roomForm, value: string | boolean) => {
    setRoomForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBookingFormChange = (field: keyof typeof bookingForm, value: string) => {
    setBookingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRoomAdmin || !profile?.id) {
      toast.error('Nur Administratoren können Räume verwalten.');
      return;
    }
    if (!roomForm.name.trim()) {
      toast.error('Bitte einen Raumnamen angeben.');
      return;
    }

    setSavingRoom(true);
    const commonPayload = {
      name: roomForm.name.trim(),
      location: roomForm.location.trim() || null,
      description: roomForm.description.trim() || null,
      capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
      equipment: roomForm.equipment.trim() || null,
      is_active: roomForm.is_active,
    };

    try {
      if (editingRoom) {
        const { error } = await supabase
          .from('rooms')
          .update(commonPayload)
          .eq('id', editingRoom.id);
        if (error) throw error;
        toast.success('Raum aktualisiert');
      } else {
        const { error } = await supabase.from('rooms').insert({
          ...commonPayload,
          organization_id: profile.organization_id,
          created_by: profile.id,
        });
        if (error) throw error;
        toast.success('Raum angelegt');
      }
      setRoomDialogOpen(false);
      setEditingRoom(null);
      loadRooms();
    } catch (error) {
      console.error('Error saving room', error);
      toast.error('Raum konnte nicht gespeichert werden.');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !selectedRoomId) {
      toast.error('Bitte melde Dich an und wähle einen Raum aus.');
      return;
    }
    if (!bookingForm.title.trim()) {
      toast.error('Bitte einen Titel angeben.');
      return;
    }
    if (!bookingForm.start || !bookingForm.end) {
      toast.error('Bitte Start- und Endzeit wählen.');
      return;
    }
    if (new Date(bookingForm.start) >= new Date(bookingForm.end)) {
      toast.error('Die Endzeit muss nach der Startzeit liegen.');
      return;
    }

    const payload = {
      room_id: selectedRoomId,
      title: bookingForm.title.trim(),
      description: bookingForm.description.trim() || null,
      start_time: new Date(bookingForm.start).toISOString(),
      end_time: new Date(bookingForm.end).toISOString(),
      organization_id: profile.organization_id,
    };

    setSavingBooking(true);
    try {
      if (editingBooking) {
        const { error } = await supabase
          .from('room_bookings')
          .update(payload)
          .eq('id', editingBooking.id);
        if (error) throw error;
        toast.success('Buchung aktualisiert');
      } else {
        const { error } = await supabase.from('room_bookings').insert({
          ...payload,
          created_by: profile.id,
        });
        if (error) throw error;
        toast.success('Raum gebucht');
      }
      setBookingDialogOpen(false);
      setEditingBooking(null);
      loadBookings(currentMonth);
    } catch (error: any) {
      console.error('Error saving booking', error);
      if (error?.message?.includes('room_booking_no_overlap')) {
        toast.error('Dieser Zeitraum ist bereits belegt.');
      } else {
        toast.error('Buchung konnte nicht gespeichert werden.');
      }
    } finally {
      setSavingBooking(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!selectedRoomId) return;
    setDeletingBookingId(bookingId);
    try {
      const { error } = await supabase.from('room_bookings').delete().eq('id', bookingId);
      if (error) throw error;
      toast.success('Buchung gelöscht');
      loadBookings(currentMonth);
    } catch (error) {
      console.error('Error deleting booking', error);
      toast.error('Buchung konnte nicht gelöscht werden.');
    } finally {
      setDeletingBookingId(null);
    }
  };

  const daysInCalendar = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const filteredBookings = useMemo(() => {
    if (!selectedRoomId) return bookings;
    return bookings.filter((booking) => booking.room_id === selectedRoomId);
  }, [bookings, selectedRoomId]);

  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) return rooms;
    const term = roomSearch.toLowerCase();
    return rooms.filter((room) =>
      room.name.toLowerCase().includes(term) ||
      room.location?.toLowerCase().includes(term) ||
      room.description?.toLowerCase().includes(term),
    );
  }, [rooms, roomSearch]);

  const { activeRooms, inactiveRooms } = useMemo(() => {
    const active = rooms.filter((room) => room.is_active).length;
    return {
      activeRooms: active,
      inactiveRooms: Math.max(rooms.length - active, 0),
    };
  }, [rooms]);

  useEffect(() => {
    if (!filteredRooms.length) {
      setSelectedRoomId(null);
      return;
    }
    if (!selectedRoomId || !filteredRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId(filteredRooms[0].id);
    }
  }, [filteredRooms, selectedRoomId]);

  const bookingsByRoomForSelectedDay = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((booking) => {
      if (isSameDay(new Date(booking.start_time), selectedDay)) {
        map.set(booking.room_id, (map.get(booking.room_id) ?? 0) + 1);
      }
    });
    return map;
  }, [bookings, selectedDay]);

  const totalBookingsForSelectedDay = useMemo(() => {
    let total = 0;
    bookings.forEach((booking) => {
      if (isSameDay(new Date(booking.start_time), selectedDay)) {
        total += 1;
      }
    });
    return total;
  }, [bookings, selectedDay]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach((booking) => {
      const key = format(new Date(booking.start_time), 'yyyy-MM-dd');
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(booking);
    });
    return map;
  }, [filteredBookings]);

  const dayTimelineMap = useMemo(() => {
    const start = startOfDay(selectedDay);
    const end = endOfDay(selectedDay);
    const map = new Map<string, Booking[]>();
    bookings.forEach((booking) => {
      const startTime = new Date(booking.start_time);
      if (startTime < start || startTime > end) return;
      if (!map.has(booking.room_id)) {
        map.set(booking.room_id, []);
      }
      map.get(booking.room_id)!.push(booking);
    });
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }
    return map;
  }, [bookings, selectedDay]);

  const timelineHours = useMemo(
    () =>
      Array.from(
        { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
        (_, index) => TIMELINE_START_HOUR + index,
      ),
    [],
  );

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;

  const handleSelectRoom = (roomId: string, closePanel = false) => {
    setSelectedRoomId(roomId);
    if (closePanel) {
      setRoomsSheetOpen(false);
    }
  };

  const RoomSelectionPanel = ({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) => {
    const closeOnSelect = variant === 'mobile';

    return (
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Räume</p>
            <h2 className="text-2xl font-bold leading-tight">Wähle den passenden Raum</h2>
            <p className="text-sm text-muted-foreground">
              Suche nach Standort oder Ausstattung und prüfe die Auslastung des ausgewählten Tages.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed bg-muted/30 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Räume durchsuchen..."
                className="pl-10"
                value={roomSearch}
                onChange={(event) => setRoomSearch(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-2xl border bg-card/50 shadow-inner">
          <ScrollArea className="h-full p-3">
            {roomsLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Räume werden geladen...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <p>Keine passenden Räume gefunden.</p>
                <p className="text-xs">Passe die Suche an oder lege einen neuen Raum an.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRooms.map((room) => {
                  const bookingCount = bookingsByRoomForSelectedDay.get(room.id) ?? 0;
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <div
                      key={room.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectRoom(room.id, closeOnSelect)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSelectRoom(room.id, closeOnSelect);
                        }
                      }}
                      className={cn(
                        'group relative w-full cursor-pointer rounded-2xl border border-border/70 bg-background/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg',
                        isSelected && 'border-primary bg-primary/5 shadow-md',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold leading-tight">{room.name}</p>
                          {room.location && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{room.location}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold',
                                room.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {room.is_active ? 'Aktiv' : 'Inaktiv'}
                            </span>
                            {isRoomAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRoomDialog(room);
                                }}
                                aria-label={`${room.name} bearbeiten`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <span className={cn('text-[11px] font-medium', bookingCount > 0 ? 'text-primary' : 'text-muted-foreground')}>
                            {bookingCount > 0 ? `${bookingCount} Buchung${bookingCount > 1 ? 'en' : ''} heute` : 'Heute frei'}
                          </span>
                        </div>
                      </div>
                      {room.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{room.description}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {room.capacity && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                            <Users className="h-3 w-3" /> bis {room.capacity} Personen
                          </span>
                        )}
                        {room.equipment && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5" title={room.equipment}>
                            Ausstattung: {room.equipment}
                          </span>
                        )}
                        {!room.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-50">
                            <DoorClosed className="h-3 w-3" />
                            Wartung
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    );
  };

  const canManageBooking = (booking: Booking) => {
    if (!profile) return false;
    if (booking.created_by === profile.id) return true;
    return profile.role === 'SUPER_ADMIN' || profile.role === 'ORG_ADMIN';
  };

  return (
    <Layout>
      <Sheet open={roomsSheetOpen} onOpenChange={setRoomsSheetOpen}>
        <SheetContent side="left" className="flex w-full flex-col overflow-hidden border-r p-0 sm:max-w-md">
          <div className="border-b px-6 py-4">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle>Räume auswählen</SheetTitle>
              <SheetDescription>Suche nach frei verfügbaren Räumen oder lege neue Räume an.</SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-hidden px-6 pb-6 pt-4">
            <RoomSelectionPanel variant="mobile" />
          </div>
        </SheetContent>
      </Sheet>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Raumbuchung</h1>
            <p className="text-muted-foreground">Verwalte Meetingräume und buche freie Slots.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto lg:hidden"
              onClick={() => setRoomsSheetOpen(true)}
            >
              <Menu className="mr-2 h-4 w-4" />
              Räume wählen
            </Button>
            {isRoomAdmin && (
              <Button onClick={() => openRoomDialog()} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Raum anlegen
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => openBookingDialog()}
              disabled={!selectedRoomId}
              className="w-full sm:w-auto"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Raum buchen
            </Button>
          </div>
        </div>

        {selectedRoom && (
          <div className="rounded-3xl border bg-card/70 p-4 shadow-sm lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktiver Raum</p>
                <p className="text-2xl font-semibold leading-tight">{selectedRoom.name}</p>
                {selectedRoom.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {selectedRoom.location}
                  </p>
                )}
              </div>
              <Badge variant={selectedRoom.is_active ? 'secondary' : 'outline'}>
                {selectedRoom.is_active ? 'Verfügbar' : 'Inaktiv'}
              </Badge>
            </div>
            {selectedRoom.description && (
              <p className="mt-3 text-sm text-muted-foreground">{selectedRoom.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedRoom.capacity && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Users className="h-3 w-3" />
                  bis {selectedRoom.capacity} Personen
                </span>
              )}
              {selectedRoom.equipment && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  Ausstattung: {selectedRoom.equipment}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={() => setRoomsSheetOpen(true)}
            >
              <Menu className="mr-2 h-4 w-4" />
              Anderen Raum wählen
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <div className="flex h-[calc(100vh-7rem)] flex-col rounded-3xl border bg-card/80 p-6 shadow-lg">
                <RoomSelectionPanel variant="desktop" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Tabs
              value={viewMode}
              onValueChange={(value) => setViewMode(value as 'calendar' | 'timeline')}
              className="space-y-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-sm font-medium text-muted-foreground">Ansicht wählen</p>
                <TabsList className="grid w-full grid-cols-2 md:w-auto">
                  <TabsTrigger value="calendar">Kalender</TabsTrigger>
                  <TabsTrigger value="timeline">Zeitstrahl</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="calendar" className="mt-0">
            <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Kalenderübersicht</CardTitle>
                  <CardDescription>
                    {selectedRoom ? `${selectedRoom.name} · ${format(currentMonth, 'MMMM yyyy', { locale: de })}` : 'Bitte Raum auswählen'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
                    &larr;
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
                    &rarr;
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedRoom ? (
                  bookingsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buchungen werden geladen...
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-px rounded-xl border bg-border text-sm lg:text-base">
                      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((weekday) => (
                        <div key={weekday} className="bg-muted/80 px-2 py-1 text-center font-medium">
                          {weekday}
                        </div>
                      ))}
                      {daysInCalendar.map((day) => {
                        const key = format(day, 'yyyy-MM-dd');
                        const dayBookings = bookingsByDay.get(key) || [];
                        return (
                          <div
                            key={key}
                            className={cn(
                              'min-h-[120px] border-border bg-background p-2 align-top text-left text-xs sm:text-sm cursor-pointer transition',
                              !isSameMonth(day, currentMonth) && 'bg-muted/50 text-muted-foreground',
                              isSameDay(day, new Date()) && 'ring-1 ring-primary',
                              isSameDay(day, selectedDay) && 'border-primary ring-2 ring-primary/60',
                            )}
                            onClick={() => setSelectedDay(startOfDay(day))}
                          >
                            <p className="font-semibold">{format(day, 'd.', { locale: de })}</p>
                            <div className="mt-1 space-y-1">
                              {dayBookings.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground">Frei</p>
                              ) : (
                                dayBookings.map((booking) => (
                                  <div
                                    key={booking.id}
                                    className="rounded-md border bg-primary/10 px-2 py-1 text-[11px] leading-tight"
                                  >
                                    <p className="font-semibold">
                                      {format(new Date(booking.start_time), 'HH:mm')} – {format(new Date(booking.end_time), 'HH:mm')}
                                    </p>
                                    <p className="truncate">{booking.title}</p>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-muted-foreground text-sm">Bitte wähle einen Raum aus.</p>
                )}
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="timeline" className="mt-0">
            <Card>
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Zeitstrahl</CardTitle>
                  <CardDescription>Buchungen am {format(selectedDay, 'dd.MM.yyyy', { locale: de })} auf einen Blick.</CardDescription>
                </div>
                <Input
                  type="date"
                  className="w-full md:w-auto"
                  value={format(selectedDay, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setSelectedDay(startOfDay(new Date(e.target.value)));
                  }}
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {bookingsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zeitstrahl wird geladen...
                  </div>
                ) : rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Räume vorhanden.</p>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between text-xs text-muted-foreground pl-24 pr-3">
                      {timelineHours.map((hour) => (
                        <span key={hour}>{hour}:00</span>
                      ))}
                    </div>
                    <div className="space-y-4">
                      {rooms.map((room) => {
                        const roomBookings = dayTimelineMap.get(room.id) ?? [];
                        return (
                          <div key={room.id}>
                            <div className="flex items-center gap-3 pl-1 pb-1 text-sm font-medium">
                              <DoorClosed className="h-4 w-4 text-primary" />
                              {room.name}
                            </div>
                            <div className="relative h-24 rounded-xl border bg-muted/30 px-3 py-2">
                              {timelineHours.map((hour) => {
                                const position =
                                  ((hour - TIMELINE_START_HOUR) /
                                    (TIMELINE_END_HOUR - TIMELINE_START_HOUR)) *
                                  100;
                                return (
                                  <div
                                    key={`${room.id}-${hour}`}
                                    className="absolute top-0 bottom-0 border-l border-border/70"
                                    style={{ left: `${position}%` }}
                                  />
                                );
                              })}
                              {roomBookings.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                                  Frei
                                </div>
                              ) : (
                                roomBookings.map((booking) => {
                                  const startDate = new Date(booking.start_time);
                                  const endDate = new Date(booking.end_time);
                                  const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
                                  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
                                  const minMinutes = TIMELINE_START_HOUR * 60;
                                  const maxMinutes = TIMELINE_END_HOUR * 60;
                                  if (endMinutes <= minMinutes || startMinutes >= maxMinutes) {
                                    return null;
                                  }
                                  const clampedStart = Math.max(minMinutes, Math.min(startMinutes, maxMinutes));
                                  const clampedEnd = Math.max(clampedStart + 15, Math.min(endMinutes, maxMinutes));
                                  const totalMinutes = maxMinutes - minMinutes;
                                  const left = ((clampedStart - minMinutes) / totalMinutes) * 100;
                                  const width = ((clampedEnd - clampedStart) / totalMinutes) * 100;

                                  return (
                                    <div
                                      key={booking.id}
                                      className="absolute top-5 rounded-lg bg-primary/80 px-3 py-2 text-xs text-primary-foreground shadow-md"
                                      style={{ left: `${left}%`, width: `${Math.max(width, 6)}%` }}
                                    >
                                      <p className="font-semibold truncate">{booking.title}</p>
                                      <p>
                                        {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
                                      </p>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Anstehende Buchungen</CardTitle>
                <CardDescription>Bearbeite oder lösche Deine Buchungen bei Bedarf.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bookingsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buchungen werden geladen...
                  </div>
                ) : bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Es existieren noch keine Buchungen für diesen Monat.</p>
                ) : (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-semibold">{booking.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(booking.start_time), 'dd.MM.yyyy HH:mm')} – {format(new Date(booking.end_time), 'HH:mm')} Uhr
                        </p>
                        {booking.description && <p className="text-sm mt-1">{booking.description}</p>}
                        <p className="text-xs text-muted-foreground">
                          {booking.creator?.name ?? 'Unbekannt'}
                          {booking.organization?.name ? ` · ${booking.organization.name}` : ''}
                        </p>
                      </div>
                      {canManageBooking(booking) && (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openBookingDialog(booking)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBooking(booking.id)}
                            disabled={deletingBookingId === booking.id}
                          >
                            {deletingBookingId === booking.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Raum bearbeiten' : 'Neuen Raum anlegen'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveRoom}>
            <div className="space-y-2">
              <Label htmlFor="room-name">Name</Label>
              <Input
                id="room-name"
                value={roomForm.name}
                onChange={(e) => handleRoomFormChange('name', e.target.value)}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="room-location">Standort</Label>
                <Input
                  id="room-location"
                  value={roomForm.location}
                  onChange={(e) => handleRoomFormChange('location', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-capacity">Kapazität</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min="1"
                  value={roomForm.capacity}
                  onChange={(e) => handleRoomFormChange('capacity', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-equipment">Ausstattung</Label>
              <Textarea
                id="room-equipment"
                rows={2}
                placeholder="Monitor, VC, Whiteboard..."
                value={roomForm.equipment}
                onChange={(e) => handleRoomFormChange('equipment', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-description">Beschreibung</Label>
              <Textarea
                id="room-description"
                rows={3}
                value={roomForm.description}
                onChange={(e) => handleRoomFormChange('description', e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">Aktiv</p>
                <p className="text-sm text-muted-foreground">Deaktivierte Räume erscheinen nicht in der Auswahl.</p>
              </div>
              <Switch
                checked={roomForm.is_active}
                onCheckedChange={(checked) => handleRoomFormChange('is_active', checked)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingRoom}>
                {savingRoom ? 'Speichert...' : editingRoom ? 'Aktualisieren' : 'Anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBooking ? 'Buchung bearbeiten' : 'Neue Buchung erstellen'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveBooking}>
            <div className="space-y-2">
              <Label htmlFor="booking-title">Titel</Label>
              <Input
                id="booking-title"
                value={bookingForm.title}
                onChange={(e) => handleBookingFormChange('title', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="booking-description">Beschreibung</Label>
              <Textarea
                id="booking-description"
                rows={3}
                value={bookingForm.description}
                onChange={(e) => handleBookingFormChange('description', e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="booking-start">Startzeit</Label>
                <Input
                  id="booking-start"
                  type="datetime-local"
                  value={bookingForm.start}
                  onChange={(e) => handleBookingFormChange('start', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-end">Endzeit</Label>
                <Input
                  id="booking-end"
                  type="datetime-local"
                  value={bookingForm.end}
                  onChange={(e) => handleBookingFormChange('end', e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingBooking}>
                {savingBooking ? 'Speichert...' : editingBooking ? 'Aktualisieren' : 'Buchen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
