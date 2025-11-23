import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  MapPin,
  Phone,
  Globe,
  Mail,
  FileText,
  Star,
  Navigation,
  Plus,
  Filter,
  UtensilsCrossed,
  MapPinned,
  Compass,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import L, { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LunchPlace = Tables<'lunch_places'> & { open_days?: string[] | null };
type Profile = Tables<'profiles'>;
type LunchReview = Tables<'lunch_reviews'> & {
  profiles?: Profile | null;
};

const cuisineOptions = [
  'Hausmannskost',
  'Mediterran',
  'Asiatisch',
  'Italienisch',
  'Vegetarisch',
  'Vegan',
  'Burger & Bowls',
  'Bäckerei',
];

const weekdayOptions = [
  { value: 'monday', label: 'Montag' },
  { value: 'tuesday', label: 'Dienstag' },
  { value: 'wednesday', label: 'Mittwoch' },
  { value: 'thursday', label: 'Donnerstag' },
  { value: 'friday', label: 'Freitag' },
  { value: 'saturday', label: 'Samstag' },
  { value: 'sunday', label: 'Sonntag' },
];

const weekdayLabel = (value: string) => weekdayOptions.find((day) => day.value === value)?.label ?? value;
const jsDayToValue = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const CAMPUS_COORDS: [number, number] = [49.633342, 8.361155];
const CAMPUS_ADDRESS = 'Adenauerring 1, 67547 Worms';
const CAMPUS_LABEL = 'ARI Campus';
const CAMPUS_ROUTE_PART = `${CAMPUS_COORDS[0].toFixed(5)},${CAMPUS_COORDS[1].toFixed(5)}`;

type MapEntry = {
  place: LunchPlace;
  coords: [number, number];
};

const parseCoordinate = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildDirectionsUrl = (destination: [number, number] | null, fallbackAddress: string) => {
  if (!destination) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(fallbackAddress)}`;
  }
  const destinationPart = `${destination[0].toFixed(5)},${destination[1].toFixed(5)}`;
  return `https://www.openstreetmap.org/directions?engine=graphhopper_foot&route=${CAMPUS_ROUTE_PART};${destinationPart}`;
};

