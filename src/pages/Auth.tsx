import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import defaultBrandLogo from '@/assets/ari-logo.png';

const BRAND_STORAGE_KEY = 'ari-brand-logo';

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
  const [brandLogo, setBrandLogo] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(BRAND_STORAGE_KEY);
  });

  useEffect(() => {
    if (user) {
      navigate('/app');
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

    const loadInvitation = async () => {
      setInviteLoading(true);
      try {
        const { data, error } = await supabase
          .rpc('get_invitation_details', { _token: inviteToken });
        
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
      } finally {
        setInviteLoading(false);
      }
    };
    
    loadInvitation();
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
        navigate('/app');
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
    const redirectURL = `${window.location.origin}/#/passwort/neu`;
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

  useEffect(() => {
    const cacheBrandLogo = (logoUrl: string | null) => {
      if (typeof window === 'undefined') return;
      if (logoUrl) {
        window.sessionStorage.setItem(BRAND_STORAGE_KEY, logoUrl);
      } else {
        window.sessionStorage.removeItem(BRAND_STORAGE_KEY);
      }
    };

    const fetchBranding = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'app_branding')
          .maybeSingle();
        if (error) {
          if (error.code !== '42501') {
            console.error('Error loading branding', error);
          }
          return;
        }
        const value = (data?.value ?? null) as { logo_url?: string | null } | null;
        setBrandLogo(value?.logo_url ?? null);
      } catch (error) {
        console.error('Unexpected branding error', error);
      }
    };

    if (!brandLogo) {
      void fetchBranding();
    }
    cacheBrandLogo(brandLogo);

    const handleBrandingUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ logoUrl?: string | null }>).detail;
      setBrandLogo(detail?.logoUrl ?? null);
    };

    window.addEventListener('app-branding-updated', handleBrandingUpdate as EventListener);
    return () => {
      window.removeEventListener('app-branding-updated', handleBrandingUpdate as EventListener);
    };
  }, [brandLogo]);

  const hasInvite = Boolean(inviteToken);
  const displayLogo = brandLogo ?? defaultBrandLogo;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div
        className={cn(
          'w-full mx-auto',
          hasInvite ? 'max-w-4xl grid gap-4 md:grid-cols-2' : 'max-w-lg',
        )}
      >
        <Card>
          <CardHeader className="space-y-4 text-center">
            <div className="flex justify-center">
              <img
                src={displayLogo}
                alt="ARI Community"
                className="h-14 w-auto object-contain"
                loading="lazy"
              />
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
                  placeholder="Dein Passwort"
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
