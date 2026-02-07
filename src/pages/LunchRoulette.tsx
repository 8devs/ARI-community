import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Utensils, Users, Calendar, CheckCircle2, Clock, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

const CONVERSATION_PROMPTS = [
  'Welche Mittagspause war zuletzt Dein Highlight und warum?',
  'Wenn Du eine Person zum Lunch einladen könntest – egal wen – wer wäre es?',
  'Was ist Dein Lieblingsort rund um den Adenauerring für eine Pause?',
  'Welchen Fun-Fact über Dich kennen die wenigsten Kolleg:innen?',
  'Welches Gericht erinnert Dich sofort an Zuhause?',
  'Welche Idee würdest Du gern mal mit anderen im Lunch Roulette diskutieren?',
];

interface MatchRound {
  id: string;
  scheduled_date: string;
  status: string;
  weekday: number;
  participations?: Participation[];
  pairs?: MatchPair[];
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
  user_a_id?: string;
  user_b_id?: string;
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
  const [conversationPrompt, setConversationPrompt] = useState('');

  const refreshConversationPrompt = useCallback(() => {
    if (!CONVERSATION_PROMPTS.length) return;
    const next = CONVERSATION_PROMPTS[Math.floor(Math.random() * CONVERSATION_PROMPTS.length)];
    setConversationPrompt(next);
  }, []);

  useEffect(() => {
    loadCurrentRound();
  }, [user]);

  useEffect(() => {
    refreshConversationPrompt();
  }, [refreshConversationPrompt, currentRound?.id, myPair?.id]);

  const loadCurrentRound = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get all match rounds (the endpoint includes participations and pairs)
      const { data: rounds } = await api.query<{ data: MatchRound[] }>('/api/match-rounds');

      // Find current or upcoming LUNCH round
      const today = new Date().toISOString().split('T')[0];
      const upcomingRounds = (rounds || [])
        .filter((r: any) => r.scheduled_date >= today && r.kind === 'LUNCH')
        .sort((a: any, b: any) => a.scheduled_date.localeCompare(b.scheduled_date));

      const round = upcomingRounds[0] || null;
      setCurrentRound(round);

      if (!round) {
        setLoading(false);
        return;
      }

      // Check if user has opted in using participations from the response
      const participations = round.participations || [];
      const userParticipation = participations.find((p: Participation) => p.user_id === user.id);
      setHasOptedIn(!!userParticipation);

      // Get total participants count
      setParticipants(participations.length);

      // If round is paired, get user's match from the pairs in the response
      if (round.status === 'PAIRED' || round.status === 'CLOSED') {
        const pairs = round.pairs || [];
        const myMatch = pairs.find(
          (p: any) => p.user_a_id === user.id || p.user_b_id === user.id
        );
        if (myMatch) {
          setMyPair(myMatch as MatchPair);
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
      await api.mutate('/api/match-participations', {
        round_id: currentRound.id,
        user_id: user.id,
      });

      toast.success('Erfolgreich angemeldet!');
      setHasOptedIn(true);
      setParticipants(p => p + 1);
    } catch (error: any) {
      console.error('Error opting in:', error);
      if (error.message?.includes('duplicate') || error.status === 409) {
        toast.error('Du hast Dich bereits angemeldet');
      } else {
        toast.error('Fehler bei der Anmeldung');
      }
    }
  };

  const handleOptOut = async () => {
    if (!user || !currentRound) return;

    try {
      await api.mutate('/api/match-participations', { round_id: currentRound.id }, 'DELETE');

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
                  {conversationPrompt && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Gesprächsimpuls</p>
                      <p className="text-sm text-foreground">{conversationPrompt}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-0 text-primary"
                        onClick={refreshConversationPrompt}
                      >
                        Neue Frage
                      </Button>
                    </div>
                  )}
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
