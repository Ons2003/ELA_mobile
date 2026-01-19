import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  User,
  Shield,
  Download,
  Camera,
  Save,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Lock,
  AlertTriangle,
  HelpCircle,
  FileText,
  Trash2,
  Key,
  Activity,
  Loader,
  Edit,
  AlertCircle,
} from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile, AccountSummary } from '../lib/supabase';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import {
  supabase,
  getProfile,
  updateProfile,
  getUserSettings,
  upsertUserSettings,
  getAccountSummary,
  requestAccountDeletion,
  uploadProfileAvatar,
  resolveSupabaseImageUrl,
  changePassword,
} from '../lib/supabase';
import type { NotificationSettings, PrivacySettings, DisplaySettings } from '../types/settings';

interface ProfileSettingsPageProps {
  onNavigateBack: () => void;
}

interface EditableProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  dateOfBirth: string;
  bio: string;
  avatar: string;
  experienceLevel: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

const createDefaultProfile = (): EditableProfile => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  dateOfBirth: '',
  bio: '',
  avatar: '/IMG_8970.jpg',
  experienceLevel: 'beginner',
  emergencyContact: {
    name: '',
    phone: '',
    relationship: '',
  },
});

const createDefaultNotifications = (): NotificationSettings => ({
  email: {
    workoutReminders: true,
    coachFeedback: true,
    programUpdates: true,
    marketing: false,
  },
  push: {
    workoutReminders: true,
    coachMessages: true,
    achievements: true,
  },
});

const createDefaultPrivacy = (): PrivacySettings => ({
  showOnlineStatus: true,
  dataSharing: false,
});

const createDefaultDisplay = (): DisplaySettings => ({
  theme: 'auto',
  language: 'en',
  timezone: 'Africa/Tunis',
  dateFormat: 'DD/MM/YYYY',
  units: 'metric',
});

const mapProfileToEditable = (profileData: Profile, fallbackEmail?: string): EditableProfile => ({
  firstName: profileData.first_name ?? '',
  lastName: profileData.last_name ?? '',
  email: profileData.email ?? fallbackEmail ?? '',
  phone: profileData.phone ?? '',
  location: profileData.location ?? '',
  dateOfBirth: profileData.date_of_birth ?? '',
  bio: profileData.bio ?? '',
  avatar: profileData.avatar_url ?? '/IMG_8970.jpg',
  experienceLevel: profileData.experience_level ?? 'beginner',
  emergencyContact: {
    name: profileData.emergency_contact_name ?? '',
    phone: profileData.emergency_contact_phone ?? '',
    relationship: profileData.emergency_contact_relationship ?? '',
  },
});

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });

const mergeNotifications = (
  base: NotificationSettings,
  incoming?: NotificationSettings | null,
): NotificationSettings => ({
  email: { ...base.email, ...(incoming?.email ?? {}) },
  push: { ...base.push, ...(incoming?.push ?? {}) },
});

const mergePrivacy = (
  base: PrivacySettings,
  incoming?: PrivacySettings | null,
): PrivacySettings => ({
  showOnlineStatus: incoming?.showOnlineStatus ?? base.showOnlineStatus,
  dataSharing: incoming?.dataSharing ?? base.dataSharing,
});

const mergeDisplay = (
  base: DisplaySettings,
  incoming?: DisplaySettings | null,
): DisplaySettings => ({
  theme: incoming?.theme ?? base.theme,
  language: incoming?.language ?? base.language,
  timezone: incoming?.timezone ?? base.timezone,
  dateFormat: incoming?.dateFormat ?? base.dateFormat,
  units: incoming?.units ?? base.units,
});

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar-TN',
  es: 'es-ES',
};

