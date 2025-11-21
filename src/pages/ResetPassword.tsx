import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function ResetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(query);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setValidated(true);
    } else if (user) {
      setValidated(true);
    } else {
      toast.error('Ungültiger oder abgelaufener Link. Bitte fordere einen neuen an.');
      navigate('/login');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Die Passwörter stimmen nicht überein.');
      return;
    }
    setLoading(true);
    try {
      if (resetToken) {
        const response = await fetch('/api/auth/password/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error ?? 'Passwort konnte nicht gesetzt werden.');
        } else {
          toast.success('Passwort gespeichert! Du kannst Dich jetzt anmelden.');
          navigate('/login');
        }
      } else if (user) {
        const response = await fetch('/api/auth/password/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error ?? 'Passwort konnte nicht gesetzt werden.');
        } else {
          toast.success('Passwort gespeichert!');
          navigate('/app');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Neues Passwort festlegen</CardTitle>
          <CardDescription>
            Bitte wähle ein neues, sicheres Passwort für Deinen Account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {validated ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Passwort bestätigen</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Speichern...' : 'Passwort speichern'}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Link wird geprüft...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
