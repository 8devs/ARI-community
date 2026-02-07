import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CalendarDays, Users, MapPin, FileText, Droplet } from 'lucide-react';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface RoomRow {
  id: string;
  name: string;
  organization_id: string | null;
  capacity: number | null;
  chairs_capacity: number | null;
  tables_capacity: number | null;
  chairs_default: number | null;
  tables_default: number | null;
  location: string | null;
  description: string | null;
  equipment: string | null;
  info_document_url: string | null;
  public_share_token: string | null;
  requires_beverage_catering: boolean | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
  organization?: { name: string | null } | null;
}

interface PublicBooking {
  id: string;
  room_id: string;
  title: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  expected_attendees: number | null;
  chairs_needed: number | null;
  tables_needed: number | null;
  requires_catering: boolean | null;
  catering_details: string | null;
  created_at: string;
  creator?: { id: string; name: string | null } | null;
}

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
        const roomResult = await api.query<{ data: RoomRow }>('/api/rooms/public/' + token);
        const rpcRoom = roomResult.data ?? null;
        if (!rpcRoom) {
          setError('Der Raum wurde nicht gefunden.');
          setRoom(null);
          setBookings([]);
          return;
        }
        setRoom(rpcRoom);

        const bookingsResult = await api.query<{ data: PublicBooking[] }>('/api/rooms/public/' + token + '/bookings');
        const now = new Date();
        const allBookings = bookingsResult.data ?? [];
        const futureBookings = allBookings.filter((booking) => new Date(booking.end_time) >= now);
        setBookings(futureBookings);
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
                  {currentBooking.requires_catering && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium text-primary">
                        <Droplet className="h-4 w-4" />
                        Catering angefragt
                      </div>
                      {currentBooking.catering_details && (
                        <p className="mt-1 text-muted-foreground">{currentBooking.catering_details}</p>
                      )}
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
                    {booking.requires_catering && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary">
                        <Droplet className="h-3 w-3" />
                        Catering
                      </span>
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