const ProfileSettingsPage = ({ onNavigateBack }: ProfileSettingsPageProps) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'privacy' | 'data'>('profile');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [profile, setProfile] = useState<EditableProfile>(createDefaultProfile);
  const [notifications, setNotifications] = useState<NotificationSettings>(createDefaultNotifications);
  const [privacy, setPrivacy] = useState<PrivacySettings>(createDefaultPrivacy);
  const [display, setDisplay] = useState<DisplaySettings>(createDefaultDisplay);
  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [profileRecord, setProfileRecord] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activitySummary, setActivitySummary] = useState<AccountSummary | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarHelper, setAvatarHelper] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const locale = useMemo(
    () => LANGUAGE_LOCALE_MAP[display.language] ?? display.language ?? 'en-US',
    [display.language],
  );

  const privacyPreferences: Array<{
    key: keyof PrivacySettings;
    title: string;
    description: string;
  }> = [
    {
      key: 'showOnlineStatus',
      title: 'Show online status',
      description: 'Display when you are active to your coach and training partners.',
    },
    {
      key: 'dataSharing',
      title: 'Allow anonymous analytics',
      description: 'Help improve the experience by sharing anonymous usage data.',
    },
  ];

  const handleTogglePrivacy = (key: keyof PrivacySettings) => {
    setPrivacy((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resolvedAvatarUrl = useMemo(
    () => resolveSupabaseImageUrl(avatarPreview ?? profile.avatar) ?? profile.avatar ?? '/IMG_8970.jpg',
    [avatarPreview, profile.avatar],
  );

  const tabs = useMemo(
    () => [
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'security', label: 'Security', icon: Lock },
      { id: 'privacy', label: 'Privacy', icon: Shield },
      { id: 'data', label: 'Data & Export', icon: Download },
    ] as const,
    [],
  );

  const loadAccountActivity = useCallback(async () => {
    try {
      setActivityLoading(true);
      setActivityError(null);
      const summary = await getAccountSummary();
      setActivitySummary(summary);
    } catch (error) {
      console.error('Error loading activity summary', error);
      setActivityError('Unable to load activity right now.');
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsInitializing(true);
      setLoadError(null);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setLoadError('You need to be signed in to view settings.');
        setIsInitializing(false);
        return;
      }

      setAuthUser(user);

      const [profileData, settingsData] = await Promise.all([
        getProfile(user.id),
        getUserSettings(user.id),
      ]);

      if (profileData) {
        setProfileRecord(profileData);
        setProfile(mapProfileToEditable(profileData, user.email ?? undefined));
      }

      const notificationsBase = createDefaultNotifications();
      const privacyBase = createDefaultPrivacy();
      const displayBase = createDefaultDisplay();

      setNotifications(mergeNotifications(notificationsBase, settingsData?.notifications ?? undefined));
      setPrivacy(mergePrivacy(privacyBase, settingsData?.privacy ?? undefined));
      setDisplay(mergeDisplay(displayBase, settingsData?.display ?? undefined));

      setIsInitializing(false);
    };

    void load();
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    void loadAccountActivity();
  }, [authUser, loadAccountActivity]);

  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarError('Please choose an image smaller than 5MB.');
      return;
    }

    if (!authUser) {
      setAvatarError('You need to be signed in to upload an avatar.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setAvatarError(null);
      const preview = await readFileAsDataUrl(file);
      setAvatarPreview(preview);
      const uploadedPath = await uploadProfileAvatar(authUser.id, file);
      if (uploadedPath) {
        const publicUrl = uploadedPath.publicUrl ?? uploadedPath.storageUri;
        setProfile((prev) => ({ ...prev, avatar: publicUrl ?? prev.avatar }));
        setAvatarHelper('Avatar successfully uploaded. Remember to save changes.');
      }
    } catch (error) {
      console.error('Error uploading avatar', error);
      setAvatarError('Unable to upload avatar right now.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!authUser) {
      setLoadError('You need to be signed in to save changes.');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const profilePayload: Partial<Profile> = {
        first_name: profile.firstName.trim() || null,
        last_name: profile.lastName.trim() || null,
        phone: profile.phone.trim() || null,
        location: profile.location.trim() || null,
        date_of_birth: profile.dateOfBirth || null,
        bio: profile.bio.trim() || null,
        avatar_url: profile.avatar.trim() || null,
        experience_level: (profile.experienceLevel || 'beginner') as Profile['experience_level'],
        emergency_contact_name: profile.emergencyContact.name.trim() || null,
        emergency_contact_phone: profile.emergencyContact.phone.trim() || null,
        emergency_contact_relationship: profile.emergencyContact.relationship.trim() || null,
        units: display.units,
      };

      const updatedProfile = await updateProfile(authUser.id, profilePayload);

      if (!updatedProfile) {
        throw new Error('Unable to update profile information.');
      }

      setProfileRecord(updatedProfile);
      setProfile(mapProfileToEditable(updatedProfile, authUser.email ?? undefined));
      setAvatarPreview(null);
      setAvatarHelper(null);
      setAvatarError(null);

      const sanitizedNotifications = mergeNotifications(createDefaultNotifications(), notifications);
      const sanitizedPrivacy = mergePrivacy(createDefaultPrivacy(), privacy);
      const sanitizedDisplay = mergeDisplay(createDefaultDisplay(), display);

      const { data: updatedSettings, skipped: settingsSkipped } = await upsertUserSettings(authUser.id, {
        notifications: sanitizedNotifications,
        privacy: sanitizedPrivacy,
        display: sanitizedDisplay,
      });

      if (!updatedSettings && !settingsSkipped) {
        throw new Error('Unable to save settings.');
      }

      if (updatedSettings) {
        setNotifications(mergeNotifications(createDefaultNotifications(), updatedSettings.notifications ?? undefined));
        setPrivacy(
          mergePrivacy(createDefaultPrivacy(), {
            showOnlineStatus: updatedSettings.privacy?.showOnlineStatus ?? privacy.showOnlineStatus,
            dataSharing: updatedSettings.privacy?.dataSharing ?? privacy.dataSharing,
          }),
        );
        setDisplay(mergeDisplay(createDefaultDisplay(), updatedSettings.display ?? undefined));
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = useCallback(async () => {
    if (passwordStatus === 'saving') {
      return;
    }

    setPasswordMessage(null);

    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordStatus('error');
      setPasswordMessage('Please complete all password fields.');
      return;
    }

    if (passwordForm.next.length < 8) {
      setPasswordStatus('error');
      setPasswordMessage('Your new password must be at least 8 characters long.');
      return;
    }

    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus('error');
      setPasswordMessage('New password and confirmation do not match.');
      return;
    }

    setPasswordStatus('saving');

    const result = await changePassword(passwordForm.current, passwordForm.next);

    if (!result.success) {
      setPasswordStatus('error');
      setPasswordMessage(result.error ?? 'Unable to update your password right now.');
      return;
    }

    setPasswordStatus('success');
    setPasswordMessage('Password updated successfully.');
    setPasswordForm({ current: '', next: '', confirm: '' });

    setTimeout(() => setPasswordStatus('idle'), 4000);
  }, [passwordForm, passwordStatus]);

  const handleDataExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');

    try {
      const summary = await getAccountSummary();
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'elyes-lift-account-summary.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await requestAccountDeletion();

      if (!result.success) {
        throw new Error(result.error ?? 'Unable to start account deletion.');
      }

      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error requesting account deletion:', error);
      setDeleteError('Unable to start account deletion. Please try again later.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDatePreference = useCallback(
    (value: string | null, includeTime = true) => {
      if (!value) {
        return '-';
      }

      try {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
          return value;
        }

        const options: Intl.DateTimeFormatOptions = includeTime
          ? { dateStyle: 'medium', timeStyle: 'short' }
          : { dateStyle: 'medium' };
        return new Intl.DateTimeFormat(locale, options).format(date);
      } catch (error) {
        console.error('Error formatting date', error);
        return value;
      }
    },
    [locale],
  );

  const formatDataFootprint = (value?: number | null) => {
    if (!value) {
      return '-';
    }

    if (value < 1024) {
      return `${value.toFixed(0)} KB`;
    }

    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} MB`;
    }

    return `${(value / 1024 / 1024).toFixed(2)} GB`;
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f4ef] text-gray-900 pb-24 lg:pb-0">
        <div className="text-center">
          <Loader className="w-10 h-10 mx-auto mb-4 animate-spin text-red-600" />
          <p className="text-sm text-gray-600">Loading your settings...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f4ef] text-gray-900 px-4 pb-24 lg:pb-0">
        <Card className="w-full max-w-md border-gray-200 bg-white shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-gray-900">Unable to load settings</CardTitle>
            <CardDescription className="text-sm text-gray-500">{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onNavigateBack} className="w-full bg-red-600 hover:bg-red-700">
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderProfileTab = () => (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <User className="h-5 w-5" />
            Personal information
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Keep your training profile up to date for your coach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">First name</label>
              <Input
                value={profile.firstName}
                onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))}
                className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Last name</label>
              <Input
                value={profile.lastName}
                onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))}
                className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={profile.email}
                  disabled
                  className="pl-9 border-gray-200 bg-gray-50 text-gray-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Phone number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                  className="pl-9 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={profile.location}
                  onChange={(e) => setProfile((prev) => ({ ...prev, location: e.target.value }))}
                  className="pl-9 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date of birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="pl-9 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Bio</label>
            <Textarea
              value={profile.bio}
              onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
              rows={4}
              className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Camera className="h-5 w-5" />
            Profile photo
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Upload a square JPG or PNG (5MB max).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-gray-200">
            <img src={resolvedAvatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
            <Button
              type="button"
              size="icon"
              onClick={handleAvatarClick}
              className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-red-600 hover:bg-red-700"
              aria-label="Change profile photo"
            >
              {isUploadingAvatar ? <Loader className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            {avatarError && <p className="text-red-600">{avatarError}</p>}
            {avatarHelper && <p className="text-gray-900">{avatarHelper}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <HelpCircle className="h-5 w-5" />
            Emergency contact
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            This info is only shared with your coaching team if needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Name</label>
            <Input
              value={profile.emergencyContact.name}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, name: e.target.value },
                }))
              }
              className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <Input
              value={profile.emergencyContact.phone}
              onChange={(e) =>
                setProfile((prev) => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, phone: e.target.value },
                }))
              }
              className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Relationship</label>
            <Select
              value={profile.emergencyContact.relationship || undefined}
              onValueChange={(value) =>
                setProfile((prev) => ({
                  ...prev,
                  emergencyContact: { ...prev.emergencyContact, relationship: value },
                }))
              }
            >
              <SelectTrigger className="border-gray-200 bg-white text-gray-900 focus:ring-red-500">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">Spouse</SelectItem>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="friend">Friend</SelectItem>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Lock className="h-5 w-5" />
            Change password
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Use a strong password to keep your account secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Current password</label>
            <Input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))}
              placeholder="Enter current password"
              className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">New password</label>
              <Input
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))}
                placeholder="At least 8 characters"
                className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirm new password</label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                placeholder="Repeat new password"
                className="border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus-visible:ring-red-500"
              />
            </div>
          </div>
          {passwordMessage && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                passwordStatus === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {passwordMessage}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handlePasswordChange}
              disabled={passwordStatus === 'saving'}
              className="bg-red-600 hover:bg-red-700"
            >
              {passwordStatus === 'saving' ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              {passwordStatus === 'saving' ? 'Updating...' : 'Update password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <AlertTriangle className="h-5 w-5" />
            Two-factor authentication
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            We are working on bringing multi-factor authentication to Elyes Lift Academy. Stay tuned!
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Privacy preferences</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Control what your coach and the platform can see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {privacyPreferences.map((preference) => {
            const isEnabled = Boolean(privacy[preference.key]);
            return (
              <div key={preference.key} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{preference.title}</h3>
                    <p className="text-sm text-gray-500">{preference.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={isEnabled ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'}
                    >
                      {isEnabled ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={isEnabled}
                      onClick={() => handleTogglePrivacy(preference.key)}
                      className={`border-gray-200 bg-white ${isEnabled ? 'border-red-200 bg-red-50 text-red-700' : ''}`}
                    >
                      {isEnabled ? 'Turn off' : 'Turn on'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );

  const renderDataTab = () => (
    <div className="space-y-6">
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Download className="h-5 w-5" />
            Export data
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Download a snapshot of your workouts, check-ins, and profile details.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleDataExport}
            disabled={isExporting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isExporting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            {isExporting ? 'Preparing export...' : 'Download JSON'}
          </Button>
          {exportStatus === 'success' && (
            <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Export downloaded
            </Badge>
          )}
          {exportStatus === 'error' && (
            <Badge variant="secondary" className="border-red-200 bg-red-50 text-red-700">
              Export failed
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Activity className="h-5 w-5" />
            Account activity
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            A quick snapshot of your recent account usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>Last login</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? 'Loading...' : formatDatePreference(activitySummary?.lastLogin ?? null)}
            </span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between">
            <span>Account created</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? 'Loading...' : formatDatePreference(activitySummary?.accountCreated ?? null, false)}
            </span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between">
            <span>Active programs</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? '-' : activitySummary?.totalEnrollments ?? 0}
            </span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between">
            <span>Total workouts</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? '-' : activitySummary?.totalWorkouts ?? 0}
            </span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between">
            <span>Check-ins submitted</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? '-' : activitySummary?.totalCheckIns ?? 0}
            </span>
          </div>
          <Separator className="bg-gray-200" />
          <div className="flex items-center justify-between">
            <span>Stored data</span>
            <span className="font-medium text-gray-900">
              {activityLoading ? '-' : formatDataFootprint(activitySummary?.approximateDataSize)}
            </span>
          </div>
          {activityError && <p className="text-red-600">{activityError}</p>}
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
            <Trash2 className="h-5 w-5 text-red-600" />
            Delete account
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Permanently remove your account and all personal data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="border-red-200 bg-white text-red-700 hover:bg-red-50"
          >
            Delete my account
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-gray-900 pb-24 lg:pb-0">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onNavigateBack}
                className="text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500">Manage your profile, security, and data.</p>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              {saveStatus === 'success' && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  Saved
                </Badge>
              )}
              {saveStatus === 'error' && (
                <Badge variant="secondary" className="bg-red-50 text-red-700">
                  Error
                </Badge>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
              >
                {isSaving ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 items-stretch gap-2 rounded-2xl border border-gray-200 bg-white p-2 sm:grid-cols-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex h-full flex-col items-center justify-center gap-1 rounded-xl bg-white px-2 py-3 text-[11px] font-semibold normal-case tracking-normal text-gray-700 data-[state=active]:bg-red-600 data-[state=active]:text-white"
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="profile" className="mt-0">
            {renderProfileTab()}
          </TabsContent>
          <TabsContent value="security" className="mt-0">
            {renderSecurityTab()}
          </TabsContent>
          <TabsContent value="privacy" className="mt-0">
            {renderPrivacyTab()}
          </TabsContent>
          <TabsContent value="data" className="mt-0">
            {renderDataTab()}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => {
          setShowDeleteModal(open);
          if (!open) {
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Trash2 className="h-5 w-5 text-red-600" />
              Confirm account deletion
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your profile, workouts, check-ins, and messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteModal(false)} className="bg-white">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {isDeleting ? 'Deleting...' : 'Delete account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfileSettingsPage;
