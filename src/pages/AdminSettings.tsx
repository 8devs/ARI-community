import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Building2,
  MapPin,
  Users,
  Pencil,
  PlusCircle,
  Mail,
  Phone,
  Loader2,
  Trash2,
  Globe,
  Search,
  Calendar,
  Shuffle,
  CheckCircle2,
  Settings,
  Menu,
  Coffee,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useCurrentProfile } from '@/hooks/useCurrentProfile';

type Organization = Tables<'organizations'>;
type ProfileRow = Tables<'profiles'> & {
  organization?: {
    name: string | null;
  } | null;
};
type CoffeeProduct = Tables<'coffee_products'>;
type LunchRound = {
  id: string;
  scheduled_date: string;
  status: string | null;
  weekday: number | null;
  participants: { count: number }[];
};
type JoinRequest = {
  id: string;
  name: string;
  email: string;
  organization_id: string | null;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  created_at: string;
  approved_at: string | null;
  organization?: { name: string | null } | null;
};

const emptyOrgForm = {
  name: '',
  logo_url: '',
  cost_center_code: '',
  location_text: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website_url: '',
};

const generateRandomPath = (prefix: string, file: File) => {
  const ext = file.name.split('.').pop();
  const cryptoRef =
    typeof globalThis !== 'undefined'
      ? ((globalThis as unknown as { crypto?: Crypto }).crypto as Crypto | undefined)
      : undefined;
  const randomString =
    cryptoRef?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}/${randomString}.${ext}`;
};

export default function AdminSettings() {
  const { profile: currentProfile, loading: profileLoading } = useCurrentProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = searchParams.get('section') ?? 'organizations';
  const [activeSection, setActiveSection] = useState(initialSection);
  const canAccessAdmin = currentProfile?.role === 'SUPER_ADMIN' || currentProfile?.role === 'ORG_ADMIN';
  const isSuperAdmin = currentProfile?.role === 'SUPER_ADMIN';
  const isOrgAdmin = currentProfile?.role === 'ORG_ADMIN';

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState(emptyOrgForm);
  const [savingOrg, setSavingOrg] = useState(false);
  const [memberUpdates, setMemberUpdates] = useState<Record<string, boolean>>({});
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'MEMBER',
    organization_id: '',
    is_news_manager: false,
    is_event_manager: false,
  });
  const [inviting, setInviting] = useState(false);

  const [coffeeProducts, setCoffeeProducts] = useState<CoffeeProduct[]>([]);
  const [coffeeLoading, setCoffeeLoading] = useState(false);
  const [coffeeError, setCoffeeError] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    isActive: true,
  });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ProfileRow | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: '',
    bio: '',
    skills_text: '',
    first_aid_certified: false,
    position: '',
  });
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [rounds, setRounds] = useState<LunchRound[]>([]);
  const [lunchLoading, setLunchLoading] = useState(true);
  const [weekday, setWeekday] = useState(4);
  const [newRoundDate, setNewRoundDate] = useState('');
  const [savingWeekday, setSavingWeekday] = useState(false);
  const [creatingRound, setCreatingRound] = useState(false);
  const [pairingRoundId, setPairingRoundId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(true);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [requestDeclineId, setRequestDeclineId] = useState<string | null>(null);
  const pendingJoinRequestCount = useMemo(
    () => joinRequests.filter((request) => request.status === 'PENDING').length,
    [joinRequests],
  );
  const [brandingLogoUrl, setBrandingLogoUrl] = useState<string | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingUploading, setBrandingUploading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const adminTabTriggerClass =
    'w-full justify-between rounded-2xl border border-transparent bg-transparent px-4 py-3 text-left text-sm font-semibold transition hover:border-border data-[state=active]:border-primary/50 data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-sm';
  const adminSections = [
    {
      value: 'organizations',
      label: 'Organisationen',
      description: 'Strukturen & Branding verwalten',
      icon: Building2,
    },
    {
      value: 'people',
      label: 'Mitarbeitende',
      description: 'Profile & Rollen pflegen',
      icon: Users,
    },
    {
      value: 'invites',
      label: 'Einladungen',
      description: 'Neue Kolleg:innen einladen',
      icon: Mail,
    },
    {
      value: 'coffee',
      label: 'Getränke',
      description: 'Preise & Produkte',
      icon: Coffee,
    },
    {
      value: 'lunch',
      label: 'Lunch Roulette',
      description: 'Automatische Paarungen',
      icon: Shuffle,
    },
    {
      value: 'requests',
      label: 'Beitrittsanfragen',
      description: 'Freigaben & Historie',
      icon: Mail,
      badge: pendingJoinRequestCount,
    },
  ];
  const activeSectionMeta = adminSections.find((section) => section.value === activeSection);
  const ActiveSectionIcon = activeSectionMeta?.icon;

  const renderNavigationList = (onSelect?: () => void) => (
    <TabsList className="flex w-full flex-col gap-2 rounded-none bg-transparent p-0">
      {adminSections.map((section) => {
        const Icon = section.icon;
        return (
          <TabsTrigger
            key={section.value}
            value={section.value}
            className={adminTabTriggerClass}
            onClick={onSelect}
          >
            <span className="flex w-full items-start gap-3">
              <span className="mt-0.5 rounded-xl bg-muted/60 p-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold leading-tight">{section.label}</span>
                <span className="text-xs text-muted-foreground">{section.description}</span>
              </span>
              {section.badge ? (
                <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
                  {section.badge > 99 ? '99+' : section.badge}
                </span>
              ) : null}
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!canAccessAdmin) return;
    loadOrganizations();
    loadMembers();
    loadCoffeeProducts();
    loadJoinRequests();
    loadBrandingSettings();
    if (!isSuperAdmin) {
      setInviteForm((prev) => ({ ...prev, organization_id: currentProfile?.organization_id ?? '' }));
    }
  }, [canAccessAdmin, isSuperAdmin, currentProfile?.organization_id]);

  useEffect(() => {
    if (isSuperAdmin && organizations.length && !inviteForm.organization_id) {
      setInviteForm((prev) => ({ ...prev, organization_id: organizations[0].id }));
    }
  }, [organizations, isSuperAdmin, inviteForm.organization_id]);

  useEffect(() => {
    if (!canAccessAdmin) return;
    loadLunchSettings();
    loadLunchRounds();
  }, [canAccessAdmin]);

  const loadBrandingSettings = async () => {
    setBrandingLoading(true);
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'app_branding')
        .maybeSingle();

      if (error) throw error;
      const value = (data?.value ?? null) as { logo_url?: string | null } | null;
      setBrandingLogoUrl(value?.logo_url ?? null);
    } catch (error) {
      console.error('Error loading branding settings', error);
      setBrandingLogoUrl(null);
    } finally {
      setBrandingLoading(false);
    }
  };

  const saveBrandingLogo = async (logoUrl: string | null) => {
    setBrandingSaving(true);
    try {
      const { error } = await supabase.from('settings').upsert({
        key: 'app_branding',
        value: { logo_url: logoUrl },
      });
      if (error) throw error;
      setBrandingLogoUrl(logoUrl);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-branding-updated', { detail: { logoUrl } }));
      }
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleBrandLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isSuperAdmin) {
      event.target.value = '';
      toast.error('Nur Super Admins können das Logo ändern.');
      return;
    }
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    setBrandingUploading(true);
    try {
      const filePath = generateRandomPath('branding', file);
      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(filePath, file, {
          upsert: false,
          cacheControl: '3600',
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('organization-logos').getPublicUrl(filePath);
      await saveBrandingLogo(data.publicUrl);
      toast.success('Logo aktualisiert');
    } catch (error) {
      console.error('Error uploading branding logo', error);
      toast.error('Logo konnte nicht gespeichert werden');
    } finally {
      setBrandingUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveBrandLogo = async () => {
    if (!isSuperAdmin) {
      toast.error('Nur Super Admins können das Logo entfernen.');
      return;
    }
    try {
      await saveBrandingLogo(null);
      toast.success('Logo entfernt');
    } catch (error) {
      console.error('Error removing branding logo', error);
      toast.error('Logo konnte nicht entfernt werden');
    }
  };

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      console.error('Error loading organizations', error);
      toast.error('Organisationen konnten nicht geladen werden');
    }
  };

  const loadMembers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select(`
          *,
          organization:organizations(name)
        `)
        .order('name');

      if (!isSuperAdmin && currentProfile?.organization_id) {
        query = query.eq('organization_id', currentProfile.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error('Error loading members', error);
      toast.error('Mitarbeitende konnten nicht geladen werden');
    }
  };

  const loadCoffeeProducts = async () => {
    setCoffeeLoading(true);
    setCoffeeError(null);
    try {
      const { data, error } = await supabase
        .from('coffee_products')
        .select('*')
        .order('price_cents', { ascending: true });
      if (error) throw error;
      setCoffeeProducts(data || []);
    } catch (error: any) {
      console.error('Error loading coffee products', error);
      setCoffeeError('Getränke konnten nicht geladen werden.');
    } finally {
      setCoffeeLoading(false);
    }
  };

  const loadJoinRequests = async () => {
    if (!canAccessAdmin) return;
    setJoinRequestsLoading(true);
    try {
      let query = supabase
        .from('join_requests')
        .select(`
          *,
          organization:organizations(name)
        `)
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && currentProfile?.organization_id) {
        query = query.eq('organization_id', currentProfile.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setJoinRequests(data || []);
    } catch (error) {
      console.error('Error loading join requests', error);
      toast.error('Beitrittsanfragen konnten nicht geladen werden');
    } finally {
      setJoinRequestsLoading(false);
    }
  };

  const handleApproveJoinRequest = async (request: JoinRequest) => {
    if (!request.organization_id) {
      toast.error('Dieser Anfrage fehlt die Organisation.');
      return;
    }
    setRequestActionId(request.id);
    try {
      await sendInvite({
        name: request.name,
        email: request.email,
        organization_id: request.organization_id,
        role: 'MEMBER',
      });
      const { error } = await supabase
        .from('join_requests')
        .update({
          status: 'APPROVED',
          approved_at: new Date().toISOString(),
          approved_by: currentProfile?.id ?? null,
        })
        .eq('id', request.id);
      if (error) throw error;
      toast.success('Einladung gesendet');
      loadJoinRequests();
      loadMembers();
    } catch (error: any) {
      console.error('Error approving join request', error);
      toast.error(error.message ?? 'Anfrage konnte nicht bestätigt werden');
    } finally {
      setRequestActionId(null);
    }
  };

  const handleDeclineJoinRequest = async (request: JoinRequest) => {
    setRequestDeclineId(request.id);
    try {
      const { error } = await supabase
        .from('join_requests')
        .update({
          status: 'DECLINED',
          approved_at: new Date().toISOString(),
          approved_by: currentProfile?.id ?? null,
        })
        .eq('id', request.id);
      if (error) throw error;
      toast.success('Anfrage wurde abgelehnt');
      loadJoinRequests();
    } catch (error) {
      console.error('Error declining join request', error);
      toast.error('Anfrage konnte nicht abgelehnt werden');
    } finally {
      setRequestDeclineId(null);
    }
  };

  const getRequestStatusBadge = (status: JoinRequest['status']) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="default">Freigegeben</Badge>;
      case 'DECLINED':
        return <Badge variant="outline">Abgelehnt</Badge>;
      default:
        return <Badge variant="secondary">Ausstehend</Badge>;
    }
  };

  const handleSectionChange = (value: string) => {
    setActiveSection(value);
    const params = new URLSearchParams(searchParams);
    if (value === 'organizations') {
      params.delete('section');
    } else {
      params.set('section', value);
    }
    setSearchParams(params, { replace: true });
  };

  const loadLunchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'lunch_roulette_weekday')
        .maybeSingle();
      if (error) throw error;
      if (data?.value) {
        const parsed = parseInt(data.value as string, 10);
        if (!Number.isNaN(parsed)) {
          setWeekday(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading lunch settings', error);
    }
  };

  const loadLunchRounds = async () => {
    setLunchLoading(true);
    try {
      const { data, error } = await supabase
        .from('match_rounds')
        .select(`
          id,
          scheduled_date,
          status,
          weekday,
          participants:match_participations(count)
        `)
        .eq('kind', 'LUNCH')
        .order('scheduled_date', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRounds((data as LunchRound[]) || []);
    } catch (error) {
      console.error('Error loading lunch rounds', error);
      toast.error('Lunch-Roulette konnte nicht geladen werden');
    } finally {
      setLunchLoading(false);
    }
  };

  const handleSaveWeekday = async () => {
    setSavingWeekday(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'lunch_roulette_weekday',
          value: String(weekday),
        });
      if (error) throw error;
      toast.success('Wochentag gespeichert');
    } catch (error) {
      console.error('Error saving weekday', error);
      toast.error('Wochentag konnte nicht gespeichert werden');
    } finally {
      setSavingWeekday(false);
    }
  };

  const handleCreateLunchRound = async () => {
    if (!newRoundDate) {
      toast.error('Bitte Datum auswählen');
      return;
    }
    setCreatingRound(true);
    try {
      const { error } = await supabase.from('match_rounds').insert({
        kind: 'LUNCH',
        scheduled_date: newRoundDate,
        status: 'OPEN',
        weekday,
      });
      if (error) throw error;
      toast.success('Runde erstellt');
      setNewRoundDate('');
      loadLunchRounds();
    } catch (error) {
      console.error('Error creating lunch round', error);
      toast.error('Runde konnte nicht erstellt werden');
    } finally {
      setCreatingRound(false);
    }
  };

  const handleCreateLunchPairs = async (roundId: string) => {
    setPairingRoundId(roundId);
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('match_participations')
        .select('user_id')
        .eq('round_id', roundId);
      if (participantsError) throw participantsError;
      if (!participants || participants.length < 2) {
        toast.error('Mindestens zwei Teilnehmende erforderlich');
        return;
      }
      const shuffled = [...participants].sort(() => Math.random() - 0.5);
      const pairs: { round_id: string; user_a_id: string; user_b_id: string }[] = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          pairs.push({
            round_id: roundId,
            user_a_id: shuffled[i].user_id,
            user_b_id: shuffled[i + 1].user_id,
          });
        } else if (pairs.length > 0) {
          pairs.push({
            round_id: roundId,
            user_a_id: shuffled[i].user_id,
            user_b_id: pairs[pairs.length - 1].user_a_id,
          });
        }
      }
      const { error: pairError } = await supabase.from('match_pairs').insert(pairs);
      if (pairError) throw pairError;
      const { error: statusError } = await supabase
        .from('match_rounds')
        .update({ status: 'PAIRED' })
        .eq('id', roundId);
      if (statusError) throw statusError;
      toast.success(`${pairs.length} Paarungen erstellt`);
      loadLunchRounds();
    } catch (error) {
      console.error('Error pairing lunch round', error);
      toast.error('Paarungen konnten nicht erstellt werden');
    } finally {
      setPairingRoundId(null);
    }
  };

  const weekdayLabels = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  const getWeekdayName = (value: number | null) => {
    if (value == null || value < 0 || value > 6) return 'Nicht festgelegt';
    return weekdayLabels[value];
  };

  const getRoundStatusBadge = (status: string | null) => {
    switch (status) {
      case 'OPEN':
        return <Badge variant="default">Offen</Badge>;
      case 'PAIRED':
        return (
          <Badge variant="outline" className="border-success text-success">
            Gepaart
          </Badge>
        );
      case 'CLOSED':
        return <Badge variant="outline">Abgeschlossen</Badge>;
      default:
        return <Badge variant="secondary">Entwurf</Badge>;
    }
  };

  const openCreateDialog = () => {
    setEditingOrg(null);
    setOrgForm(emptyOrgForm);
    setOrgDialogOpen(true);
  };

  const openEditDialog = (org: Organization) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      logo_url: org.logo_url ?? '',
      cost_center_code: org.cost_center_code ?? '',
      location_text: org.location_text ?? '',
      contact_name: org.contact_name ?? '',
      contact_email: org.contact_email ?? '',
      contact_phone: org.contact_phone ?? '',
      website_url: org.website_url ?? '',
    });
    setOrgDialogOpen(true);
  };

  const handleOrgInputChange = (field: keyof typeof orgForm, value: string) => {
    setOrgForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadOrganizationLogo = async (file: File) => {
    const filePath = generateRandomPath('logos', file);
    const { error } = await supabase.storage
      .from('organization-logos')
      .upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('organization-logos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleOrgLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadOrganizationLogo(file);
      setOrgForm(prev => ({ ...prev, logo_url: url }));
      toast.success('Logo hochgeladen');
    } catch (error) {
      console.error('Error uploading logo', error);
      toast.error('Logo konnte nicht hochgeladen werden');
    }
  };

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.name.trim()) {
      toast.error('Bitte einen Namen angeben');
      return;
    }
    setSavingOrg(true);
    const payload = {
      name: orgForm.name.trim(),
      logo_url: orgForm.logo_url.trim() || null,
      cost_center_code: orgForm.cost_center_code.trim() || null,
      location_text: orgForm.location_text.trim(),
      contact_name: orgForm.contact_name.trim() || null,
      contact_email: orgForm.contact_email.trim() || null,
      contact_phone: orgForm.contact_phone.trim() || null,
      website_url: orgForm.website_url.trim() || null,
    };

    const query = editingOrg
      ? supabase.from('organizations').update(payload).eq('id', editingOrg.id)
      : supabase.from('organizations').insert(payload);

    const { error } = await query;
    if (error) {
      console.error('Error saving organization', error);
      toast.error('Organisation konnte nicht gespeichert werden');
    } else {
      toast.success(editingOrg ? 'Organisation aktualisiert' : 'Organisation erstellt');
      setOrgDialogOpen(false);
      setEditingOrg(null);
      setOrgForm(emptyOrgForm);
      loadOrganizations();
    }

    setSavingOrg(false);
  };

  const handleMemberOrgChange = async (memberId: string, newOrgId: string) => {
    setMemberUpdates(prev => ({ ...prev, [memberId]: true }));
    const { error } = await supabase
      .from('profiles')
      .update({ organization_id: newOrgId })
      .eq('id', memberId);

    if (error) {
      console.error('Error updating member organization', error);
      toast.error('Mitglied konnte nicht verschoben werden');
    } else {
      toast.success('Mitglied verschoben');
      loadMembers();
      loadOrganizations();
    }
    setMemberUpdates(prev => ({ ...prev, [memberId]: false }));
  };

  const totalMembersPerOrg = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((member) => {
      const orgId = member.organization_id;
      if (orgId) {
        counts[orgId] = (counts[orgId] || 0) + 1;
      }
    });
    return counts;
  }, [members]);

  const sendInvite = async (payload: {
    name: string;
    email: string;
    organization_id: string;
    role?: 'MEMBER' | 'ORG_ADMIN';
    is_news_manager?: boolean;
    is_event_manager?: boolean;
  }) => {
    const redirectTo = `${window.location.origin}/passwort/neu`;
    const { error } = await supabase.auth.signInWithOtp({
      email: payload.email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
        data: {
          name: payload.name.trim(),
          role: payload.role ?? 'MEMBER',
          organization_id: payload.organization_id,
          invited_by: currentProfile?.id ?? null,
          is_news_manager: payload.is_news_manager ?? false,
          is_event_manager: payload.is_event_manager ?? false,
        },
      },
    });
    if (error) throw error;
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.organization_id) {
      toast.error('Name, E-Mail und Organisation sind erforderlich');
      return;
    }

    setInviting(true);
    try {
      await sendInvite({
        name: inviteForm.name,
        email: inviteForm.email,
        organization_id: inviteForm.organization_id,
        role: inviteForm.role,
        is_news_manager: inviteForm.is_news_manager,
        is_event_manager: inviteForm.is_event_manager,
      });
      toast.success('Einladungs-E-Mail wurde verschickt');
      setInviteForm(prev => ({
        ...prev,
        name: '',
        email: '',
        role: 'MEMBER',
        is_news_manager: false,
        is_event_manager: false,
      }));
    } catch (error: any) {
      console.error('Error sending invite', error);
      toast.error(error.message || 'Einladung konnte nicht gesendet werden');
    } finally {
      setInviting(false);
    }
  };

  const handleProductInputChange = (field: 'name' | 'price' | 'isActive', value: string | boolean) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceValue = Number((productForm.price || '').replace(',', '.'));
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Bitte gib einen gültigen Preis ein.');
      return;
    }
    setCreatingProduct(true);
    try {
      const { error } = await supabase.from('coffee_products').insert({
        name: productForm.name.trim(),
        price_cents: Math.round(priceValue * 100),
        is_active: productForm.isActive,
      });
      if (error) throw error;
      toast.success('Getränk gespeichert');
      setProductForm({
        name: '',
        price: '',
        isActive: true,
      });
      loadCoffeeProducts();
    } catch (error) {
      console.error('Error creating coffee product', error);
      toast.error('Getränk konnte nicht angelegt werden');
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleToggleProduct = async (productId: string, nextState: boolean) => {
    const { error } = await supabase
      .from('coffee_products')
      .update({ is_active: nextState })
      .eq('id', productId);

    if (error) {
      console.error('Error updating product status', error);
      toast.error('Status konnte nicht geändert werden');
      return;
    }
    loadCoffeeProducts();
  };

  const handleMemberRoleChange = async (
    memberId: string,
    newRole: 'MEMBER' | 'ORG_ADMIN' | 'SUPER_ADMIN',
  ) => {
    if (!isSuperAdmin) {
      toast.error('Nur Superadmins können Rollen vergeben.');
      return;
    }
    setMemberUpdates((prev) => ({ ...prev, [memberId]: true }));
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', memberId);
    if (error) {
      console.error('Error updating member role', error);
      toast.error('Rolle konnte nicht aktualisiert werden');
    } else {
      toast.success('Rolle aktualisiert');
      loadMembers();
    }
    setMemberUpdates((prev) => ({ ...prev, [memberId]: false }));
  };

const handleNewsManagerToggle = async (member: ProfileRow, nextState: boolean) => {
  if (!canEditMember(member)) {
    toast.error('Keine Berechtigung für diese Änderung');
    return;
  }
  setMemberUpdates((prev) => ({ ...prev, [member.id]: true }));
  const { error } = await supabase
    .from('profiles')
    .update({ is_news_manager: nextState })
    .eq('id', member.id);
  if (error) {
    console.error('Error updating news manager flag', error);
    toast.error('Status konnte nicht aktualisiert werden');
  } else {
    toast.success(nextState ? 'Als Newsmanager markiert' : 'Newsmanager-Status entfernt');
    loadMembers();
  }
  setMemberUpdates((prev) => ({ ...prev, [member.id]: false }));
};

const handleEventManagerToggle = async (member: ProfileRow, nextState: boolean) => {
  if (!canEditMember(member)) {
    toast.error('Keine Berechtigung für diese Änderung');
    return;
  }
  setMemberUpdates((prev) => ({ ...prev, [member.id]: true }));
  const { error } = await supabase
    .from('profiles')
    .update({ is_event_manager: nextState })
    .eq('id', member.id);
  if (error) {
    console.error('Error updating event manager flag', error);
    toast.error('Status konnte nicht aktualisiert werden');
  } else {
    toast.success(nextState ? 'Als Eventmanager markiert' : 'Eventmanager-Status entfernt');
    loadMembers();
  }
  setMemberUpdates((prev) => ({ ...prev, [member.id]: false }));
};

  const openMemberEditDialog = (member: ProfileRow) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      phone: member.phone ?? '',
      bio: member.bio ?? '',
      skills_text: member.skills_text ?? '',
      first_aid_certified: Boolean(member.first_aid_certified),
      position: member.position ?? '',
    });
    setMemberDialogOpen(true);
  };

  const handleMemberFormChange = (field: keyof typeof memberForm, value: string | boolean) => {
    setMemberForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveMemberDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    if (!memberForm.name.trim()) {
      toast.error('Name darf nicht leer sein');
      return;
    }
    const memberId = editingMember.id;
    setMemberUpdates((prev) => ({ ...prev, [memberId]: true }));
    const { error } = await supabase
      .from('profiles')
      .update({
      name: memberForm.name.trim(),
      phone: memberForm.phone.trim() || null,
      bio: memberForm.bio.trim() || null,
      skills_text: memberForm.skills_text.trim() || null,
      position: memberForm.position.trim() || null,
      first_aid_certified: memberForm.first_aid_certified,
      })
      .eq('id', memberId);
    if (error) {
      console.error('Error updating member profile', error);
      toast.error('Profil konnte nicht aktualisiert werden');
    } else {
      toast.success('Profil aktualisiert');
      setMemberDialogOpen(false);
      setEditingMember(null);
      loadMembers();
    }
    setMemberUpdates((prev) => ({ ...prev, [memberId]: false }));
  };

  const canEditMember = (member: ProfileRow) => {
    if (!currentProfile) return false;
    if (isSuperAdmin) return true;
    if (isOrgAdmin) {
      return (
        currentProfile.organization_id &&
        currentProfile.organization_id === member.organization_id &&
        member.role !== 'SUPER_ADMIN'
      );
    }
    return false;
  };

  const canDeleteMember = (member: ProfileRow) => {
    if (!currentProfile) return false;
    if (isSuperAdmin) return true;
    if (isOrgAdmin) {
      return (
        currentProfile.organization_id &&
        currentProfile.organization_id === member.organization_id &&
        member.role !== 'SUPER_ADMIN'
      );
    }
    return false;
  };

  const filteredMembers = useMemo(() => {
    if (!memberSearchTerm.trim()) return members;
    const term = memberSearchTerm.toLowerCase();
    return members.filter((member) => {
      const orgName = member.organization?.name?.toLowerCase() ?? '';
      return (
        member.name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term) ||
        orgName.includes(term) ||
        (member.phone ?? '').toLowerCase().includes(term)
      );
    });
  }, [members, memberSearchTerm]);

  const handleDeleteMember = async (member: ProfileRow) => {
    if (!canDeleteMember(member)) {
      toast.error('Du hast keine Berechtigung, diesen Nutzer zu löschen.');
      return;
    }
    if (!confirm(`Benutzer ${member.name} wirklich löschen?`)) {
      return;
    }
    setDeletingUserId(member.id);
    const { error } = await supabase.rpc('delete_user_with_scope', {
      _target_user_id: member.id,
    });
    if (error) {
      console.error('Error deleting user', error);
      toast.error(error.message ?? 'Nutzer konnte nicht gelöscht werden');
    } else {
      toast.success('Nutzer gelöscht');
      loadMembers();
      loadOrganizations();
    }
    setDeletingUserId(null);
  };

  if (profileLoading) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Lädt...</CardTitle>
            <CardDescription>Profilinformationen werden geladen.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Bitte einen Moment Geduld.</p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (!canAccessAdmin) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Zugriff verweigert</CardTitle>
            <CardDescription>Nur Admins können diesen Bereich nutzen.</CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-3 sm:flex sm:flex-col sm:gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold">Administration</h1>
              <p className="text-muted-foreground">
                Verwalte Organisationen, Einladungen und Getränke zentral.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto lg:hidden"
              onClick={() => setNavOpen((prev) => !prev)}
              aria-expanded={navOpen}
              aria-controls="admin-mobile-menu"
            >
              <Menu className="mr-2 h-4 w-4" />
              {navOpen ? 'Menü schließen' : 'Admin-Menü'}
            </Button>
          </div>
          <div className="lg:hidden">
            {activeSectionMeta && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card/70 p-4 shadow-sm">
                <div className="rounded-xl bg-muted/60 p-3 text-muted-foreground">
                  {ActiveSectionIcon && <ActiveSectionIcon className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Aktiver Bereich
                  </p>
                  <p className="text-lg font-semibold leading-tight">{activeSectionMeta.label}</p>
                  <p className="text-sm text-muted-foreground">{activeSectionMeta.description}</p>
                </div>
                {activeSectionMeta.badge ? (
                  <span className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white">
                    {activeSectionMeta.badge > 99 ? '99+' : activeSectionMeta.badge} offen
                  </span>
                ) : null}
              </div>
            )}
            {navOpen && (
              <div id="admin-mobile-menu" className="mt-4 rounded-2xl border bg-card/80 p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Admin-Menü</p>
                    <p className="text-xs text-muted-foreground">Bereiche auswählen, ohne zu scrollen.</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setNavOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 space-y-4">{renderNavigationList(() => setNavOpen(false))}</div>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeSection} onValueChange={handleSectionChange}>
          <div className="grid gap-6 lg:grid-cols-[320px,1fr] lg:items-start">
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <Card className="border-border/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Verwaltung</CardTitle>
                    <CardDescription>Bereiche schnell wechseln</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">{renderNavigationList()}</CardContent>
                </Card>
              </div>
            </div>

            <div className="flex-1 space-y-6">
          <TabsContent value="organizations" className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Organisationen verwalten</CardTitle>
                <CardDescription>
                  Logos, Standorte, Ansprechpartner und Mitgliedschaften pflegen.
                </CardDescription>
              </div>
              {isSuperAdmin && (
                <Button onClick={openCreateDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Organisation anlegen
                </Button>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Branding & Logo
                </CardTitle>
                <CardDescription>
                  Hinterlege das zentrale Logo für Navigation, E-Mails und das Favicon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  {brandingLoading ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Logo wird geladen...
                    </p>
                  ) : brandingLogoUrl ? (
                    <img
                      src={brandingLogoUrl}
                      alt="App Logo"
                      className="h-14 w-auto rounded-md border bg-card object-contain p-2"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Aktuell ist kein Logo hinterlegt.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app-brand-logo" className="text-sm font-medium">
                    Logo-Datei (PNG oder SVG)
                  </Label>
                  <Input
                    id="app-brand-logo"
                    type="file"
                    accept="image/png,image/svg+xml,image/webp,image/jpeg"
                    onChange={handleBrandLogoChange}
                    disabled={!isSuperAdmin || brandingSaving || brandingUploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Empfehlung: transparente Grafik, mindestens 320&nbsp;px Breite. Wird automatisch im gesamten
                    System genutzt.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={brandingSaving || brandingUploading}
                    onClick={loadBrandingSettings}
                  >
                    Aktualisieren
                  </Button>
                  {brandingLogoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!isSuperAdmin || brandingSaving}
                      onClick={handleRemoveBrandLogo}
                    >
                      Logo entfernen
                    </Button>
                  )}
                </div>
                {!isSuperAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Nur Super Admins können das globale Branding anpassen.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Lunch Roulette verwalten</CardTitle>
                  <CardDescription>Konfiguriere Fragen, Runden und Teilnehmer-Matches.</CardDescription>
                </div>
                <Button asChild>
                  <Link to="/admin/lunch-roulette">Zum Lunch Roulette Admin</Link>
                </Button>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Organisationen</CardTitle>
                <CardDescription>Alle Firmen im System</CardDescription>
              </CardHeader>
              <CardContent>
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Noch keine Organisationen vorhanden.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {organizations.map((org) => (
                      <div key={org.id} className="rounded-xl border border-border/60 p-4 space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            {org.logo_url ? (
                              <img
                                src={org.logo_url}
                                alt={org.name}
                                className="h-12 w-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-semibold">
                                {org.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-lg font-semibold">{org.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {org.location_text || 'Standort noch nicht gepflegt'}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">
                            {totalMembersPerOrg[org.id] || 0} Mitglieder
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {org.contact_name && <p>Ansprechpartner: {org.contact_name}</p>}
                          {org.contact_email && <p>E-Mail: {org.contact_email}</p>}
                          {org.contact_phone && <p>Telefon: {org.contact_phone}</p>}
                          {org.website_url && (
                            <p>
                              Webseite:{' '}
                              <a
                                href={org.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
                                {org.website_url}
                              </a>
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(org)}>
                            Bearbeiten
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/organisationen?org=${org.id}`}>Öffnen</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mitarbeitende verwalten</CardTitle>
                <CardDescription>
                  Suche nach Personen, passe Rollen an und pflege News- bzw. Eventmanager.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      placeholder="Nach Name, E-Mail oder Organisation suchen..."
                      className="pl-9"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {filteredMembers.length} {filteredMembers.length === 1 ? 'Eintrag' : 'Einträge'}
                  </p>
                </div>

                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine Mitarbeitenden gefunden.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Person</TableHead>
                          {isSuperAdmin && <TableHead>Organisation</TableHead>}
                          <TableHead>Rolle</TableHead>
                          <TableHead>Newsmanager</TableHead>
                          <TableHead>Eventmanager</TableHead>
                          <TableHead className="w-48 text-right">Aktionen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((member) => {
                          const isUpdating = memberUpdates[member.id];
                          const isSelf = member.id === currentProfile?.id;
                          return (
                            <TableRow key={member.id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    {member.avatar_url ? (
                                      <AvatarImage src={member.avatar_url} alt={member.name} />
                                    ) : (
                                      <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                    )}
                                  </Avatar>
                                  <div className="space-y-0.5">
                                    <p className="font-medium">{member.name}</p>
                                    {member.position && (
                                      <p className="text-xs text-foreground">{member.position}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                    {member.phone && (
                                      <p className="text-xs text-muted-foreground">{member.phone}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              {isSuperAdmin && (
                                <TableCell className="min-w-[180px]">
                                  <Select
                                    value={member.organization_id ?? undefined}
                                    onValueChange={(value) => handleMemberOrgChange(member.id, value)}
                                    disabled={isUpdating}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Organisation wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {organizations.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                          {org.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              )}
                              <TableCell className="min-w-[160px]">
                                {isSuperAdmin ? (
                                  <Select
                                    value={member.role}
                                    onValueChange={(value: 'MEMBER' | 'ORG_ADMIN' | 'SUPER_ADMIN') =>
                                      handleMemberRoleChange(member.id, value)
                                    }
                                    disabled={!canEditMember(member) || isUpdating || isSelf}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Rolle wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="MEMBER">Mitarbeiter</SelectItem>
                                      <SelectItem value="ORG_ADMIN">Organisations-Admin</SelectItem>
                                      <SelectItem value="SUPER_ADMIN">Superadmin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge
                                    variant={
                                      member.role === 'ORG_ADMIN'
                                        ? 'secondary'
                                        : member.role === 'SUPER_ADMIN'
                                        ? 'default'
                                        : 'outline'
                                    }
                                  >
                                    {member.role}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={Boolean(member.is_news_manager)}
                                  onCheckedChange={(checked) => handleNewsManagerToggle(member, checked)}
                                  disabled={!canEditMember(member) || isUpdating}
                                />
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={Boolean(member.is_event_manager)}
                                  onCheckedChange={(checked) => handleEventManagerToggle(member, checked)}
                                  disabled={!canEditMember(member) || isUpdating}
                                />
                              </TableCell>
                              <TableCell className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openMemberEditDialog(member)}
                                  disabled={!canEditMember(member)}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Bearbeiten
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={!canDeleteMember(member) || deletingUserId === member.id}
                                  onClick={() => handleDeleteMember(member)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invites" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Einladungen per E-Mail</CardTitle>
                <CardDescription>
                  Supabase verschickt automatisch Magic Links zur Registrierung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleInviteSubmit}>
                  <div className="space-y-2">
                    <Label>Voller Name</Label>
                    <Input
                      placeholder="Max Mustermann"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-Mail-Adresse</Label>
                    <Input
                      type="email"
                      placeholder="person@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Rolle</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Rolle wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">Mitarbeiter</SelectItem>
                          <SelectItem value="ORG_ADMIN">Organisations-Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Organisation</Label>
                      {isSuperAdmin ? (
                        <Select
                          value={inviteForm.organization_id}
                          onValueChange={(value) => setInviteForm(prev => ({ ...prev, organization_id: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Organisation wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {currentProfile?.organization?.name ?? 'Keine Organisation zugeordnet'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Newsmanager</p>
                      <p className="text-sm text-muted-foreground">
                        Darf öffentliche Pinnwand-Einträge erstellen und bearbeiten.
                      </p>
                    </div>
                    <Switch
                      checked={inviteForm.is_news_manager}
                      onCheckedChange={(checked) =>
                        setInviteForm(prev => ({ ...prev, is_news_manager: checked }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Eventmanager</p>
                      <p className="text-sm text-muted-foreground">
                        Kann Veranstaltungen erstellen, bearbeiten und veröffentlichen.
                      </p>
                    </div>
                    <Switch
                      checked={inviteForm.is_event_manager}
                      onCheckedChange={(checked) =>
                        setInviteForm(prev => ({ ...prev, is_event_manager: checked }))
                      }
                    />
                  </div>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Wird eingeladen...' : 'Einladung senden'}
                  </Button>
                  <Alert>
                    <AlertTitle>Hinweis</AlertTitle>
                    <AlertDescription>
                      Die Einladungs-E-Mail führt direkt zur Passwort-Seite. Rolle & Organisation werden aus den Metadaten übernommen.
                    </AlertDescription>
                  </Alert>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coffee" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Getränke verwalten</CardTitle>
                <CardDescription>
                  Lege Kaffeeprodukte an und aktiviere/deaktiviere sie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form className="space-y-4" onSubmit={handleCreateProduct}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="coffee-name">Name</Label>
                      <Input
                        id="coffee-name"
                        value={productForm.name}
                        onChange={(e) => handleProductInputChange('name', e.target.value)}
                        placeholder="z.B. Cappuccino"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="coffee-price">Preis (EUR)</Label>
                      <Input
                        id="coffee-price"
                        type="number"
                        min="0"
                        step="0.1"
                        value={productForm.price}
                        onChange={(e) => handleProductInputChange('price', e.target.value)}
                        placeholder="2.50"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={productForm.isActive}
                      onCheckedChange={(checked) => handleProductInputChange('isActive', checked)}
                    />
                    <span className="text-sm text-muted-foreground">Produkt sofort aktiv</span>
                  </div>
                  <Button type="submit" disabled={creatingProduct}>
                    {creatingProduct ? 'Speichern...' : 'Getränk hinzufügen'}
                  </Button>
                </form>

                {coffeeError ? (
                  <Alert>
                    <AlertTitle>Getränke können nicht geladen werden</AlertTitle>
                    <AlertDescription>{coffeeError}</AlertDescription>
                  </Alert>
                ) : coffeeLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Lädt Getränke...
                  </div>
                ) : coffeeProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Es sind noch keine Getränke angelegt.</p>
                ) : (
                  <div className="space-y-2">
                    {coffeeProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {product.name}
                            <Badge variant={product.is_active ? 'default' : 'secondary'}>
                              {product.is_active ? 'Aktiv' : 'Inaktiv'}
                            </Badge>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(product.price_cents / 100)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleProduct(product.id, !product.is_active)}
                          >
                            {product.is_active ? 'Deaktivieren' : 'Aktivieren'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lunch" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Einstellungen</CardTitle>
                <CardDescription>Wahle einen Standardwochentag und lege neue Runden an.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Wochentag für neue Runden</Label>
                    <Select value={String(weekday)} onValueChange={(value) => setWeekday(Number(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Wochentag wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdayLabels.map((label, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nächste Runde (Datum)</Label>
                    <Input
                      type="date"
                      value={newRoundDate}
                      onChange={(e) => setNewRoundDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSaveWeekday} disabled={savingWeekday}>
                    {savingWeekday ? 'Speichert...' : 'Wochentag speichern'}
                  </Button>
                  <Button variant="secondary" onClick={handleCreateLunchRound} disabled={creatingRound || !newRoundDate}>
                    {creatingRound ? 'Wird angelegt...' : 'Neue Runde erstellen'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Rundenübersicht</CardTitle>
                  <CardDescription>Verwalte die letzten Lunch-Roulette Runden.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadLunchRounds}>
                  Neu laden
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {lunchLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Runden werden geladen...
                  </div>
                ) : rounds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Es wurden noch keine Lunch-Roulette Runden angelegt.</p>
                ) : (
                  rounds.map((round) => (
                    <div key={round.id} className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          {format(new Date(round.scheduled_date), 'dd.MM.yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getWeekdayName(round.weekday)} • {round.participants?.[0]?.count ?? 0} Teilnehmende
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getRoundStatusBadge(round.status)}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateLunchPairs(round.id)}
                          disabled={pairingRoundId === round.id}
                        >
                          {pairingRoundId === round.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Erstellt...
                            </>
                          ) : (
                            <>
                              <Shuffle className="mr-2 h-4 w-4" />
                              Paarungen erstellen
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Beitrittsanfragen</CardTitle>
                  <CardDescription>Bestätige Anfragen von Kolleg:innen, die noch keinen Account haben.</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={loadJoinRequests}>
                  Neu laden
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingJoinRequestCount > 0 && (
                  <Alert>
                    <AlertTitle>Neue Anfragen</AlertTitle>
                    <AlertDescription>
                      Es warten {pendingJoinRequestCount} Beitrittsanfrage
                      {pendingJoinRequestCount === 1 ? '' : 'n'} auf Deine Entscheidung.
                    </AlertDescription>
                  </Alert>
                )}
                {joinRequestsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Anfragen werden geladen...
                  </div>
                ) : joinRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Es liegen aktuell keine Beitrittsanfragen vor.</p>
                ) : (
                  joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('de-DE')}
                        </p>
                        <p className="text-lg font-semibold">{request.name}</p>
                        <p className="text-sm text-muted-foreground">{request.email}</p>
                        <p className="text-sm text-muted-foreground">
                          Organisation: {request.organization?.name ?? 'Unbekannt'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {request.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApproveJoinRequest(request)}
                              disabled={!request.organization_id || requestActionId === request.id}
                            >
                              {requestActionId === request.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Versendet...
                                </>
                              ) : (
                                'Einladung senden'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeclineJoinRequest(request)}
                              disabled={requestDeclineId === request.id}
                            >
                              {requestDeclineId === request.id ? 'Wird abgelehnt...' : 'Ablehnen'}
                            </Button>
                          </>
                        ) : (
                          getRequestStatusBadge(request.status)
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOrg ? 'Organisation bearbeiten' : 'Neue Organisation anlegen'}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveOrganization}>
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={orgForm.name}
                onChange={(e) => handleOrgInputChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-logo">Logo hochladen</Label>
              <Input
                id="org-logo"
                type="file"
                accept="image/*"
                onChange={handleOrgLogoChange}
              />
              {orgForm.logo_url && (
                <p className="text-xs text-muted-foreground break-all">{orgForm.logo_url}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-cost-center">Kostenstelle</Label>
              <Input
                id="org-cost-center"
                value={orgForm.cost_center_code}
                onChange={(e) => handleOrgInputChange('cost_center_code', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Webseite</Label>
              <Input
                id="org-website"
                type="url"
                placeholder="https://example.com"
                value={orgForm.website_url}
                onChange={(e) => handleOrgInputChange('website_url', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Räumlichkeiten / Standort</Label>
              <Textarea
                id="org-location"
                rows={3}
                placeholder="z.B. Gebäude A, 3. OG, Raum 2.15"
                value={orgForm.location_text}
                onChange={(e) => handleOrgInputChange('location_text', e.target.value)}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-contact-name">Ansprechpartner</Label>
                <Input
                  id="org-contact-name"
                  value={orgForm.contact_name}
                  onChange={(e) => handleOrgInputChange('contact_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-contact-email">Kontakt E-Mail</Label>
                <Input
                  id="org-contact-email"
                  type="email"
                  value={orgForm.contact_email}
                  onChange={(e) => handleOrgInputChange('contact_email', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-contact-phone">Kontakt Telefon</Label>
              <Input
                id="org-contact-phone"
                value={orgForm.contact_phone}
                onChange={(e) => handleOrgInputChange('contact_phone', e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingOrg}>
                {savingOrg ? 'Speichern...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profil bearbeiten</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <form className="space-y-4" onSubmit={handleSaveMemberDetails}>
              <div className="space-y-2">
                <Label htmlFor="member-name">Name</Label>
                <Input
                  id="member-name"
                  value={memberForm.name}
                  onChange={(e) => handleMemberFormChange('name', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="member-phone">Telefon</Label>
                  <Input
                    id="member-phone"
                    value={memberForm.phone}
                    onChange={(e) => handleMemberFormChange('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-position">Position</Label>
                  <Input
                    id="member-position"
                    value={memberForm.position}
                    onChange={(e) => handleMemberFormChange('position', e.target.value)}
                    placeholder="z.B. Community Manager"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-skills">Skills / Themen</Label>
                  <Input
                    id="member-skills"
                    value={memberForm.skills_text}
                    onChange={(e) => handleMemberFormChange('skills_text', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-bio">Kurzprofil</Label>
                <Textarea
                  id="member-bio"
                  rows={3}
                  value={memberForm.bio}
                  onChange={(e) => handleMemberFormChange('bio', e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Ersthelfer</p>
                  <p className="text-xs text-muted-foreground">
                    Markiert die Person als zertifizierte Ersthelfer:in.
                  </p>
                </div>
                <Switch
                  checked={memberForm.first_aid_certified}
                  onCheckedChange={(checked) => handleMemberFormChange('first_aid_certified', checked)}
                />
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={memberUpdates[editingMember.id]}
                >
                  {memberUpdates[editingMember.id] ? 'Speichern...' : 'Speichern'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
