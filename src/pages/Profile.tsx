import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Building2, UserRound } from 'lucide-react';

interface ProfileFormState {
  name: string;
  bio: string;
  skills_text: string;
  phone: string;
  first_aid_certified: boolean;
  first_aid_available: boolean;
}

export default function Profile() {
  const { profile, loading, refresh } = useCurrentProfile();
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [form, setForm] = useState<ProfileFormState>({
    name: '',
    bio: '',
    skills_text: '',
    phone: '',
    first_aid_certified: false,
    first_aid_available: false,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        bio: profile.bio ?? '',
        skills_text: profile.skills_text ?? '',
        phone: profile.phone ?? '',
        first_aid_certified: profile.first_aid_certified ?? false,
        first_aid_available: profile.first_aid_available ?? false,
      });
    }
  }, [profile]);

  const handleChange = (field: keyof ProfileFormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: form.name,
        bio: form.bio,
        skills_text: form.skills_text,
        phone: form.phone,
        first_aid_certified: form.first_aid_certified,
        first_aid_available: form.first_aid_available,
      })
      .eq('id', profile.id);

    if (error) {
      console.error('Error updating profile', error);
      toast.error('Profil konnte nicht gespeichert werden');
    } else {
      toast.success('Profil gespeichert');
      refresh();
    }

    setSaving(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Die Passwörter stimmen nicht überein.');
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message ?? 'Passwort konnte nicht geändert werden');
    } else {
      toast.success('Passwort aktualisiert');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPasswordSaving(false);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Mein Profil</h1>
          <p className="text-lg text-muted-foreground">
            Verwalte Deine persönlichen Informationen für die Community
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Persönliche Informationen</CardTitle>
            <CardDescription>
              Diese Angaben sehen andere Mitarbeitende in der Community
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Profil wird geladen...
              </div>
            )}

            {!loading && profile && (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon / Mobil</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="+49 ..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Über mich</Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    rows={4}
                    placeholder="Beschreibe Dich kurz..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Skills & Interessen (durch Komma getrennt)</Label>
                  <Textarea
                    id="skills"
                    value={form.skills_text}
                    onChange={(e) => handleChange('skills_text', e.target.value)}
                    rows={3}
                    placeholder="Design, CAD, Ersthelfer..."
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <HeartBadge />
                        Ersthelfer
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Zeigt anderen, dass Du Ersthelfer bist.
                      </p>
                    </div>
                    <Switch
                      checked={form.first_aid_certified}
                      onCheckedChange={(checked) => handleChange('first_aid_certified', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <HeartBadge active />
                        Einsatzbereit
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Kennzeichnet Dich als verfügbaren Ersthelfer.
                      </p>
                    </div>
                    <Switch
                      checked={form.first_aid_available}
                      onCheckedChange={(checked) => handleChange('first_aid_available', checked)}
                      disabled={!form.first_aid_certified}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Organisation
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {profile.organization?.name ?? 'Noch keiner Organisation zugeordnet'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground text-right">
                    Rollenstatus: <span className="font-medium">{profile.role}</span>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full md:w-auto">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Profil speichern
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passwort ändern</CardTitle>
            <CardDescription>Lege ein neues Passwort für Deinen Account fest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordChange}>
              <div className="space-y-2">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Passwort bestätigen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? 'Wird gespeichert...' : 'Passwort ändern'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function HeartBadge({ active }: { active?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full p-1 ${active ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'}`}>
      <UserRound className="h-4 w-4" />
    </span>
  );
}
