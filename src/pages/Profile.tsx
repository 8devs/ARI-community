import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Building2, UserRound, Bell, Mail } from 'lucide-react';

interface ProfileFormState {
  name: string;
  bio: string;
  skills_text: string;
  phone: string;
  first_aid_certified: boolean;
  pref_email_notifications: boolean;
  pref_push_notifications: boolean;
}

export default function Profile() {
  const { profile, loading, refresh } = useCurrentProfile();
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [form, setForm] = useState<ProfileFormState>({
    name: '',
    bio: '',
    skills_text: '',
    phone: '',
    first_aid_certified: false,
    pref_email_notifications: true,
    pref_push_notifications: false,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        bio: profile.bio ?? '',
        skills_text: profile.skills_text ?? '',
        phone: profile.phone ?? '',
        first_aid_certified: profile.first_aid_certified ?? false,
        pref_email_notifications: profile.pref_email_notifications ?? true,
        pref_push_notifications: profile.pref_push_notifications ?? false,
      });
    }
  }, [profile]);

  const handleChange = (field: keyof ProfileFormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        toast.error('Dein Browser unterstützt keine Push-Benachrichtigungen.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Bitte erlaube Benachrichtigungen im Browser.');
        return;
      }
    }
    handleChange('pref_push_notifications', value);
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
        pref_email_notifications: form.pref_email_notifications,
        pref_push_notifications: form.pref_push_notifications,
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.id) return;

    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `profiles/${profile.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('profile-avatars').upload(filePath, file, {
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('profile-avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);
      if (updateError) throw updateError;
      toast.success('Profilbild aktualisiert');
      refresh();
    } catch (error) {
      console.error('Avatar upload failed', error);
      toast.error('Profilbild konnte nicht hochgeladen werden');
    } finally {
      setAvatarUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
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
            {profile && (
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-16 w-16">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.name} />}
                  <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar-upload">Profilbild</Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    disabled={avatarUploading}
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload landet im Bucket <code>profile-avatars</code>.
                  </p>
                </div>
              </div>
            )}

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

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      <HeartBadge />
                      Ersthelfer-Zertifizierung
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Markiert Dich als ausgebildete Ersthelfer:in in der Community.
                    </p>
                  </div>
                  <Switch
                    checked={form.first_aid_certified}
                    onCheckedChange={(checked) => handleChange('first_aid_certified', checked)}
                  />
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

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        E-Mail Benachrichtigungen
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Erhalte eine E-Mail, wenn Dich jemand anschreibt oder wichtige Updates erfolgen.
                      </p>
                    </div>
                    <Switch
                      checked={form.pref_email_notifications}
                      onCheckedChange={(checked) => handleChange('pref_email_notifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        Push Benachrichtigungen
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Aktiviert Browser-Benachrichtigungen auf diesem Gerät.
                      </p>
                    </div>
                    <Switch
                      checked={form.pref_push_notifications}
                      onCheckedChange={handlePushToggle}
                      disabled={typeof window !== 'undefined' && !('Notification' in window)}
                    />
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
