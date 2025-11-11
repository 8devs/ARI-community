import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Utensils, Users, Calendar, CheckCircle2, Clock, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface MatchRound {
  id: string;
  scheduled_date: string;
  status: string;
  weekday: number;
}

interface MatchPair {
  id: string;
  user_a: {
    name: string;
    email: string;
    organization: { name: string } | null;
  };
  user_b: {
    name: string;
    email: string;
    organization: { name: string } | null;
  } | null;
}

interface Participation {
  id: string;
  user_id: string;
}

export default function LunchRoulette() {
  const { user } = useAuth();
  const [currentRound, setCurrentRound] = useState<MatchRound | null>(null);
  const [myPair, setMyPair] = useState<MatchPair | null>(null);
  const [hasOptedIn, setHasOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<number>(0);

  useEffect(() => {
    loadCurrentRound();
  }, [user]);

  const loadCurrentRound = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get current or upcoming round
      const { data: rounds, error: roundError } = await supabase
        .from('match_rounds')
        .select('*')
        .eq('kind', 'LUNCH')
        .gte('scheduled_date', new Date().toISOString().split('T')[0])
        .order('scheduled_date')
        .limit(1);

      if (roundError) throw roundError;

      const round = rounds?.[0] || null;
      setCurrentRound(round);

      if (!round) {
        setLoading(false);
        return;
      }

      // Check if user has opted in
      const { data: participation, error: partError } = await supabase
        .from('match_participations')
        .select('id, user_id')
        .eq('round_id', round.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (partError) throw partError;
      setHasOptedIn(!!participation);

      // Get total participants count
      const { count, error: countError } = await supabase
        .from('match_participations')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', round.id);

      if (countError) throw countError;
      setParticipants(count || 0);

      // If round is paired, get user's match
      if (round.status === 'PAIRED' || round.status === 'CLOSED') {
        const { data: pairs, error: pairError } = await supabase
          .from('match_pairs')
          .select(`
            id,
            user_a_id,
            user_b_id,
            user_a:profiles!match_pairs_user_a_id_fkey(
              name,
              email,
              organization:organizations(name)
            ),
            user_b:profiles!match_pairs_user_b_id_fkey(
              name,
              email,
              organization:organizations(name)
            )
          `)
          .eq('round_id', round.id)
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

        if (pairError) throw pairError;

        if (pairs && pairs.length > 0) {
          setMyPair(pairs[0] as any);
        }
      }
    } catch (error: any) {
      console.error('Error loading round:', error);
      toast.error('Fehler beim Laden der Runde');
    } finally {
      setLoading(false);
    }
  };

  const handleOptIn = async () => {
    if (!user || !currentRound) return;

    try {
      const { error } = await supabase
        .from('match_participations')
        .insert({
          round_id: currentRound.id,
          user_id: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Du hast Dich bereits angemeldet');
        } else {
          throw error;
        }
      } else {
        toast.success('Erfolgreich angemeldet!');
        setHasOptedIn(true);
        setParticipants(p => p + 1);
      }
    } catch (error: any) {
      console.error('Error opting in:', error);
      toast.error('Fehler bei der Anmeldung');
    }
  };

  const handleOptOut = async () => {
    if (!user || !currentRound) return;

    try {
      const { error } = await supabase
        .from('match_participations')
        .delete()
        .eq('round_id', currentRound.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Abmeldung erfolgreich');
      setHasOptedIn(false);
      setParticipants(p => Math.max(0, p - 1));
    } catch (error: any) {
      console.error('Error opting out:', error);
      toast.error('Fehler bei der Abmeldung');
    }
  };

  const getWeekdayName = (weekday: number) => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[weekday];
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="secondary">Entwurf</Badge>;
      case 'OPEN':
        return <Badge variant="default">Offen</Badge>;
      case 'PAIRED':
        return <Badge variant="outline" className="border-success text-success">Gepaart</Badge>;
      case 'CLOSED':
        return <Badge variant="outline">Abgeschlossen</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Lunch Roulette 🎲</h1>
          <p className="text-lg text-muted-foreground">
            Lerne neue Kollegen beim gemeinsamen Mittagessen kennen
          </p>
        </div>

        {!currentRound ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Utensils className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Keine aktuelle Runde</p>
              <p className="text-muted-foreground">
                Aktuell ist keine Lunch Roulette Runde geplant. Schau bald wieder vorbei!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-2xl flex items-center gap-3">
                      <Calendar className="h-6 w-6 text-primary" />
                      {format(parseISO(currentRound.scheduled_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Standard-Wochentag: {getWeekdayName(currentRound.weekday)}
                    </CardDescription>
                  </div>
                  {getStatusBadge(currentRound.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">{participants} Teilnehmende</span>
                </div>

                {currentRound.status === 'OPEN' && (
                  <div className="pt-4">
                    {hasOptedIn ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Du bist angemeldet!</span>
                        </div>
                        <Button variant="outline" onClick={handleOptOut} className="w-full">
                          Abmelden
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={handleOptIn} className="w-full" size="lg">
                        <UserPlus className="h-5 w-5 mr-2" />
                        Jetzt teilnehmen
                      </Button>
                    )}
                  </div>
                )}

                {currentRound.status === 'DRAFT' && (
                  <div className="flex items-center gap-2 text-muted-foreground pt-4">
                    <Clock className="h-5 w-5" />
                    <span>Diese Runde ist noch nicht geöffnet</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {myPair && (currentRound.status === 'PAIRED' || currentRound.status === 'CLOSED') && (
              <Card className="border-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-accent" />
                    Dein Lunch-Match
                  </CardTitle>
                  <CardDescription>
                    Viel Spaß beim gemeinsamen Mittagessen!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Partner A */}
                  {myPair.user_a && (
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(myPair.user_a.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{myPair.user_a.name}</p>
                        {myPair.user_a.organization && (
                          <p className="text-sm text-muted-foreground">
                            {myPair.user_a.organization.name}
                          </p>
                        )}
                        <a
                          href={`mailto:${myPair.user_a.email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {myPair.user_a.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Partner B */}
                  {myPair.user_b && (
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(myPair.user_b.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{myPair.user_b.name}</p>
                        {myPair.user_b.organization && (
                          <p className="text-sm text-muted-foreground">
                            {myPair.user_b.organization.name}
                          </p>
                        )}
                        <a
                          href={`mailto:${myPair.user_b.email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {myPair.user_b.email}
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-sm text-muted-foreground bg-accent/10 p-4 rounded-lg">
                    💡 Tipp: Vereinbart einen Treffpunkt und lernt Euch beim Mittagessen besser kennen!
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Wie funktioniert's?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Anmelden</p>
                <p className="text-sm text-muted-foreground">
                  Melde Dich für die aktuelle Woche an
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Zufällige Paarung</p>
                <p className="text-sm text-muted-foreground">
                  Das System bildet zufällig Zweier- oder Dreiergruppen
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Gemeinsam essen</p>
                <p className="text-sm text-muted-foreground">
                  Lerne neue Kollegen kennen und tausche Dich aus!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