export default function LunchPlaces() {
  const { profile } = useCurrentProfile();
  const [places, setPlaces] = useState<LunchPlace[]>([]);
  const [reviews, setReviews] = useState<LunchReview[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<LunchPlace | null>(null);
  const [placeForm, setPlaceForm] = useState({
    name: '',
    website_url: '',
    phone: '',
    contact_email: '',
    address: '',
    cuisine: '',
    distance_minutes: '',
    opening_hours: '',
    latitude: '',
    longitude: '',
    open_days: [] as string[],
  });
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [savingPlace, setSavingPlace] = useState(false);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [filteredCuisine, setFilteredCuisine] = useState<string>('all');
  const [maxDistance, setMaxDistance] = useState<string>('all');
  const [openDayFilter, setOpenDayFilter] = useState<string>('today');
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const todayValue = jsDayToValue[new Date().getDay()];
  const resolvedDayFilter = openDayFilter === 'today' ? todayValue : openDayFilter;

  const [reviewForm, setReviewForm] = useState({
    place_id: '',
    rating: '4',
    wait_time_minutes: '',
    comment: '',
  });
  const [savingReview, setSavingReview] = useState(false);

  const isAdmin = Boolean(profile && (profile.role === 'SUPER_ADMIN' || profile.role === 'ORG_ADMIN'));
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null;

  const loadPlaces = async () => {
    setLoadingPlaces(true);
    const { data, error } = await supabase.from('lunch_places').select('*').order('name');
    if (error) {
      console.error('load places failed', error);
      toast.error('Orte konnten nicht geladen werden.');
    } else {
      setPlaces(data ?? []);
      if (!selectedPlaceId && data && data.length) {
        setSelectedPlaceId(data[0].id);
      }
    }
    setLoadingPlaces(false);
  };

  const loadReviews = async () => {
    const { data, error } = await supabase
      .from('lunch_reviews')
      .select('*, profiles:profiles(name, avatar_url)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('load reviews failed', error);
    } else {
      setReviews(data ?? []);
    }
  };

  useEffect(() => {
    loadPlaces();
    loadReviews();
  }, []);

  const averageRating = (placeId: string) => {
    const entries = reviews.filter((review) => review.place_id === placeId);
    if (!entries.length) return null;
    return entries.reduce((sum, item) => sum + item.rating, 0) / entries.length;
  };

  const filteredPlaces = useMemo(() => {
    return places.filter((place) => {
      if (filteredCuisine !== 'all' && (place.cuisine ?? '').toLowerCase() !== filteredCuisine.toLowerCase()) {
        return false;
      }
      if (maxDistance !== 'all' && place.distance_minutes && place.distance_minutes > Number(maxDistance)) {
        return false;
      }
      if (resolvedDayFilter !== 'all') {
        const openDays = Array.isArray(place.open_days) ? place.open_days : [];
        if (openDays.length > 0 && !openDays.includes(resolvedDayFilter)) {
          return false;
        }
      }
      return true;
    });
  }, [places, filteredCuisine, maxDistance, resolvedDayFilter]);

  const mapPlaces = useMemo<MapEntry[]>(() => {
    return filteredPlaces
      .map((place) => {
        const lat = parseCoordinate(place.latitude);
        const lon = parseCoordinate(place.longitude);
        if (lat === null || lon === null) {
          return null;
        }
        return { place, coords: [lat, lon] as [number, number] };
      })
      .filter((entry): entry is MapEntry => Boolean(entry));
  }, [filteredPlaces]);

  const coordsById = useMemo(() => {
    const entries = new Map<string, [number, number]>();
    mapPlaces.forEach((entry) => entries.set(entry.place.id, entry.coords));
    return entries;
  }, [mapPlaces]);

  const selectedPlaceCoords = selectedPlace ? coordsById.get(selectedPlace.id) ?? null : null;

  const mapBounds = useMemo(() => {
    if (!mapPlaces.length) return null;
    const coords = mapPlaces.map((entry) => entry.coords);
    coords.push([...CAMPUS_COORDS] as [number, number]);
    return L.latLngBounds(coords);
  }, [mapPlaces]);

  useEffect(() => {
    if (filteredPlaces.length && (!selectedPlaceId || !filteredPlaces.some((place) => place.id === selectedPlaceId))) {
      setSelectedPlaceId(filteredPlaces[0]?.id ?? null);
    }
  }, [filteredPlaces, selectedPlaceId]);

  useEffect(() => {
    if (activeTab !== 'map') {
      setMapInstance(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'map' || !mapInstance) return;
    if (mapFocus) {
      mapInstance.flyTo(mapFocus, 16, { duration: 0.6 });
      return;
    }
    if (mapBounds) {
      mapInstance.fitBounds(mapBounds, { padding: [48, 48] });
    } else {
      mapInstance.setView(CAMPUS_COORDS, 15);
    }
  }, [activeTab, mapInstance, mapFocus, mapBounds]);

  useEffect(() => {
    setMapFocus(null);
  }, [filteredCuisine, maxDistance, resolvedDayFilter]);

  const openAddDialog = (place?: LunchPlace) => {
    if (!place) {
      setPlaceForm({
        name: '',
        website_url: '',
        phone: '',
        contact_email: '',
        address: '',
        cuisine: '',
        distance_minutes: '',
        opening_hours: '',
        latitude: '',
        longitude: '',
        open_days: [],
      });
      setEditingPlace(null);
    } else {
      setPlaceForm({
        name: place.name,
        website_url: place.website_url ?? '',
        phone: place.phone ?? '',
        contact_email: place.contact_email ?? '',
        address: place.address,
        cuisine: place.cuisine ?? '',
        distance_minutes: place.distance_minutes?.toString() ?? '',
        opening_hours: place.opening_hours ?? '',
        latitude: place.latitude?.toString() ?? '',
        longitude: place.longitude?.toString() ?? '',
        open_days: place.open_days ?? [],
      });
      setEditingPlace(place);
    }
    setMenuFile(null);
    setAddDialogOpen(true);
  };

  const handlePlaceFormChange = (field: keyof typeof placeForm, value: string) => {
    setPlaceForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePlace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!placeForm.name.trim() || !placeForm.address.trim()) {
      toast.error('Name und Adresse sind Pflichtfelder.');
      return;
    }
    setSavingPlace(true);
    let menuUrl = editingPlace?.menu_url ?? null;
    if (menuFile) {
      const filePath = `menus/${Date.now()}-${menuFile.name}`;
      const { error: uploadError } = await supabase.storage.from('lunch-menus').upload(filePath, menuFile, {
        upsert: true,
      });
      if (uploadError) {
        console.error('menu upload failed', uploadError);
        toast.error('Speisekarte konnte nicht hochgeladen werden.');
        setSavingPlace(false);
        return;
      }
      const { data } = supabase.storage.from('lunch-menus').getPublicUrl(filePath);
      menuUrl = data.publicUrl;
    }
    const payload = {
      name: placeForm.name.trim(),
      website_url: placeForm.website_url.trim() || null,
      phone: placeForm.phone.trim() || null,
      contact_email: placeForm.contact_email.trim() || null,
      address: placeForm.address.trim(),
      cuisine: placeForm.cuisine.trim() || null,
      distance_minutes: placeForm.distance_minutes ? Number(placeForm.distance_minutes) : null,
      opening_hours: placeForm.opening_hours.trim() || null,
      menu_url: menuUrl,
      latitude: placeForm.latitude ? Number(placeForm.latitude) : null,
      longitude: placeForm.longitude ? Number(placeForm.longitude) : null,
      open_days: placeForm.open_days,
      created_by: editingPlace?.created_by ?? profile?.id ?? '',
    };
    try {
      if (editingPlace) {
        const { error } = await supabase.from('lunch_places').update(payload).eq('id', editingPlace.id);
        if (error) throw error;
        toast.success('Ort aktualisiert');
      } else {
        const { error } = await supabase.from('lunch_places').insert({ ...payload, created_by: profile?.id });
        if (error) throw error;
        toast.success('Neuer Ort gespeichert');
      }
      setAddDialogOpen(false);
      loadPlaces();
    } catch (error) {
      console.error('save place failed', error);
      toast.error('Ort konnte nicht gespeichert werden.');
    } finally {
      setSavingPlace(false);
    }
  };

  const openReviewDialog = (placeId: string) => {
    setReviewForm({
      place_id: placeId,
      rating: '4',
      wait_time_minutes: '',
      comment: '',
    });
    setReviewDialogOpen(true);
  };

  const handleSaveReview = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.id) {
      toast.error('Bitte anmelden.');
      return;
    }
    setSavingReview(true);
    try {
      const payload = {
        place_id: reviewForm.place_id,
        user_id: profile.id,
        rating: Number(reviewForm.rating),
        wait_time_minutes: reviewForm.wait_time_minutes ? Number(reviewForm.wait_time_minutes) : null,
        comment: reviewForm.comment.trim() || null,
      };
      const { error } = await supabase.from('lunch_reviews').upsert(payload, { onConflict: 'place_id,user_id' });
      if (error) throw error;
      toast.success('Bewertung gespeichert');
      setReviewDialogOpen(false);
      loadReviews();
      loadPlaces();
    } catch (error) {
      console.error('save review failed', error);
      toast.error('Bewertung konnte nicht gespeichert werden.');
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    if (!placeId) return;
    setDeletingPlaceId(placeId);
    const { error } = await supabase.from('lunch_places').delete().eq('id', placeId);
    setDeletingPlaceId(null);
    if (error) {
      console.error('delete place failed', error);
      toast.error('Ort konnte nicht gelöscht werden.');
      return;
    }
    toast.success('Ort gelöscht');
    if (selectedPlaceId === placeId) {
      setSelectedPlaceId(null);
    }
    void loadPlaces();
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!reviewId) return;
    setDeletingReviewId(reviewId);
    const { error } = await supabase.from('lunch_reviews').delete().eq('id', reviewId);
    setDeletingReviewId(null);
    if (error) {
      console.error('delete review failed', error);
      toast.error('Bewertung konnte nicht gelöscht werden.');
      return;
    }
    toast.success('Bewertung gelöscht');
    void loadReviews();
    void loadPlaces();
  };

  const selectedPlaceReviews = reviews.filter((review) => review.place_id === selectedPlaceId);
  const selectedPlaceRating = selectedPlaceId ? averageRating(selectedPlaceId) : null;
  const handleShowOnMap = (place: LunchPlace) => {
    const coords = coordsById.get(place.id);
    if (!coords) {
      toast.info('Für diesen Ort sind noch keine Koordinaten hinterlegt.');
      return;
    }
    setSelectedPlaceId(place.id);
    setActiveTab('map');
    setMapFocus([coords[0], coords[1]]);
  };

  const handleFocusCampus = () => {
    setActiveTab('map');
    setMapFocus([CAMPUS_COORDS[0], CAMPUS_COORDS[1]]);
  };

  const handleShowAllOnMap = () => {
    setActiveTab('map');
    setMapFocus(null);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              kulinarische auswahl
            </p>
            <h1 className="text-4xl font-bold">Mittagessen & Orte</h1>
            <p className="text-muted-foreground">
              Entdecke Restaurants in Laufnähe, teile Bewertungen und plane Deinen Lunch smarter.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => loadPlaces()}>
              <Loader2 className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
            <Button onClick={() => openAddDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Ort hinzufügen
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'list' | 'map')} className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="list">Übersicht</TabsTrigger>
              <TabsTrigger value="map">Karte</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <Select value={filteredCuisine} onValueChange={setFilteredCuisine}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Küche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Küchen</SelectItem>
                    {cuisineOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={maxDistance} onValueChange={setMaxDistance}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Distanz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Beliebig</SelectItem>
                    <SelectItem value="5">&lt; 5 min</SelectItem>
                    <SelectItem value="10">&lt; 10 min</SelectItem>
                    <SelectItem value="15">&lt; 15 min</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={openDayFilter} onValueChange={setOpenDayFilter}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Wochentag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Heute</SelectItem>
                    <SelectItem value="all">Alle Tage</SelectItem>
                    {weekdayOptions.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <TabsContent value="list" className="space-y-4">
            {loadingPlaces ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Orte werden geladen...
              </div>
            ) : filteredPlaces.length === 0 ? (
              <Card>
                <CardContent className="text-center py-10 space-y-2">
                  <p className="text-sm text-muted-foreground">Keine Orte passen zu Deiner Auswahl.</p>
                  <Button variant="outline" onClick={() => openAddDialog()}>
                    Jetzt neuen Ort anlegen
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.3fr,0.9fr]">
                <div className="space-y-4">
                  {filteredPlaces.map((place) => {
                    const rating = averageRating(place.id);
                    const openDays = place.open_days ?? [];
                    const isSelectedDayOpen =
                      resolvedDayFilter !== 'all'
                        ? openDays.includes(resolvedDayFilter)
                        : openDays.includes(todayValue);
                    return (
                      <Card
                        key={place.id}
                        className={cn(
                          'cursor-pointer border transition hover:border-primary',
                          selectedPlaceId === place.id && 'border-primary shadow-lg',
                        )}
                        onClick={() => setSelectedPlaceId(place.id)}
                      >
                        <CardContent className="space-y-3 py-4">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                                {place.cuisine || 'Kulinarik'}
                              </p>
                              <h3 className="text-xl font-semibold">{place.name}</h3>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="text-xs">
                                {place.distance_minutes ? `${place.distance_minutes} min Fußweg` : 'Distanz n/a'}
                              </Badge>
                              {isSelectedDayOpen && (
                                <Badge variant="secondary" className="text-xs">
                                  {openDayFilter === 'today'
                                    ? 'Heute geöffnet'
                                    : `Geöffnet am ${weekdayLabel(resolvedDayFilter)}`}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {place.address}
                            </span>
                            {place.website_url && (
                              <a
                                href={place.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Globe className="h-4 w-4" />
                                Website
                              </a>
                            )}
                            {place.phone && (
                              <a
                                href={`tel:${place.phone}`}
                                className="inline-flex items-center gap-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Phone className="h-4 w-4" />
                                {place.phone}
                              </a>
                            )}
                            {place.contact_email && (
                              <a
                                href={`mailto:${place.contact_email}`}
                                className="inline-flex items-center gap-1"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Mail className="h-4 w-4" />
                                {place.contact_email}
                              </a>
                            )}
                          {place.menu_url && (
                            <a
                              href={place.menu_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <FileText className="h-4 w-4" />
                              Speisekarte
                            </a>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {openDays.length > 0 ? (
                            <>
                              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
                              <span className="tracking-[0.3em] uppercase">
                                {openDays.map((day) => weekdayLabel(day)).join(' · ')}
                              </span>
                            </>
                          ) : (
                            <span>Keine Öffnungstage hinterlegt</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star
                                  key={index}
                                  className={cn('h-4 w-4', {
                                    'fill-amber-400 text-amber-400': rating && rating >= index + 1,
                                  })}
                                />
                              ))}
                              <span className="text-sm text-muted-foreground">
                                {rating ? rating.toFixed(1) : 'Noch keine Bewertung'}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                openReviewDialog(place.id);
                              }}
                            >
                              {selectedPlaceReviews.some((review) => review.user_id === profile?.id)
                                ? 'Bewertung anpassen'
                                : 'Jetzt bewerten'}
                            </Button>
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openAddDialog(place);
                                  }}
                                >
                                  Bearbeiten
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <Trash2 className="mr-1 h-4 w-4" />
                                      Löschen
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Ort endgültig löschen?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {place.name} und alle zugehörigen Bewertungen werden dauerhaft entfernt.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => handleDeletePlace(place.id)}
                                        disabled={deletingPlaceId === place.id}
                                      >
                                        {deletingPlaceId === place.id ? 'Löscht...' : 'Löschen'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <div className="space-y-4">
                  {selectedPlace ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>Ort auf der Karte</CardTitle>
                          <CardDescription>
                            Öffne {selectedPlace.name} direkt in der Lunch-Karte oder starte eine Route ab dem ARI Campus.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Die Kartenansicht basiert auf OpenStreetMap und zeigt alle Orte gemeinsam mit dem Adenauerring 1.
                          </p>
                          {selectedPlaceCoords ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Navigation className="h-4 w-4" />
                              {selectedPlaceCoords[0].toFixed(4)}, {selectedPlaceCoords[1].toFixed(4)}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                              Für diesen Ort fehlen noch Koordinaten. Ergänze Latitude und Longitude, damit er auf der Karte erscheint.
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => handleShowOnMap(selectedPlace)} disabled={!selectedPlaceCoords}>
                              In Kartenansicht öffnen
                            </Button>
                            <Button variant="outline" asChild>
                              <a
                                href={buildDirectionsUrl(selectedPlaceCoords, selectedPlace.address)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Route planen
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Bewertungen & Wartezeit</CardTitle>
                          <CardDescription>
                            {selectedPlaceReviews.length
                              ? `Ø ${selectedPlaceRating?.toFixed(1)} aus ${selectedPlaceReviews.length} Bewertungen`
                              : 'Noch keine Bewertungen vorhanden'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedPlaceReviews.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Noch keine Bewertungen. Sei die erste Person und teile Deine Erfahrungen.
                            </div>
                          ) : (
                            selectedPlaceReviews.slice(0, 4).map((review) => (
                              <div key={review.id} className="rounded-xl border p-3">
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="flex items-center gap-1 text-amber-500">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                      <Star
                                        key={index}
                                        className={cn('h-3.5 w-3.5', {
                                          'fill-amber-400 text-amber-400': review.rating >= index + 1,
                                        })}
                                      />
                                    ))}
                                  </div>
                                  {review.wait_time_minutes && (
                                    <Badge variant="outline">
                                      Wartezeit ~ {review.wait_time_minutes} min
                                    </Badge>
                                  )}
                                  {isAdmin && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="ml-auto text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                                          Löschen
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Bewertung löschen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Dieser Eintrag wird für alle entfernt.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            onClick={() => handleDeleteReview(review.id)}
                                            disabled={deletingReviewId === review.id}
                                          >
                                            {deletingReviewId === review.id ? 'Löscht...' : 'Löschen'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                                {review.comment && (
                                  <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                                )}
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="py-10 text-center text-muted-foreground">
                        Wähle einen Ort, um Details zu sehen.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>OpenStreetMap Übersicht</CardTitle>
                <CardDescription>
                  Alle Lunch-Orte und der Adenauerring 1 auf einer gemeinsamen Karte.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-border/60">
                  <MapContainer
                    center={CAMPUS_COORDS}
                    zoom={15}
                    scrollWheelZoom
                    className="h-full w-full"
                    whenCreated={setMapInstance}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <CircleMarker
                      center={[CAMPUS_COORDS[0], CAMPUS_COORDS[1]]}
                      radius={14}
                      pathOptions={{ color: '#ea580c', fillColor: '#fdba74', fillOpacity: 0.8, weight: 3 }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -12]} permanent>
                        {CAMPUS_LABEL}
                      </LeafletTooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{CAMPUS_LABEL}</p>
                          <p className="text-muted-foreground">{CAMPUS_ADDRESS}</p>
                        </div>
                      </Popup>
                    </CircleMarker>
                    {mapPlaces.map(({ place, coords }) => {
                      const isSelected = place.id === selectedPlaceId;
                      return (
                        <CircleMarker
                          key={place.id}
                          center={coords}
                          radius={isSelected ? 10 : 8}
                          pathOptions={{
                            color: isSelected ? '#2563eb' : '#7c3aed',
                            fillColor: isSelected ? '#3b82f6' : '#a855f7',
                            fillOpacity: 0.9,
                            weight: isSelected ? 3 : 2,
                          }}
                          eventHandlers={{
                            click: () => {
                              setSelectedPlaceId(place.id);
                            },
                          }}
                        >
                          <LeafletTooltip direction="top" offset={[0, -8]}>
                            {place.name}
                          </LeafletTooltip>
                          <Popup>
                            <div className="space-y-2 text-sm">
                              <div>
                                <p className="font-semibold">{place.name}</p>
                                <p className="text-muted-foreground">{place.address}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => setSelectedPlaceId(place.id)}>
                                  Details
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleShowOnMap(place)}>
                                  Fokus
                                </Button>
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </MapContainer>

                  <div className="pointer-events-none absolute inset-0">
                    <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-2">
                      <Button size="sm" variant="secondary" onClick={handleShowAllOnMap}>
                        Alle Orte
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleFocusCampus}>
                        <Compass className="mr-2 h-4 w-4" />
                        Adenauerring 1
                      </Button>
                    </div>
                    <div className="pointer-events-auto absolute right-4 top-4">
                      <Badge variant="secondary" className="bg-background/80 text-foreground shadow-sm backdrop-blur">
                        {mapPlaces.length}/{filteredPlaces.length} Orte
                      </Badge>
                    </div>
                  </div>
                </div>
                {!mapPlaces.length && (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Koordinaten hinterlegt. Ergänze Latitude und Longitude, um Orte auf der Karte zu sehen.
                  </p>
                )}
              </CardContent>
            </Card>

            {filteredPlaces.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredPlaces.map((place) => {
                  const coords = coordsById.get(place.id) ?? null;
                  return (
                    <Card key={place.id} className="flex flex-col justify-between">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{place.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <MapPinned className="h-4 w-4" />
                          <span>{place.address}</span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm text-muted-foreground">
                          {coords ? 'Koordinaten gespeichert' : 'Koordinaten fehlen noch'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleShowOnMap(place)} disabled={!coords}>
                            {coords ? 'Auf Karte fokussieren' : 'Koordinaten hinzufügen'}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={buildDirectionsUrl(coords, place.address)} target="_blank" rel="noreferrer">
                              Route planen
                            </a>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedPlaceId(place.id)}>
                            Details öffnen
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  Keine Orte passen zu Deiner Auswahl.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSavePlace} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingPlace ? 'Ort bearbeiten' : 'Neuen Mittagessensort anlegen'}</DialogTitle>
              <DialogDescription>
                Hinterlege wichtige Informationen, damit Kolleg:innen leichter planen können.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={placeForm.name} onChange={(event) => handlePlaceFormChange('name', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Adresse *</Label>
              <Textarea rows={2} value={placeForm.address} onChange={(event) => handlePlaceFormChange('address', event.target.value)} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Webseite</Label>
                <Input value={placeForm.website_url} onChange={(event) => handlePlaceFormChange('website_url', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefon</Label>
                <Input value={placeForm.phone} onChange={(event) => handlePlaceFormChange('phone', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input value={placeForm.contact_email} onChange={(event) => handlePlaceFormChange('contact_email', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Küche</Label>
                <Select value={placeForm.cuisine} onValueChange={(value) => handlePlaceFormChange('cuisine', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuisineOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fußweg (Minuten)</Label>
                <Input
                  type="number"
                  min="0"
                  value={placeForm.distance_minutes}
                  onChange={(event) => handlePlaceFormChange('distance_minutes', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Öffnungszeiten</Label>
                <Input value={placeForm.opening_hours} onChange={(event) => handlePlaceFormChange('opening_hours', event.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Latitude (Optional)</Label>
                <Input value={placeForm.latitude} onChange={(event) => handlePlaceFormChange('latitude', event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Longitude (Optional)</Label>
                <Input value={placeForm.longitude} onChange={(event) => handlePlaceFormChange('longitude', event.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Geöffnet an diesen Tagen</Label>
              <div className="flex flex-wrap gap-2">
                {weekdayOptions.map((day) => {
                  const isActive = placeForm.open_days.includes(day.value);
                  return (
                    <Button
                      type="button"
                      key={day.value}
                      variant={isActive ? 'default' : 'outline'}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm',
                        isActive ? 'bg-primary text-primary-foreground' : 'border-dashed text-muted-foreground',
                      )}
                      onClick={() =>
                        setPlaceForm((prev) => ({
                          ...prev,
                          open_days: isActive
                            ? prev.open_days.filter((value) => value !== day.value)
                            : [...prev.open_days, day.value],
                        }))
                      }
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Speisekarte (PDF/Bild)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(event) => setMenuFile(event.target.files?.[0] ?? null)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPlace}>
                {savingPlace ? 'Speichert...' : editingPlace ? 'Aktualisieren' : 'Anlegen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSaveReview} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Erlebnis teilen</DialogTitle>
              <DialogDescription>Bewerte Wartezeit, Service und Geschmack.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Bewertung</Label>
              <Select value={reviewForm.rating} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, rating: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} Sterne
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Wartezeit (Min.)</Label>
              <Input
                type="number"
                min="0"
                value={reviewForm.wait_time_minutes}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, wait_time_minutes: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Kommentar</Label>
              <Textarea
                rows={3}
                value={reviewForm.comment}
                onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                placeholder="Was hat Dir gefallen? Gibt es Tipps für Kolleg:innen?"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingReview}>
                {savingReview ? 'Speichert...' : 'Bewertung speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
