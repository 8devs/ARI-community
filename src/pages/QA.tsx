import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

interface Question {
  id: string;
  title: string;
  body: string;
  tags: string[] | null;
  is_solved: boolean;
  created_at: string;
  created_by: {
    name: string;
  };
  answers: { count: number }[];
}

export default function QA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    title: '',
    body: '',
    tags: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          body,
          tags,
          is_solved,
          created_at,
          created_by:profiles!questions_created_by_id_fkey(name),
          answers(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast.error('Fehler beim Laden der Fragen');
      console.error('Error loading questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast.error('Du musst angemeldet sein, um eine Frage zu stellen');
      return;
    }
    if (!newQuestion.title.trim() || !newQuestion.body.trim()) {
      toast.error('Titel und Beschreibung sind erforderlich');
      return;
    }

    setCreating(true);
    const tags = newQuestion.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    const { error } = await supabase.from('questions').insert({
      title: newQuestion.title.trim(),
      body: newQuestion.body.trim(),
      tags: tags.length ? tags : null,
      created_by_id: user.id,
    });

    if (error) {
      console.error('Error creating question:', error);
      toast.error('Frage konnte nicht erstellt werden');
    } else {
      toast.success('Frage veröffentlicht');
      setNewQuestion({ title: '', body: '', tags: '' });
      setDialogOpen(false);
      loadQuestions();
    }

    setCreating(false);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Q&A</h1>
            <p className="text-lg text-muted-foreground">
              Stelle Fragen und hilf anderen mit Deinem Wissen
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Frage stellen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Frage stellen</DialogTitle>
                <DialogDescription>
                  Beschreibe Dein Anliegen so konkret wie möglich, damit Dir schnell geholfen werden kann.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateQuestion}>
                <div className="space-y-2">
                  <Label htmlFor="question-title">Titel</Label>
                  <Input
                    id="question-title"
                    value={newQuestion.title}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Kurzer, prägnanter Titel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-body">Beschreibung</Label>
                  <Textarea
                    id="question-body"
                    value={newQuestion.body}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, body: e.target.value }))}
                    rows={5}
                    placeholder="Beschreibe Deine Frage oder Herausforderung..."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-tags">Tags (optional, durch Komma getrennt)</Label>
                  <Input
                    id="question-tags"
                    value={newQuestion.tags}
                    onChange={(e) => setNewQuestion(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="IT, Facility, HR..."
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Wird erstellt...' : 'Frage veröffentlichen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Lädt Fragen...
          </div>
        ) : questions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Noch keine Fragen</p>
              <p className="text-muted-foreground mb-4">
                Stelle die erste Frage!
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Frage stellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map(question => (
              <Card key={question.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{question.title}</CardTitle>
                        {question.is_solved && (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                      </div>
                      <CardDescription>
                        Von {question.created_by.name} • {' '}
                        {formatDistanceToNow(new Date(question.created_at), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground line-clamp-2">
                    {question.body}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {question.tags?.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{question.answers[0]?.count || 0} Antworten</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
