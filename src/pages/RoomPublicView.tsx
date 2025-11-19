import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarDays, Users, MapPin, FileText, Droplet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type RoomRow = Tables<'rooms'> & {
  organization?: {
    name: string | null;
  } | null;
};

type PublicBooking = Tables<'room_bookings'> & {
  creator?: {
    name: string | null;
  } | null;
};

export default function RoomPublicView() {
  const { token } = useParams<{ token: string }>();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [bookings, setBookings] = useState<PublicBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*, organization:organizations(name)')
          .eq('public_share_token', token)
          .maybeSingle();
        if (roomError) throw roomError;
        if (!roomData) {
          setError('Der Raum wurde nicht gefunden.');
          setRoom(null);
          setBookings([]);
          return;
        }
        setRoom(roomData as RoomRow);

        const now = new Date().toISOString();
        const { data: bookingData, error: bookingError } = await supabase
          .from('room_bookings')
          .select('*, creator:profiles!room_bookings_created_by_fkey(name)')
          .eq('room_id', roomData.id)
          .gte('end_time', now)
          .order('start_time');
        if (bookingError) throw bookingError;
        setBookings((bookingData as PublicBooking[]) ?? []);
      } catch (err) {
        console.error('Public room view failed', err);
        setError('Die Raumdaten konnten nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [token]);

  const nowTs = Date.now();
  const currentBooking =
    bookings.find(
      (booking) =>
        new Date(booking.start_time).getTime() <= nowTs && new Date(booking.end_time).getTime() >= nowTs,
    ) ?? null;
  const upcomingBookings = bookings.filter((booking) => new Date(booking.start_time).getTime() > nowTs);

  const totalChairs = room?.chairs_default ?? room?.chairs_capacity ?? null;
  const totalTables = room?.tables_default ?? room?.tables_capacity ?? null;
  const chairsRemaining =
    totalChairs !== null ? Math.max(totalChairs - (currentBooking?.chairs_needed ?? 0), 0) : null;
  const tablesRemaining =
    totalTables !== null ? Math.max(totalTables - (currentBooking?.tables_needed ?? 0), 0) : null;

  return (
    <Layout>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{room ? room.name : 'Raum-Übersicht'}</CardTitle>
            <CardDescription>
              {room
                ? room.organization?.name
                  ? `Bereitgestellt von ${room.organization.name}`
                  : 'Öffentliche Raumansicht'
                : 'Details werden geladen...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lädt Raumdaten...
              </div>
            )}
            {error && <p className="text-destructive">{error}</p>}
            {room && !loading && !error && (
              <>
                <div className="flex flex-wrap gap-2 text-muted-foreground">
                  {room.location && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      <MapPin className="h-3 w-3" />
                      {room.location}
                    </span>
                  )}
                  {room.capacity && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      <Users className="h-3 w-3" />
                      bis {room.capacity} Personen
                    </span>
                  )}
                  {(room.chairs_default ?? room.chairs_capacity) !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Stühle: {room.chairs_default ?? '–'} / {room.chairs_capacity ?? '–'}
                    </span>
                  )}
                  {(room.tables_default ?? room.tables_capacity) !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      Tische: {room.tables_default ?? '–'} / {room.tables_capacity ?? '–'}
                    </span>
                  )}
                  {room.requires_beverage_catering && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
                      <Droplet className="h-3 w-3" />
                      Getränke-Catering
                    </span>
                  )}
                </div>
                {room.description && <p className="text-base text-foreground">{room.description}</p>}
                {room.info_document_url && (
                  <Button variant="outline" size="sm" asChild className="inline-flex w-full sm:w-auto">
                    <a href={room.info_document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Infodokument öffnen
                    </a>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {room && (
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Belegung</CardTitle>
              <CardDescription>Zeitraum, Ansprechpartner und verfügbare Ausstattung.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentBooking ? (
                <>
                  <Badge variant="destructive">Belegt</Badge>
                  <p className="text-lg font-semibold">{currentBooking.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(currentBooking.start_time), 'dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                    {format(new Date(currentBooking.end_time), 'HH:mm', { locale: de })} Uhr
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ansprechpartner: {currentBooking.creator?.name ?? 'unbekannt'}
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {currentBooking.expected_attendees !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">
                        {currentBooking.expected_attendees} Personen
                      </span>
                    )}
                    {currentBooking.chairs_needed !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">
                        {currentBooking.chairs_needed} Stühle benötigt
                      </span>
                    )}
                    {currentBooking.tables_needed !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">
                        {currentBooking.tables_needed} Tische benötigt
                      </span>
                    )}
                  </div>
                  {(chairsRemaining !== null || tablesRemaining !== null) && (
                    <div className="rounded-lg border border-dashed p-3 text-sm">
                      <p className="font-medium">Verfügbare Ausstattung während dieser Buchung</p>
                      <p className="text-muted-foreground">
                        {chairsRemaining !== null ? `${chairsRemaining} Stühle` : 'Stühle nicht definiert'} ·{' '}
                        {tablesRemaining !== null ? `${tablesRemaining} Tische` : 'Tische nicht definiert'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <Badge variant="secondary">Frei</Badge>
                  <p className="text-sm text-muted-foreground">
                    Der Raum ist aktuell frei und kann gebucht werden.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Kommende Termine</CardTitle>
            <CardDescription>Wer hat den Raum reserviert?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine weiteren Buchungen geplant.</p>
            ) : (
              upcomingBookings.slice(0, 8).map((booking) => (
                <div key={booking.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <p className="font-medium">
                      {format(new Date(booking.start_time), 'dd.MM.yyyy HH:mm', { locale: de })} –{' '}
                      {format(new Date(booking.end_time), 'HH:mm', { locale: de })} Uhr
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{booking.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {booking.creator?.name ? `Kontakt: ${booking.creator.name}` : 'Kein Ansprechpartner hinterlegt'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {booking.expected_attendees !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">{booking.expected_attendees} Personen</span>
                    )}
                    {booking.chairs_needed !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">{booking.chairs_needed} Stühle</span>
                    )}
                    {booking.tables_needed !== null && (
                      <span className="rounded-full bg-muted px-2 py-1">{booking.tables_needed} Tische</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          <p>
            Du benötigst Zugriff auf weitere Funktionen?{' '}
            <Link to="/login" className="text-primary underline">
              Hier anmelden
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
