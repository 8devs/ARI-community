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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { toast } from 'sonner';
import { addHours, addMinutes, addMonths, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { Loader2, CalendarDays, MapPin, Users, Plus, Edit, DoorClosed, Trash2, Search, Menu, Share2, Copy, FileText, Droplet, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sendEmailNotification } from '@/lib/notifications';

type Room = Tables<'rooms'>;
type Booking = Tables<'room_bookings'> & {
  creator?: {
    name: string | null;
  } | null;
  organization?: {
    name: string | null;
  } | null;
};
type RoomResourceGroup = Tables<'room_resource_groups'> & {
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
  chairs_capacity: '',
  chairs_default: '',
  tables_capacity: '',
  tables_default: '',
  notify_on_booking: false,
  booking_notify_email: '',
  info_document_url: '',
  resource_group_id: null as string | null,
};

const emptyBookingForm = {
  title: '',
  description: '',
  start: '',
  end: '',
  expected_attendees: '',
  chairs_needed: '',
  tables_needed: '',
  whiteboards_needed: '',
  requires_catering: false,
  catering_details: '',
};

const emptyGroupForm = {
  name: '',
  tables_total: '',
  chairs_total: '',
  whiteboards_total: '',
  organization_id: null as string | null,
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
  const [roomDocumentFile, setRoomDocumentFile] = useState<File | null>(null);
  const [removeRoomDocument, setRemoveRoomDocument] = useState(false);
  const [resourceGroups, setResourceGroups] = useState<RoomResourceGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RoomResourceGroup | null>(null);
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [savingGroup, setSavingGroup] = useState(false);
  const [organizations, setOrganizations] = useState<{ id: string; name: string | null }[]>([]);

  const isRoomAdmin = Boolean(profile && (profile.role === 'SUPER_ADMIN' || profile.role === 'ORG_ADMIN'));
  const getPublicRoomUrl = (token: string) => {
    const suffix = `#/raeume/public/${token}`;
    if (typeof window === 'undefined') return suffix;
    return `${window.location.origin}${window.location.pathname}${suffix}`;
  };
  const selectedRoom = useMemo(() => rooms.find((room) => room.id === selectedRoomId) || null, [rooms, selectedRoomId]);
  const publicRoomLink = useMemo(
    () => (selectedRoom?.public_share_token ? getPublicRoomUrl(selectedRoom.public_share_token) : null),
    [selectedRoom?.public_share_token],
  );
  const selectedGroup = useMemo(
    () => resourceGroups.find((group) => group.id === selectedRoom?.resource_group_id) ?? null,
    [resourceGroups, selectedRoom?.resource_group_id],
  );

  const numberOrNull = (value: string) => (value ? Number(value) : null);
  const resolveDefaultGroupOrganization = () => {
    if (profile?.role === 'SUPER_ADMIN') {
      return profile?.organization_id ?? organizations[0]?.id ?? null;
    }
    return profile?.organization_id ?? null;
  };

  const copyPublicLink = async () => {
    if (!selectedRoom?.public_share_token) return;
    const url = getPublicRoomUrl(selectedRoom.public_share_token);
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error('Zwischenablage ist nicht verfügbar.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Öffentlicher Link kopiert');
    } catch (error) {
      console.error('copy link failed', error);
      toast.error('Konnte Link nicht kopieren. Bitte manuell kopieren.');
    }
  };

  const generateDocumentPath = (file: File) => {
    const ext = file.name.split('.').pop();
    const randomId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `room-documents/${randomId}.${ext}`;
  };

  const uploadRoomDocument = async (file: File) => {
    const filePath = generateDocumentPath(file);
    const { error } = await supabase.storage.from('room-documents').upload(filePath, file, {
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('room-documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const notifyRoomBookingContact = async (
    room: Room,
    details: {
      title: string;
      start: Date;
      end: Date;
      description?: string | null;
      expectedAttendees?: number | null;
      chairsNeeded?: number | null;
      tablesNeeded?: number | null;
      whiteboardsNeeded?: number | null;
      organizer?: string | null;
      organization?: string | null;
      cateringNeeded?: boolean;
      cateringDetails?: string | null;
    },
  ) => {
    if (!room.notify_on_booking || !room.booking_notify_email) return;
    const startLabel = format(details.start, "dd.MM.yyyy 'um' HH:mm", { locale: de });
    const endLabel = format(details.end, "dd.MM.yyyy 'um' HH:mm", { locale: de });
    const subject = `Neue Buchung für ${room.name}`;
    const html = `
      <h2 style="font-family:Arial,sans-serif;">${room.name}</h2>
      <p><strong>Zeitraum:</strong> ${startLabel} – ${endLabel}</p>
      <p><strong>Organisator:</strong> ${details.organizer ?? 'Unbekannt'}${details.organization ? ` (${details.organization})` : ''}</p>
      <p><strong>Erwartete Personen:</strong> ${details.expectedAttendees ?? 'Nicht angegeben'}</p>
      <p><strong>Stühle benötigt:</strong> ${details.chairsNeeded ?? 'Nicht angegeben'}${room.chairs_capacity ? ` / ${room.chairs_capacity} verfügbar` : ''}</p>
      <p><strong>Tische benötigt:</strong> ${details.tablesNeeded ?? 'Nicht angegeben'}${room.tables_capacity ? ` / ${room.tables_capacity} verfügbar` : ''}</p>
      <p><strong>Whiteboards benötigt:</strong> ${details.whiteboardsNeeded ?? 'Nicht angegeben'}</p>
      <p><strong>Catering benötigt:</strong> ${details.cateringNeeded ? 'Ja' : 'Nein'}</p>
      ${
        details.cateringNeeded && details.cateringDetails
          ? `<p><strong>Catering-Wunsch:</strong><br />${details.cateringDetails.replace(/\n/g, '<br />')}</p>`
          : ''
      }
      ${
        details.description
          ? `<p><strong>Beschreibung:</strong><br />${details.description.replace(/\n/g, '<br />')}</p>`
          : ''
      }
      ${
        room.info_document_url
          ? `<p><a href="${room.info_document_url}" target="_blank" rel="noreferrer">Infodokument öffnen</a></p>`
          : ''
      }
    `;
    await sendEmailNotification(room.booking_notify_email, subject, html);
  };

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

  const loadResourceGroups = async () => {
    try {
      let query = supabase.from('room_resource_groups').select('*, organization:organizations(name)').order('name');
      if (profile?.role !== 'SUPER_ADMIN' && profile?.organization_id) {
        query = query.eq('organization_id', profile.organization_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setResourceGroups((data as RoomResourceGroup[]) ?? []);
    } catch (error) {
      console.error('Error loading resource groups', error);
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

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    loadBookings(currentMonth);
  }, [currentMonth]);

  useEffect(() => {
    loadResourceGroups();
  }, [profile?.role, profile?.organization_id]);

  useEffect(() => {
    if (profile?.role !== 'SUPER_ADMIN') return;
    let ignore = false;
    const fetchOrganizations = async () => {
      try {
        const { data, error } = await supabase.from('organizations').select('id, name').order('name');
        if (error) throw error;
        if (!ignore) {
          setOrganizations(data ?? []);
        }
      } catch (error) {
        console.error('Error loading organizations', error);
      }
    };
    void fetchOrganizations();
    return () => {
      ignore = true;
    };
  }, [profile?.role]);

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
        chairs_capacity: room.chairs_capacity?.toString() ?? '',
        chairs_default: room.chairs_default?.toString() ?? '',
        tables_capacity: room.tables_capacity?.toString() ?? '',
        tables_default: room.tables_default?.toString() ?? '',
        notify_on_booking: room.notify_on_booking ?? false,
        booking_notify_email: room.booking_notify_email ?? '',
        info_document_url: room.info_document_url ?? '',
        resource_group_id: room.resource_group_id ?? null,
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        ...emptyRoomForm,
        is_active: true,
        resource_group_id: null,
      });
    }
    setRoomDocumentFile(null);
    setRemoveRoomDocument(false);
    setRoomDialogOpen(true);
  };

  const openGroupDialog = (group?: RoomResourceGroup) => {
    if (!isRoomAdmin) return;
    if (group) {
      setEditingGroup(group);
      setGroupForm({
        name: group.name,
        tables_total: group.tables_total?.toString() ?? '',
        chairs_total: group.chairs_total?.toString() ?? '',
        whiteboards_total: group.whiteboards_total?.toString() ?? '',
        organization_id: group.organization_id ?? resolveDefaultGroupOrganization(),
      });
    } else {
      setEditingGroup(null);
      setGroupForm({
        ...emptyGroupForm,
        organization_id: resolveDefaultGroupOrganization(),
      });
    }
    setGroupDialogOpen(true);
  };

  const resolveActiveRoomId = () => {
    if (selectedRoomId) return selectedRoomId;
    const fallback = rooms.find((room) => room.is_active)?.id ?? rooms[0]?.id ?? null;
    if (fallback) {
      setSelectedRoomId(fallback);
    }
    return fallback;
  };

  const openBookingDialog = (booking?: Booking, options?: { roomId?: string; start?: Date; end?: Date }) => {
    const targetRoomId = options?.roomId ?? resolveActiveRoomId();
    if (!targetRoomId) {
      toast.error('Es stehen aktuell keine Räume zur Verfügung.');
      return;
    }
    const targetRoom = rooms.find((room) => room.id === targetRoomId) ?? null;
    const targetGroup = targetRoom?.resource_group_id
      ? resourceGroups.find((group) => group.id === targetRoom.resource_group_id) ?? null
      : null;
    const defaultChairsValue =
      targetRoom?.chairs_default ?? targetRoom?.chairs_capacity ?? null;
    const defaultTablesValue =
      targetRoom?.tables_default ?? targetRoom?.tables_capacity ?? null;
    const defaultWhiteboardsValue = targetGroup?.whiteboards_total ?? null;
    setSelectedRoomId(targetRoomId);
    const now = new Date();
    let inferredStart: Date | null = null;
    if (!options?.start) {
      const activeBooking = bookings.find((booking) => {
        if (booking.room_id !== targetRoomId) return false;
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        return start <= now && end > now;
      });
      if (activeBooking) {
        const bookingEnd = new Date(activeBooking.end_time);
        inferredStart = bookingEnd > now ? bookingEnd : now;
      }
    }
    if (booking) {
      setEditingBooking(booking);
      setBookingForm({
        title: booking.title,
        description: booking.description ?? '',
        start: booking.start_time.slice(0, 16),
        end: booking.end_time.slice(0, 16),
        expected_attendees: booking.expected_attendees?.toString() ?? '',
        chairs_needed: booking.chairs_needed?.toString() ?? '',
        tables_needed: booking.tables_needed?.toString() ?? '',
        whiteboards_needed: booking.whiteboards_needed?.toString() ?? '',
        requires_catering: booking.requires_catering ?? false,
        catering_details: booking.catering_details ?? '',
      });
    } else {
      setEditingBooking(null);
      const startDate = options?.start ?? inferredStart ?? now;
      const endDate = options?.end ?? addHours(startDate, 1);
      setBookingForm({
        title: '',
        description: '',
        start: format(startDate, "yyyy-MM-dd'T'HH:mm"),
        end: format(endDate, "yyyy-MM-dd'T'HH:mm"),
        expected_attendees: '',
        chairs_needed: defaultChairsValue !== null ? String(defaultChairsValue) : '',
        tables_needed: defaultTablesValue !== null ? String(defaultTablesValue) : '',
        whiteboards_needed: defaultWhiteboardsValue !== null ? String(defaultWhiteboardsValue) : '',
        requires_catering: false,
        catering_details: '',
      });
    }
    setBookingDialogOpen(true);
  };

  const handleRoomFormChange = (field: keyof typeof roomForm, value: string | boolean | null) => {
    setRoomForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBookingFormChange = (field: keyof typeof bookingForm, value: string | boolean) => {
    setBookingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleGroupFormChange = (field: keyof typeof groupForm, value: string | null) => {
    setGroupForm((prev) => ({ ...prev, [field]: value }));
  };

  const ensureGroupResourcesAvailable = async (
    group: RoomResourceGroup,
    request: { tables?: number | null; chairs?: number | null; whiteboards?: number | null },
    startIso: string,
    endIso: string,
  ) => {
    const needsValidation: Array<{
      total: number | null | undefined;
      requested: number | null | undefined;
      label: string;
      key: 'tables_needed' | 'chairs_needed' | 'whiteboards_needed';
    }> = [
      { total: group.tables_total, requested: request.tables, label: 'Tische', key: 'tables_needed' },
      { total: group.chairs_total, requested: request.chairs, label: 'Stühle', key: 'chairs_needed' },
      { total: group.whiteboards_total, requested: request.whiteboards, label: 'Whiteboards', key: 'whiteboards_needed' },
    ].filter((item) => item.total && item.total > 0 && item.requested && item.requested > 0);

    if (needsValidation.length === 0) {
      return true;
    }

    const groupRoomIds = rooms.filter((room) => room.resource_group_id === group.id).map((room) => room.id);
    if (groupRoomIds.length === 0) {
      return true;
    }
    const { data, error } = await supabase
      .from('room_bookings')
      .select('id, tables_needed, chairs_needed, whiteboards_needed, start_time, end_time')
      .in('room_id', groupRoomIds)
      .lt('start_time', endIso)
      .gt('end_time', startIso);
    if (error) {
      console.error('Error validating shared tables', error);
      toast.error('Die gemeinsamen Ressourcen konnten nicht geprüft werden.');
      return false;
    }
    const overlapping = (data ?? []).filter((row) => !editingBooking || row.id !== editingBooking.id);
    for (const item of needsValidation) {
      const used = overlapping.reduce((sum, row) => sum + (row[item.key] ?? 0), 0);
      const available = (item.total ?? 0) - used;
      if ((item.requested ?? 0) > available) {
        toast.error(`Im Pool "${group.name}" sind nur noch ${Math.max(available, 0)} ${item.label} verfügbar.`);
        return false;
      }
    }
    return true;
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
    if (roomForm.notify_on_booking) {
      const email = roomForm.booking_notify_email.trim();
      if (!email || !email.includes('@')) {
        toast.error('Bitte eine gültige Benachrichtigungsadresse hinterlegen.');
        return;
      }
    }

    setSavingRoom(true);
    let infoDocumentUrl = roomForm.info_document_url || null;
    try {
      if (removeRoomDocument) {
        infoDocumentUrl = null;
      }
      if (roomDocumentFile) {
        infoDocumentUrl = await uploadRoomDocument(roomDocumentFile);
      }
    } catch (error) {
      console.error('Error uploading document', error);
      toast.error('Infodokument konnte nicht hochgeladen werden.');
      setSavingRoom(false);
      return;
    }

    const commonPayload = {
      name: roomForm.name.trim(),
      location: roomForm.location.trim() || null,
      description: roomForm.description.trim() || null,
      capacity: roomForm.capacity ? Number(roomForm.capacity) : null,
      equipment: roomForm.equipment.trim() || null,
      is_active: roomForm.is_active,
      chairs_capacity: numberOrNull(roomForm.chairs_capacity),
      chairs_default: numberOrNull(roomForm.chairs_default),
      tables_capacity: numberOrNull(roomForm.tables_capacity),
      tables_default: numberOrNull(roomForm.tables_default),
      notify_on_booking: roomForm.notify_on_booking,
      booking_notify_email: roomForm.notify_on_booking ? roomForm.booking_notify_email.trim() || null : null,
      info_document_url: infoDocumentUrl,
      resource_group_id: roomForm.resource_group_id,
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
      setRoomDocumentFile(null);
      setRemoveRoomDocument(false);
      setRoomForm(emptyRoomForm);
      loadRooms();
    } catch (error) {
      console.error('Error saving room', error);
      toast.error('Raum konnte nicht gespeichert werden.');
    } finally {
      setSavingRoom(false);
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isRoomAdmin) return;
    if (!groupForm.name.trim()) {
      toast.error('Bitte einen Namen für den Pool angeben.');
      return;
    }
    const tablesTotal = groupForm.tables_total ? Number(groupForm.tables_total) : null;
    const chairsTotal = groupForm.chairs_total ? Number(groupForm.chairs_total) : null;
    const whiteboardsTotal = groupForm.whiteboards_total ? Number(groupForm.whiteboards_total) : null;
    const targetOrgId =
      profile?.role === 'SUPER_ADMIN'
        ? groupForm.organization_id ?? resolveDefaultGroupOrganization()
        : profile?.organization_id ?? null;
    if (!targetOrgId) {
      toast.error('Bitte wähle eine Organisation für den Pool aus.');
      return;
    }
    setSavingGroup(true);
    try {
      const payload = {
        name: groupForm.name.trim(),
        tables_total: tablesTotal,
        chairs_total: chairsTotal,
        whiteboards_total: whiteboardsTotal,
        organization_id: targetOrgId,
      };
      if (editingGroup) {
        const { error } = await supabase.from('room_resource_groups').update(payload).eq('id', editingGroup.id);
        if (error) throw error;
        toast.success('Pool aktualisiert');
      } else {
        const { error } = await supabase.from('room_resource_groups').insert(payload);
        if (error) throw error;
        toast.success('Pool angelegt');
      }
      setGroupDialogOpen(false);
      setEditingGroup(null);
      setGroupForm({
        ...emptyGroupForm,
        organization_id: resolveDefaultGroupOrganization(),
      });
      loadResourceGroups();
    } catch (error) {
      console.error('Error saving resource group', error);
      toast.error('Pool konnte nicht gespeichert werden.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !selectedRoomId) {
      toast.error('Bitte melde Dich an und wähle einen Raum aus.');
      return;
    }
    if (!selectedRoom) {
      toast.error('Der ausgewählte Raum ist nicht mehr verfügbar.');
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
    const expectedAttendees = numberOrNull(bookingForm.expected_attendees);
    const chairsNeeded = numberOrNull(bookingForm.chairs_needed);
    const tablesNeeded = numberOrNull(bookingForm.tables_needed);
    const whiteboardsNeeded = numberOrNull(bookingForm.whiteboards_needed);

    if (selectedRoom.capacity && expectedAttendees && expectedAttendees > selectedRoom.capacity) {
      toast.error(`Es sind maximal ${selectedRoom.capacity} Personen zugelassen.`);
      return;
    }
    if (selectedRoom.chairs_capacity && chairsNeeded && chairsNeeded > selectedRoom.chairs_capacity) {
      toast.error(`Es sind nur ${selectedRoom.chairs_capacity} Stühle verfügbar.`);
      return;
    }
    if (selectedRoom.tables_capacity && tablesNeeded && tablesNeeded > selectedRoom.tables_capacity) {
      toast.error(`Es sind nur ${selectedRoom.tables_capacity} Tische verfügbar.`);
      return;
    }

    const startDate = new Date(bookingForm.start);
    const endDate = new Date(bookingForm.end);
    if (selectedGroup) {
      const groupOk = await ensureGroupResourcesAvailable(
        selectedGroup,
        { tables: tablesNeeded, chairs: chairsNeeded, whiteboards: whiteboardsNeeded },
        startDate.toISOString(),
        endDate.toISOString(),
      );
      if (!groupOk) {
        return;
      }
    }

    const payload = {
      room_id: selectedRoomId,
      title: bookingForm.title.trim(),
      description: bookingForm.description.trim() || null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      organization_id: profile.organization_id,
      expected_attendees: expectedAttendees,
      chairs_needed: chairsNeeded,
      tables_needed: tablesNeeded,
      whiteboards_needed: whiteboardsNeeded,
      requires_catering: bookingForm.requires_catering,
      catering_details: bookingForm.requires_catering ? bookingForm.catering_details.trim() || null : null,
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
      if (selectedRoom.notify_on_booking && selectedRoom.booking_notify_email) {
        void notifyRoomBookingContact(selectedRoom, {
          title: payload.title,
          start: startDate,
          end: endDate,
          description: payload.description,
          expectedAttendees,
          chairsNeeded,
          tablesNeeded,
          whiteboardsNeeded,
          organizer: profile.name ?? null,
          organization: profile.organization?.name ?? null,
          cateringNeeded: payload.requires_catering,
          cateringDetails: payload.catering_details,
        });
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

  const roomsByGroup = useMemo(() => {
    const map = new Map<string, Room[]>();
    rooms.forEach((room) => {
      if (!room.resource_group_id) return;
      if (!map.has(room.resource_group_id)) {
        map.set(room.resource_group_id, []);
      }
      map.get(room.resource_group_id)?.push(room);
    });
    return map;
  }, [rooms]);

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


  const handleSelectRoom = (roomId: string, closePanel = false) => {
    setSelectedRoomId(roomId);
    if (closePanel) {
      setRoomsSheetOpen(false);
    }
  };

  const handleTimelineQuickBooking = () => {
    openBookingDialog();
  };

  const handleTimelineSlotSelect = (roomId: string, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const totalMinutes = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
    const offsetMinutes = Math.round((ratio * totalMinutes) / 15) * 15;
    const start = addMinutes(startOfDay(selectedDay), TIMELINE_START_HOUR * 60 + offsetMinutes);
    const end = addMinutes(start, 60);
    openBookingDialog(undefined, { roomId, start, end });
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
              <Button variant="outline" size="sm" onClick={() => openRoomDialog()} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Raum anlegen
              </Button>
            )}
            {isRoomAdmin && (
              <Button variant="outline" size="sm" onClick={() => openGroupDialog()} className="w-full sm:w-auto">
                <Layers className="mr-2 h-4 w-4" />
                Pool anlegen
              </Button>
            )}
            <Button
              variant="default"
              onClick={() => openBookingDialog()}
              disabled={!selectedRoomId}
              className="w-full sm:w-auto font-semibold"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Raum buchen
            </Button>
          </div>
        </div>

        {selectedRoom && (
          <Card className="rounded-3xl border border-border/60 bg-gradient-to-br from-card to-muted/40 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Aktiver Raum</p>
                <CardTitle className="text-2xl font-semibold leading-tight">{selectedRoom.name}</CardTitle>
                {selectedRoom.description && (
                  <p className="text-sm text-muted-foreground max-w-2xl">{selectedRoom.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selectedRoom.location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      <MapPin className="h-3 w-3" />
                      {selectedRoom.location}
                    </span>
                  )}
                  {selectedRoom.capacity && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      <Users className="h-3 w-3" />
                      bis {selectedRoom.capacity} Personen
                    </span>
                  )}
                  {selectedRoom.equipment && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Ausstattung: {selectedRoom.equipment}
                    </span>
                  )}
                  {(selectedRoom.chairs_default ?? selectedRoom.chairs_capacity) !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Stühle: {selectedRoom.chairs_default ?? '–'} / {selectedRoom.chairs_capacity ?? '–'}
                    </span>
                  )}
                  {(selectedRoom.tables_default ?? selectedRoom.tables_capacity) !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Tische: {selectedRoom.tables_default ?? '–'} / {selectedRoom.tables_capacity ?? '–'}
                    </span>
                  )}
                  {selectedGroup && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Pool: {selectedGroup.name}
                      <span className="text-xs text-muted-foreground">
                        {[
                          typeof selectedGroup.tables_total === 'number' ? `${selectedGroup.tables_total} Tische` : null,
                          typeof selectedGroup.chairs_total === 'number' ? `${selectedGroup.chairs_total} Stühle` : null,
                          typeof selectedGroup.whiteboards_total === 'number' ? `${selectedGroup.whiteboards_total} Whiteboards` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Badge variant={selectedRoom.is_active ? 'secondary' : 'outline'} className="w-full justify-center sm:w-auto">
                  {selectedRoom.is_active ? 'Verfügbar' : 'Inaktiv'}
                </Badge>
                <Button size="sm" onClick={() => openBookingDialog()}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Sofort buchen
                </Button>
                {selectedRoom.info_document_url && (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={selectedRoom.info_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Infodokument
                    </a>
                  </Button>
                )}
                {selectedRoom.public_share_token && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" variant="outline" onClick={copyPublicLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Link kopieren
                    </Button>
                    {publicRoomLink && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={publicRoomLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                          <Share2 className="h-4 w-4" />
                          Öffnen
                        </a>
                      </Button>
                    )}
                  </div>
                )}
                {isRoomAdmin && (
                  <Button size="sm" variant="outline" onClick={() => openRoomDialog(selectedRoom)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Bearbeiten
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isRoomAdmin && (
          <Card className="border border-dashed border-border/70 bg-card/60">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Ressourcenpools</CardTitle>
                <CardDescription>Verwalte gemeinsame Tische, Stühle und Whiteboards Deiner Organisation.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => openGroupDialog()}>
                <Layers className="mr-2 h-4 w-4" />
                Pool hinzufügen
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {resourceGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Pools vorhanden. Lege einen Pool an und ordne Räume im Dialog zu.
                </p>
              ) : (
                resourceGroups.map((group) => {
                  const assignedRooms = roomsByGroup.get(group.id) ?? [];
                  return (
                    <div
                      key={group.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {[
                            typeof group.tables_total === 'number' ? `${group.tables_total} Tische` : null,
                            typeof group.chairs_total === 'number' ? `${group.chairs_total} Stühle` : null,
                            typeof group.whiteboards_total === 'number' ? `${group.whiteboards_total} Whiteboards` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Keine Ressourcenbegrenzung hinterlegt'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Zugewiesene Räume: {assignedRooms.length > 0 ? assignedRooms.map((room) => room.name).join(', ') : 'keine'}
                        </p>
                        {group.organization?.name && (
                          <p className="text-xs text-muted-foreground">Organisation: {group.organization.name}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{assignedRooms.length} Räume</Badge>
                        <Button size="sm" variant="outline" onClick={() => openGroupDialog(group)}>
                          Bearbeiten
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

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
              <CardHeader className="space-y-4">
                <div className="space-y-1">
                  <CardTitle>Kalenderübersicht</CardTitle>
                  <CardDescription>
                    {selectedRoom ? `${selectedRoom.name} · ${format(currentMonth, 'MMMM yyyy', { locale: de })}` : 'Bitte Raum auswählen'}
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
                      &larr;
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
                      &rarr;
                    </Button>
                  </div>
                  <div className="flex w-full flex-col gap-2 lg:w-72">
                    <Select value={selectedRoomId ?? undefined} onValueChange={(value) => handleSelectRoom(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Raum auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setRoomsSheetOpen(true)}>
                      <Search className="mr-2 h-4 w-4" />
                      Erweiterte Suche
                    </Button>
                  </div>
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
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-xl border bg-border text-sm lg:text-base">
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
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Zeitstrahl</CardTitle>
                  <CardDescription>Buchungen am {format(selectedDay, 'dd.MM.yyyy', { locale: de })} auf einen Blick.</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    type="date"
                    className="w-full sm:w-auto"
                    value={format(selectedDay, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setSelectedDay(startOfDay(new Date(e.target.value)));
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={handleTimelineQuickBooking}>
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Neue Buchung
                  </Button>
                </div>
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
                  <div className="overflow-x-auto">
                    <div className="min-w-[720px] space-y-6">
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
                              <div
                                className="relative h-24 rounded-xl border bg-muted/30 px-3 py-2 cursor-pointer"
                                onClick={(event) => handleTimelineSlotSelect(room.id, event)}
                              >
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
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openBookingDialog(booking);
                                        }}
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
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {typeof booking.expected_attendees === 'number' && (
                            <span className="rounded-full bg-muted px-2 py-1">
                              {booking.expected_attendees} Personen
                            </span>
                          )}
                          {typeof booking.chairs_needed === 'number' && (
                            <span className="rounded-full bg-muted px-2 py-1">
                              {booking.chairs_needed} Stühle
                            </span>
                          )}
                        {typeof booking.tables_needed === 'number' && (
                          <span className="rounded-full bg-muted px-2 py-1">
                            {booking.tables_needed} Tische
                          </span>
                        )}
                        {booking.requires_catering && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary">
                            <Droplet className="h-3 w-3" />
                            Catering
                          </span>
                        )}
                      </div>
                      {booking.requires_catering && booking.catering_details && (
                        <p className="text-xs text-muted-foreground">
                          Wunsch: {booking.catering_details}
                        </p>
                      )}
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

      <Dialog
        open={roomDialogOpen}
        onOpenChange={(open) => {
          setRoomDialogOpen(open);
          if (!open) {
            setEditingRoom(null);
            setRoomForm(emptyRoomForm);
            setRoomDocumentFile(null);
            setRemoveRoomDocument(false);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="room-chairs-default">Stühle (Standardaufbau)</Label>
                <Input
                  id="room-chairs-default"
                  type="number"
                  min="0"
                  value={roomForm.chairs_default}
                  onChange={(e) => handleRoomFormChange('chairs_default', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-chairs-capacity">Stühle (maximal)</Label>
                <Input
                  id="room-chairs-capacity"
                  type="number"
                  min="0"
                  value={roomForm.chairs_capacity}
                  onChange={(e) => handleRoomFormChange('chairs_capacity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-tables-default">Tische (Standardaufbau)</Label>
                <Input
                  id="room-tables-default"
                  type="number"
                  min="0"
                  value={roomForm.tables_default}
                  onChange={(e) => handleRoomFormChange('tables_default', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-tables-capacity">Tische (maximal)</Label>
                <Input
                  id="room-tables-capacity"
                  type="number"
                  min="0"
                  value={roomForm.tables_capacity}
                  onChange={(e) => handleRoomFormChange('tables_capacity', e.target.value)}
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
            <div className="space-y-2">
              <Label>Ressourcenpool</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={roomForm.resource_group_id ?? 'none'}
                  onValueChange={(value) => handleRoomFormChange('resource_group_id', value === 'none' ? null : value)}
                >
                  <SelectTrigger className="sm:w-64">
                    <SelectValue placeholder="Pool auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Pool</SelectItem>
                    {resourceGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} {typeof group.tables_total === 'number' ? `(${group.tables_total} Tische)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isRoomAdmin && (
                  <Button type="button" variant="outline" size="sm" onClick={() => openGroupDialog()}>
                    <Layers className="mr-2 h-4 w-4" />
                    Pool anlegen
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Pools definieren die gemeinsame Tischanzahl mehrerer Räume.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-document">Infodokument (PDF)</Label>
              <Input
                id="room-document"
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setRoomDocumentFile(file);
                  setRemoveRoomDocument(false);
                }}
              />
              {roomDocumentFile && <p className="text-xs text-muted-foreground">Ausgewählt: {roomDocumentFile.name}</p>}
              {roomForm.info_document_url && !removeRoomDocument && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <a
                    href={roomForm.info_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Aktuelles Dokument öffnen
                  </a>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRemoveRoomDocument(true);
                      handleRoomFormChange('info_document_url', '');
                    }}
                  >
                    Entfernen
                  </Button>
                </div>
              )}
              {removeRoomDocument && (
                <p className="text-xs text-destructive">Das bestehende Dokument wird entfernt.</p>
              )}
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
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">E-Mail bei Buchungen senden</p>
                  <p className="text-sm text-muted-foreground">Informiert automatisch eine Kontaktadresse.</p>
                </div>
                <Switch
                  checked={roomForm.notify_on_booking}
                  onCheckedChange={(checked) => handleRoomFormChange('notify_on_booking', checked)}
                />
              </div>
            </div>
            {roomForm.notify_on_booking && (
              <div className="space-y-2">
                <Label htmlFor="room-notify-email">Empfängeradresse</Label>
                <Input
                  id="room-notify-email"
                  type="email"
                  placeholder="office@example.com"
                  value={roomForm.booking_notify_email}
                  onChange={(e) => handleRoomFormChange('booking_notify_email', e.target.value)}
                  required
                />
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={savingRoom}>
                {savingRoom ? 'Speichert...' : editingRoom ? 'Aktualisieren' : 'Anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bookingDialogOpen}
        onOpenChange={(open) => {
          setBookingDialogOpen(open);
          if (!open) {
            setEditingBooking(null);
            setBookingForm(emptyBookingForm);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBooking ? 'Buchung bearbeiten' : 'Neue Buchung erstellen'}</DialogTitle>
          </DialogHeader>
          {selectedRoom?.info_document_url && (
            <div className="mb-2 flex flex-col gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
              <p>Infodokument für {selectedRoom.name}</p>
              <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                <a href={selectedRoom.info_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PDF öffnen
                </a>
              </Button>
            </div>
          )}
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
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="booking-expected">Erwartete Personen</Label>
                <Input
                  id="booking-expected"
                  type="number"
                  min="0"
                  value={bookingForm.expected_attendees}
                  onChange={(e) => handleBookingFormChange('expected_attendees', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-chairs">Stühle benötigt</Label>
                <Input
                  id="booking-chairs"
                  type="number"
                  min="0"
                  value={bookingForm.chairs_needed}
                  onChange={(e) => handleBookingFormChange('chairs_needed', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-tables">Tische benötigt</Label>
                <Input
                  id="booking-tables"
                  type="number"
                  min="0"
                  value={bookingForm.tables_needed}
                  onChange={(e) => handleBookingFormChange('tables_needed', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booking-whiteboards">Whiteboards benötigt</Label>
                <Input
                  id="booking-whiteboards"
                  type="number"
                  min="0"
                  value={bookingForm.whiteboards_needed}
                  onChange={(e) => handleBookingFormChange('whiteboards_needed', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Catering benötigt?</p>
                  <p className="text-sm text-muted-foreground">
                    Aktiviere diese Option, wenn ein Catering oder Getränke-Service vorbereitet werden soll.
                  </p>
                </div>
                <Switch
                  checked={bookingForm.requires_catering}
                  onCheckedChange={(checked) => handleBookingFormChange('requires_catering', checked)}
                />
              </div>
              {bookingForm.requires_catering && (
                <div className="space-y-2">
                  <Label htmlFor="booking-catering-details">Catering-Wunsch</Label>
                  <Textarea
                    id="booking-catering-details"
                    rows={3}
                    placeholder="z. B. Kaffee & Tee, Gebäck, vegetarische Snacks …"
                    value={bookingForm.catering_details}
                    onChange={(e) => handleBookingFormChange('catering_details', e.target.value)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingBooking}>
                {savingBooking ? 'Speichert...' : editingBooking ? 'Aktualisieren' : 'Buchen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={groupDialogOpen}
        onOpenChange={(open) => {
          setGroupDialogOpen(open);
          if (!open) {
            setEditingGroup(null);
            setGroupForm({
              ...emptyGroupForm,
              organization_id: resolveDefaultGroupOrganization(),
            });
          }
        }}
      >
        <DialogContent className="max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Pool bearbeiten' : 'Neuen Pool anlegen'}</DialogTitle>
            <DialogDescription>Lege fest, welche Ressourcen mehrere Räume gemeinsam nutzen können.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveGroup}>
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => handleGroupFormChange('name', e.target.value)}
                required
              />
            </div>
            {profile?.role === 'SUPER_ADMIN' && (
              <div className="space-y-2">
                <Label>Organisation</Label>
                <Select
                  value={groupForm.organization_id ?? 'none'}
                  onValueChange={(value) => handleGroupFormChange('organization_id', value === 'none' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Organisation wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine Auswahl</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name ?? 'Ohne Namen'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Org-Admins sehen nur Pools ihrer eigenen Organisation.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Gesamtressourcen</Label>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Input
                    id="group-tables"
                    type="number"
                    min="0"
                    placeholder="Tische"
                    value={groupForm.tables_total}
                    onChange={(e) => handleGroupFormChange('tables_total', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Gesamtzahl Tische im Pool.</p>
                </div>
                <div className="space-y-2">
                  <Input
                    id="group-chairs"
                    type="number"
                    min="0"
                    placeholder="Stühle"
                    value={groupForm.chairs_total}
                    onChange={(e) => handleGroupFormChange('chairs_total', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional: Gesamtzahl Stühle.</p>
                </div>
                <div className="space-y-2">
                  <Input
                    id="group-whiteboards"
                    type="number"
                    min="0"
                    placeholder="Whiteboards"
                    value={groupForm.whiteboards_total}
                    onChange={(e) => handleGroupFormChange('whiteboards_total', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional: Gesamtzahl Whiteboards.</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingGroup}>
                {savingGroup ? 'Speichert...' : editingGroup ? 'Aktualisieren' : 'Anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
