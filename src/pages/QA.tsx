import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, CheckCircle2, Edit, Trash2, ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

interface Question {
  id: string;
  title: string;
  body: string;
  tags: string[] | null;
  is_solved: boolean;
  created_at: string;
  created_by_id: string;
  created_by: {
    name: string;
  };
  answers: Answer[];
}

interface Answer {
  id: string;
  body: string;
  created_at: string;
  created_by_id: string;
  upvotes: number | null;
  created_by: {
    name: string;
  };
}

export default function QA() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    title: '',
    body: '',
    tags: '',
  });
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [answerSubmittingId, setAnswerSubmittingId] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Set<string>>(new Set());
  const [answerEdits, setAnswerEdits] = useState<Record<string, string>>({});
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [deletingAnswerId, setDeletingAnswerId] = useState<string | null>(null);
  const { user } = useAuth();
  const { profile } = useCurrentProfile();

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadUserVotes();
    } else {
      setUserVotes(new Set());
    }
  }, [user?.id]);

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
          created_by_id,
          created_by:profiles!questions_created_by_id_fkey(name),
          answers(
            id,
            body,
            created_at,
            created_by_id,
            upvotes,
            created_by:profiles!answers_created_by_id_fkey(name)
          )
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

  const loadUserVotes = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('answer_votes')
        .select('answer_id')
        .eq('voter_id', user.id);
      if (error) throw error;
      setUserVotes(new Set((data || []).map((vote) => vote.answer_id)));
    } catch (error) {
      console.error('Error loading answer votes', error);
    }
  };

  const openCreateDialog = () => {
    setEditingQuestionId(null);
    setNewQuestion({ title: '', body: '', tags: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestionId(question.id);
    setNewQuestion({
      title: question.title,
      body: question.body,
      tags: question.tags?.join(', ') ?? '',
    });
    setDialogOpen(true);
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
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
      .map((tag) => tag.trim())
      .filter(Boolean);

    let error;
    if (editingQuestionId) {
      ({ error } = await supabase
        .from('questions')
        .update({
          title: newQuestion.title.trim(),
          body: newQuestion.body.trim(),
          tags: tags.length ? tags : null,
        })
        .eq('id', editingQuestionId));
    } else {
      ({ error } = await supabase.from('questions').insert({
        title: newQuestion.title.trim(),
        body: newQuestion.body.trim(),
        tags: tags.length ? tags : null,
        created_by_id: user.id,
      }));
    }

    if (error) {
      console.error('Error creating question:', error);
      toast.error('Frage konnte nicht gespeichert werden');
    } else {
      toast.success(editingQuestionId ? 'Frage aktualisiert' : 'Frage veröffentlicht');
      setNewQuestion({ title: '', body: '', tags: '' });
      setEditingQuestionId(null);
      setDialogOpen(false);
      loadQuestions();
    }

    setCreating(false);
  };

  const toggleAnswers = (questionId: string) => {
    setExpandedQuestionId((prev) => (prev === questionId ? null : questionId));
  };

  const handleAnswerInputChange = (questionId: string, value: string) => {
    setAnswerInputs((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!user?.id) {
      toast.error('Du musst angemeldet sein, um zu antworten');
      return;
    }
    const body = answerInputs[questionId]?.trim();
    if (!body) {
      toast.error('Bitte gib eine Antwort ein');
      return;
    }
    setAnswerSubmittingId(questionId);
    const { error } = await supabase.from('answers').insert({
      question_id: questionId,
      body,
      created_by_id: user.id,
    });
    if (error) {
      console.error('Error creating answer', error);
      toast.error('Antwort konnte nicht gespeichert werden');
    } else {
      toast.success('Antwort veröffentlicht');
      setAnswerInputs((prev) => ({ ...prev, [questionId]: '' }));
      loadQuestions();
    }
    setAnswerSubmittingId(null);
  };

  const handleUpvoteAnswer = async (answerId: string) => {
    if (!user?.id) {
      toast.error('Bitte melde Dich an, um Antworten zu bewerten');
      return;
    }
    if (userVotes.has(answerId)) {
      toast.info('Du hast diese Antwort bereits hochgevotet');
      return;
    }
    const { error } = await supabase.from('answer_votes').insert({
      answer_id: answerId,
      voter_id: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast.info('Du hast diese Antwort bereits hochgevotet');
      } else {
        console.error('Error upvoting answer', error);
        toast.error('Stimme konnte nicht gespeichert werden');
      }
      return;
    }
    const next = new Set(userVotes);
    next.add(answerId);
    setUserVotes(next);
    toast.success('Danke für Dein Voting');
    loadQuestions();
  };

  const handleStartEditAnswer = (answer: Answer) => {
    setEditingAnswerId(answer.id);
    setAnswerEdits((prev) => ({ ...prev, [answer.id]: answer.body }));
  };

  const handleCancelEditAnswer = () => {
    setEditingAnswerId(null);
  };

  const handleSaveAnswerEdit = async (answerId: string) => {
    const body = answerEdits[answerId]?.trim();
    if (!body) {
      toast.error('Antwort darf nicht leer sein');
      return;
    }
    setSavingAnswerId(answerId);
    const { error } = await supabase.from('answers').update({ body }).eq('id', answerId);
    if (error) {
      console.error('Error updating answer', error);
      toast.error('Antwort konnte nicht aktualisiert werden');
    } else {
      toast.success('Antwort aktualisiert');
      setEditingAnswerId(null);
      loadQuestions();
    }
    setSavingAnswerId(null);
  };

  const handleDeleteAnswer = async (answerId: string) => {
    setDeletingAnswerId(answerId);
    const { error } = await supabase.from('answers').delete().eq('id', answerId);
    if (error) {
      console.error('Error deleting answer', error);
      toast.error('Antwort konnte nicht gelöscht werden');
    } else {
      toast.success('Antwort gelöscht');
      loadQuestions();
    }
    setDeletingAnswerId(null);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setDeletingId(questionId);
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) {
      console.error('Error deleting question:', error);
      toast.error('Frage konnte nicht gelöscht werden');
    } else {
      toast.success('Frage gelöscht');
      loadQuestions();
    }
    setDeletingId(null);
  };

  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN';
  const canManageQuestion = (question: Question) => user?.id === question.created_by_id || isAdmin;
  const canManageAnswer = (answer: Answer) => user?.id === answer.created_by_id || isAdmin;

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
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Frage stellen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingQuestionId ? 'Frage bearbeiten' : 'Neue Frage stellen'}</DialogTitle>
                <DialogDescription>
                  Beschreibe Dein Anliegen so konkret wie möglich, damit Dir schnell geholfen werden kann.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmitQuestion}>
                <div className="space-y-2">
                  <Label htmlFor="question-title">Titel</Label>
                  <Input
                    id="question-title"
                    value={newQuestion.title}
                    onChange={(e) => setNewQuestion((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Kurzer, prägnanter Titel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="question-body">Beschreibung</Label>
                  <Textarea
                    id="question-body"
                    value={newQuestion.body}
                    onChange={(e) => setNewQuestion((prev) => ({ ...prev, body: e.target.value }))}
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
                    onChange={(e) => setNewQuestion((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="IT, Facility, HR..."
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Wird gespeichert...' : editingQuestionId ? 'Frage aktualisieren' : 'Frage veröffentlichen'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Lädt Fragen...</div>
        ) : questions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">Noch keine Fragen</p>
              <p className="text-muted-foreground mb-4">Stelle die erste Frage!</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Erste Frage stellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {questions.map((question) => (
              <Card key={question.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl">{question.title}</CardTitle>
                        {question.is_solved && <CheckCircle2 className="h-5 w-5 text-success" />}
                      </div>
                      <CardDescription>
                        Von {question.created_by.name} •{' '}
                        {formatDistanceToNow(new Date(question.created_at), {
                          addSuffix: true,
                          locale: de,
                        })}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground line-clamp-2">{question.body}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {question.tags?.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>{question.answers.length} Antworten</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => toggleAnswers(question.id)}>
                        {expandedQuestionId === question.id ? 'Antworten verbergen' : 'Antworten anzeigen'}
                      </Button>
                      {canManageQuestion(question) && (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(question)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Frage löschen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Diese Aktion kann nicht rückgängig gemacht werden.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteQuestion(question.id)}
                                  disabled={deletingId === question.id}
                                >
                                  {deletingId === question.id ? 'Löschen...' : 'Löschen'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>

                  {expandedQuestionId === question.id && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="space-y-3">
                        {question.answers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Noch keine Antworten vorhanden.</p>
                        ) : (
                          question.answers.map((answer) => (
                            <div key={answer.id} className="rounded-lg border p-3">
                              {editingAnswerId === answer.id ? (
                                <>
                                  <Textarea
                                    rows={3}
                                    value={answerEdits[answer.id] ?? ''}
                                    onChange={(e) =>
                                      setAnswerEdits((prev) => ({
                                        ...prev,
                                        [answer.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveAnswerEdit(answer.id)}
                                      disabled={savingAnswerId === answer.id}
                                    >
                                      {savingAnswerId === answer.id ? 'Speichert...' : 'Speichern'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCancelEditAnswer}
                                      disabled={savingAnswerId === answer.id}
                                    >
                                      Abbrechen
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{answer.body}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Von {answer.created_by.name} •{' '}
                                {formatDistanceToNow(new Date(answer.created_at), {
                                  addSuffix: true,
                                  locale: de,
                                })}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                <Button
                                  variant={userVotes.has(answer.id) ? 'secondary' : 'outline'}
                                  size="sm"
                                  onClick={() => handleUpvoteAnswer(answer.id)}
                                  disabled={userVotes.has(answer.id)}
                                >
                                  <ThumbsUp className="mr-2 h-4 w-4" />
                                  {answer.upvotes ?? 0}
                                </Button>
                                {canManageAnswer(answer) && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleStartEditAnswer(answer)}
                                      disabled={editingAnswerId === answer.id && savingAnswerId === answer.id}
                                    >
                                      <Edit className="mr-1 h-4 w-4" />
                                      Bearbeiten
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-destructive">
                                          <Trash2 className="mr-1 h-4 w-4" />
                                          Löschen
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Antwort löschen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Diese Aktion kann nicht rückgängig gemacht werden.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                          <AlertDialogAction
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            onClick={() => handleDeleteAnswer(answer.id)}
                                            disabled={deletingAnswerId === answer.id}
                                          >
                                            {deletingAnswerId === answer.id ? 'Löschen...' : 'Löschen'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {user ? (
                        <div className="space-y-2">
                          <Label htmlFor={`answer-${question.id}`}>Eigene Antwort</Label>
                          <Textarea
                            id={`answer-${question.id}`}
                            rows={3}
                            placeholder="Teile Dein Wissen ..."
                            value={answerInputs[question.id] ?? ''}
                            onChange={(e) => handleAnswerInputChange(question.id, e.target.value)}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSubmitAnswer(question.id)}
                            disabled={answerSubmittingId === question.id}
                          >
                            {answerSubmittingId === question.id ? 'Wird gesendet...' : 'Antwort veröffentlichen'}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Bitte melde Dich an, um zu antworten.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
