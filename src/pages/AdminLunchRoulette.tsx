import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Plus, Users, Shuffle, CheckCircle2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, addDays, nextThursday, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface MatchRound {
  id: string;
  scheduled_date: string;
  status: string;
  weekday: number;
  participants: { count: number }[];
}

export default function AdminLunchRoulette() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<MatchRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoundDate, setNewRoundDate] = useState('');
  const [weekday, setWeekday] = useState(4); // Thursday

  useEffect(() => {
    loadSettings();
    loadRounds();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'lunch_roulette_weekday')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWeekday(parseInt(data.value as string));
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
    }
  };

  const loadRounds = async () => {
    try {
      const { data, error } = await supabase
        .from('match_rounds')
        .select(`
          *,
          participants:match_participations(count)
        `)
        .eq('kind', 'LUNCH')
        .order('scheduled_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRounds(data || []);
    } catch (error: any) {
      console.error('Error loading rounds:', error);
      toast.error('Fehler beim Laden der Runden');
    } finally {
      setLoading(false);
    }
  };

  const createRound = async () => {
    if (!newRoundDate) {
      toast.error('Bitte wähle ein Datum');
      return;
    }

    try {
      const { error } = await supabase
        .from('match_rounds')
        .insert({
          kind: 'LUNCH',
          scheduled_date: newRoundDate,
          status: 'OPEN',
          weekday: weekday,
        });

      if (error) throw error;

      toast.success('Runde erstellt!');
      setNewRoundDate('');
      loadRounds();
    } catch (error: any) {
      console.error('Error creating round:', error);
      toast.error('Fehler beim Erstellen der Runde');
    }
  };

  const createPairings = async (roundId: string) => {
    try {
      // Get all participants
      const { data: participants, error: partError } = await supabase
        .from('match_participations')
        .select('user_id')
        .eq('round_id', roundId);

      if (partError) throw partError;

      if (!participants || participants.length < 2) {
        toast.error('Mindestens 2 Teilnehmende erforderlich');
        return;
      }

      // Shuffle participants
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      
      // Create pairs
      const pairs = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          // Normal pair
          pairs.push({
            round_id: roundId,
            user_a_id: shuffled[i].user_id,
            user_b_id: shuffled[i + 1].user_id,
          });
        } else {
          // Odd one out - add to last pair (making it a trio)
          if (pairs.length > 0) {
            // This is a simplification - in production you'd handle trios properly
            pairs.push({
              round_id: roundId,
              user_a_id: shuffled[i].user_id,
              user_b_id: pairs[pairs.length - 1].user_a_id,
            });
          }
        }
      }

      // Insert pairs
      const { error: pairError } = await supabase
        .from('match_pairs')
        .insert(pairs);

      if (pairError) throw pairError;

      // Update round status
      const { error: updateError } = await supabase
        .from('match_rounds')
        .update({ status: 'PAIRED' })
        .eq('id', roundId);

      if (updateError) throw updateError;

      toast.success(`${pairs.length} Paarungen erstellt!`);
      loadRounds();

      // TODO: Send notifications to all participants
    } catch (error: any) {
      console.error('Error creating pairings:', error);
      toast.error('Fehler beim Erstellen der Paarungen');
    }
  };

  const updateWeekday = async () => {
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'lunch_roulette_weekday',
          value: weekday.toString(),
        });

      if (error) throw error;
      toast.success('Wochentag aktualisiert');
    } catch (error: any) {
      console.error('Error updating weekday:', error);
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const getWeekdayName = (day: number) => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[day];
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-2">Lunch Roulette Admin</h1>
          <p className="text-lg text-muted-foreground">
            Verwalte Runden und Paarungen
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Einstellungen
              </CardTitle>
              <CardDescription>
                Standard-Wochentag für Lunch Roulette
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="weekday">Wochentag</Label>
                <select
                  id="weekday"
                  value={weekday}
                  onChange={(e) => setWeekday(parseInt(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                >
                  {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <option key={day} value={day}>
                      {getWeekdayName(day)}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={updateWeekday}>
                Wochentag speichern
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Neue Runde erstellen
              </CardTitle>
              <CardDescription>
                Erstelle eine neue Lunch Roulette Runde
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={newRoundDate}
                  onChange={(e) => setNewRoundDate(e.target.value)}
                />
              </div>
              <Button onClick={createRound} className="w-full">
                Runde erstellen
              </Button>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <div>
          <h2 className="text-2xl font-bold mb-4">Aktuelle Runden</h2>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Lädt...</p>
          ) : rounds.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Noch keine Runden vorhanden
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {rounds.map(round => (
                <Card key={round.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          {format(parseISO(round.scheduled_date), 'EEEE, d. MMMM yyyy', { locale: de })}
                        </CardTitle>
                        <CardDescription>
                          {round.participants[0]?.count || 0} Teilnehmende
                        </CardDescription>
                      </div>
                      {getStatusBadge(round.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {round.status === 'OPEN' && (
                      <Button
                        onClick={() => createPairings(round.id)}
                        disabled={!round.participants[0]?.count || round.participants[0].count < 2}
                      >
                        <Shuffle className="h-4 w-4 mr-2" />
                        Paarungen erstellen
                      </Button>
                    )}
                    {round.status === 'PAIRED' && (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Paarungen wurden erstellt</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
