import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Bitte gib eine gültige E-Mail-Adresse ein'),
  password: z.string().min(6, 'Das Passwort muss mindestens 6 Zeichen lang sein'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Der Name muss mindestens 2 Zeichen lang sein'),
  password: z.string().min(6, 'Das Passwort muss mindestens 6 Zeichen lang sein'),
});

interface InviteInfo {
  email: string;
  organization_name: string | null;
  role: string;
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!inviteToken) {
      setInviteInfo(null);
      setInviteError(null);
      return;
    }

    if (!inviteToken) return;
    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    if (!uuidRegex.test(inviteToken)) {
      setInviteError('Ungültiger Einladungslink.');
      setInviteInfo(null);
      return;
    }

    setInviteLoading(true);
    supabase
      .rpc('get_invitation_details', { _token: inviteToken })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading invitation', error);
          setInviteError('Einladung konnte nicht gefunden werden.');
          setInviteInfo(null);
        } else if (!data || data.length === 0) {
          setInviteError('Diese Einladung existiert nicht.');
          setInviteInfo(null);
        } else {
          const record = data[0];
          if (record.accepted_at) {
            setInviteError('Diese Einladung wurde bereits verwendet.');
            setInviteInfo(null);
          } else if (record.expires_at && new Date(record.expires_at) < new Date()) {
            setInviteError('Diese Einladung ist abgelaufen.');
            setInviteInfo(null);
          } else {
            setInviteInfo({
              email: record.email ?? '',
              organization_name: record.organization_name,
              role: record.role ?? 'MEMBER',
            });
            setInviteError(null);
          }
        }
      })
      .finally(() => setInviteLoading(false));
  }, [inviteToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = loginSchema.parse({ email, password });
      const { error } = await signIn(validated.email, validated.password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('E-Mail oder Passwort falsch');
        } else {
          toast.error('Fehler beim Anmelden: ' + error.message);
        }
      } else {
        toast.success('Erfolgreich angemeldet!');
        navigate('/');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Bitte gib Deine E-Mail-Adresse ein.');
      return;
    }

    setResetLoading(true);
    const redirectURL = `${window.location.origin}/passwort/neu`;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: redirectURL,
    });

    if (error) {
      toast.error(error.message ?? 'E-Mail konnte nicht gesendet werden.');
    } else {
      toast.success('Wenn die Adresse existiert, erhältst Du gleich eine E-Mail zum Zurücksetzen.');
      setShowResetForm(false);
      setResetEmail('');
    }
    setResetLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInfo) return;

    setSignupLoading(true);
    try {
      const validated = signupSchema.parse({
        name: signupName,
        password: signupPassword,
      });

      const { error } = await signUp(inviteInfo.email, validated.password, validated.name);
      if (error) {
        toast.error(error.message ?? 'Registrierung fehlgeschlagen');
      } else {
        toast.success('Einladung angenommen! Bitte prüfe Dein Postfach zur Bestätigung.');
        setSignupName('');
        setSignupPassword('');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-3xl grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">ARI Community</CardTitle>
              <CardDescription>
                Willkommen in der Community am Adenauerring
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="deine@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird angemeldet...' : 'Anmelden'}
              </Button>
              <div className="text-sm text-center space-y-1">
                <p className="text-muted-foreground">
                  Neue Mitarbeitende werden von Organisations-Admins eingeladen. 
                  Eine Selbst-Registrierung ist nur über einen Einladungslink möglich.
                </p>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setShowResetForm((prev) => !prev)}
                >
                  Passwort vergessen?
                </button>
              </div>
            </form>
            {showResetForm && (
              <form className="space-y-4 border-t pt-4 mt-4" onSubmit={handlePasswordReset}>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-Mail zum Zurücksetzen</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="deine@email.de"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={resetLoading}>
                  {resetLoading ? 'Sende E-Mail...' : 'Reset-E-Mail senden'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {inviteToken && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Einladung annehmen</CardTitle>
              <CardDescription>
                Du wurdest eingeladen, an der ARI Community teilzunehmen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inviteLoading ? (
                <p className="text-sm text-muted-foreground">Einladung wird geladen...</p>
              ) : inviteError ? (
                <p className="text-sm text-destructive">{inviteError}</p>
              ) : inviteInfo ? (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{inviteInfo.email}</p>
                    {inviteInfo.organization_name && (
                      <p className="text-muted-foreground">
                        Organisation: {inviteInfo.organization_name}
                      </p>
                    )}
                    <p className="text-muted-foreground">Rolle: {inviteInfo.role}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Dein Name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Passwort</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={signupLoading}>
                    {signupLoading ? 'Wird registriert...' : 'Registrieren'}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Einladung ungültig oder bereits verwendet.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
