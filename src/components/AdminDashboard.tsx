import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ArrowLeft, 
  Users, 
  BookOpen, 
  TrendingUp, 
  DollarSign,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  X,
  Calendar,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  User,
  Settings,
  Bell,
  LogOut,
  AlertCircle,
  Activity, 
  PlayCircle, 
  Heart,
  Zap, 
  List,  
  Dumbbell,
  Target,
  MessageSquare,
  Loader,
  ClipboardList,
  RefreshCw,
  Tag
} from 'lucide-react';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import type { AdminProgramEnrollment } from '../hooks/useAdminDashboard';
import type { CoachMessage } from '../lib/supabase';
import DatabaseHealthCheck from './DatabaseHealthCheck';
import CoachDashboard from './CoachDashboard';
import { getWorkoutFocusArea, deserializeCoachNotes } from '../lib/workoutNotes';
import { supabase } from '../lib/supabase';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

const CHECKIN_STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-green-100 text-green-700',
  needs_revision: 'bg-yellow-100 text-yellow-800',
};

const DEFAULT_APPOINTMENT_SLOTS = ['10-11', '11-12', '12-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

const PHYSICIAN_REQUEST_PREFIX = '[PHYSICIAN_REQUEST]';
const PHYSICIAN_RESPONSE_PREFIX = '[PHYSICIAN_RESPONSE]';

const getEnrollmentStatusClass = (status?: string | null) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getEnrollmentName = (enrollment: AdminProgramEnrollment): string => {
  const firstName = enrollment.profile?.first_name ?? enrollment.lead_first_name ?? '';
  const lastName = enrollment.profile?.last_name ?? enrollment.lead_last_name ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Pending applicant';
};

const getEnrollmentEmail = (enrollment: AdminProgramEnrollment): string => {
  return enrollment.profile?.email ?? enrollment.lead_email ?? 'Email unavailable';
};

const getEnrollmentExperience = (enrollment: AdminProgramEnrollment): string => {
  return enrollment.profile?.experience_level ?? enrollment.lead_experience_level ?? 'Not provided';
};

const getEnrollmentLocation = (enrollment: AdminProgramEnrollment): string => {
  return enrollment.profile?.location ?? enrollment.lead_location ?? 'Not provided';
};

const getEnrollmentPhone = (enrollment: AdminProgramEnrollment): string => {
  return enrollment.profile?.phone ?? enrollment.lead_phone ?? 'Not provided';
};

const PROGRAM_TYPES = [
  { value: 'powerlifting', label: 'Powerlifting' },
  { value: 'olympic_weightlifting', label: 'Olympic Weightlifting' },
  { value: 'general_fitness', label: 'General Fitness' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'competition_prep', label: 'Competition Prep' },
];

const PROGRAM_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All Levels' },
];

type ProgramFormState = {
  title: string;
  subtitle: string;
  description: string;
  program_type: string;
  level: string;
  duration_weeks: string;
  price: string;
  currency: string;
  image_url: string;
  features: string;
  is_popular: boolean;
  is_active: boolean;
  max_participants: string;
  current_participants: string;
};

const PROGRAM_DEFAULT_CURRENCY = 'TND';

const createEmptyProgramForm = (): ProgramFormState => ({
  title: '',
  subtitle: '',
  description: '',
  program_type: 'general_fitness',
  level: 'all_levels',
  duration_weeks: '4',
  price: '0',
  currency: PROGRAM_DEFAULT_CURRENCY,
  image_url: '',
  features: '',
  is_popular: false,
  is_active: true,
  max_participants: '',
  current_participants: '',
});

interface AdminDashboardProps {
  onNavigateBack: () => void;
}

const AdminDashboard = ({ onNavigateBack }: AdminDashboardProps) => {
  const {
    activeTab,
    setActiveTab,
    users,
    enrollments,
    programs,
    loading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    selectedEnrollment,
    setSelectedEnrollment,
    selectedUser,
    setSelectedUser,
    userEnrollments,
    loadingUserDetails,
    handleViewUserDetails,
    handleSendAccountAccessEmail,
    handleDeleteUser,
    handleUpdateEnrollmentStatus,
    handleDeleteEnrollment,
    deleteEnrollment,
    approveEnrollment,
    handleCreateProgram,
    handleUpdateProgram,
    handleDeleteProgram,
    handleSignOut,
    filteredUsers,
    filteredEnrollments,
    checkIns,
    filteredCheckIns,
    selectedCheckIn,
    setSelectedCheckIn,
    checkInStatusFilter,
    setCheckInStatusFilter,
    handleReviewCheckIn,
    recentCheckIns,
    workouts,
    filteredWorkouts,
    workoutStatusFilter,
    setWorkoutStatusFilter,
    stats,
    recentEnrollments,
    reload,
    onlineUsers,
    coachMessages,
    selectedConversationUserId,
    setSelectedConversationUserId,
    refreshCoachInbox,
    handleSendCoachMessage,
    handleMarkCoachMessageRead,
    isSendingMessage,
    adminUserId,
    coachUsers,
    createCoachUser,
    assignUsersToCoach,
    isCreatingCoach,
    isAssigningUsers,
    coachCreationResult,
    coachManagementError,
    clearCoachManagementStatus,
    coachUserAssignments,
    contactMessages,
  } = useAdminDashboard({ onNavigateBack });

  const [coachFeedback, setCoachFeedback] = useState('');
  const [isUpdatingCheckIn, setIsUpdatingCheckIn] = useState(false);
  const [selectedAdminWorkoutId, setSelectedAdminWorkoutId] = useState<string | null>(null);
  const [coachReplyBody, setCoachReplyBody] = useState('');
  const [coachReplyError, setCoachReplyError] = useState<string | null>(null);
  const [newCoachForm, setNewCoachForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [selectedCoachIdForAssignments, setSelectedCoachIdForAssignments] = useState<string | null>(null);
  const [selectedUserIdsForCoach, setSelectedUserIdsForCoach] = useState<string[]>([]);
  const [coachActionNotice, setCoachActionNotice] = useState<string | null>(null);
  const [showCreateCoachCard, setShowCreateCoachCard] = useState(false);
  const [showAssignCoachCard, setShowAssignCoachCard] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [physicianDecisionNotes, setPhysicianDecisionNotes] = useState<Record<string, string>>({});
  const [physicianActionLoading, setPhysicianActionLoading] = useState<Record<string, boolean>>({});
  const [physicianPanelError, setPhysicianPanelError] = useState<string | null>(null);
  const [physicianSlotSelections, setPhysicianSlotSelections] = useState<Record<string, string[]>>({});
  const [physicianStatusFilter, setPhysicianStatusFilter] = useState<'all' | 'pending' | 'slots_proposed' | 'slot_selected' | 'denied'>('pending');

  useEffect(() => {
    if (!selectedCoachIdForAssignments && coachUsers.length > 0) {
      setSelectedCoachIdForAssignments(coachUsers[0].id);
      return;
    }

    if (
      selectedCoachIdForAssignments &&
      coachUsers.length > 0 &&
      !coachUsers.some((coach) => coach.id === selectedCoachIdForAssignments)
    ) {
      setSelectedCoachIdForAssignments(coachUsers[0].id);
    }
  }, [coachUsers, selectedCoachIdForAssignments]);

  useEffect(() => {
    if (!selectedCoachIdForAssignments) {
      setSelectedUserIdsForCoach([]);
      return;
    }

    const assigned = coachUserAssignments[selectedCoachIdForAssignments] ?? [];

    setSelectedUserIdsForCoach(assigned);
  }, [coachUserAssignments, selectedCoachIdForAssignments]);

  const selectedCoachProfile = useMemo(() => {
    if (!selectedCoachIdForAssignments) {
      return null;
    }
    return coachUsers.find((coach) => coach.id === selectedCoachIdForAssignments) ?? null;
  }, [coachUsers, selectedCoachIdForAssignments]);

  const athleteUsers = useMemo(() => users.filter((user) => user.role === 'user'), [users]);

  const coachNameById = useMemo(() => {
    const map = new Map<string, string>();
    coachUsers.forEach((coach) => {
      const fullName = `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim();
      map.set(coach.id, fullName || coach.email || 'Coach');
    });
    return map;
  }, [coachUsers]);

  const assignedCoachByUserId = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(coachUserAssignments).forEach(([coachId, userIds]) => {
      userIds.forEach((userId) => {
        if (!map.has(userId)) {
          map.set(userId, coachId);
        }
      });
    });
    return map;
  }, [coachUserAssignments]);

  const filteredContactMessages = useMemo(() => {
    const term = contactSearchTerm.trim().toLowerCase();
    if (!term) {
      return contactMessages;
    }
    return contactMessages.filter((entry) => {
      return (
        entry.name.toLowerCase().includes(term) ||
        entry.email.toLowerCase().includes(term) ||
        (entry.topic ?? '').toLowerCase().includes(term) ||
        entry.message.toLowerCase().includes(term)
      );
    });
  }, [contactMessages, contactSearchTerm]);

  const selectedContactMessage = useMemo(() => {
    if (!selectedContactId) {
      return filteredContactMessages[0] ?? null;
    }
    return filteredContactMessages.find((entry) => entry.id === selectedContactId) ?? filteredContactMessages[0] ?? null;
  }, [filteredContactMessages, selectedContactId]);

  useEffect(() => {
    if (filteredContactMessages.length === 0) {
      setSelectedContactId(null);
      return;
    }
    setSelectedContactId((current) => {
      if (current && filteredContactMessages.some((entry) => entry.id === current)) {
        return current;
      }
      return filteredContactMessages[0].id;
    });
  }, [filteredContactMessages]);

  const handleCoachFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCoachActionNotice(null);

    if (isCreatingCoach) {
      return;
    }

    const firstName = newCoachForm.firstName.trim();
    const lastName = newCoachForm.lastName.trim();
    const email = newCoachForm.email.trim().toLowerCase();
    const phone = newCoachForm.phone.trim();

    if (!email || !firstName) {
      return;
    }

    const result = await createCoachUser({
      email,
      firstName,
      lastName: lastName || undefined,
      phone: phone || undefined,
    });

    if (result.success) {
      setCoachActionNotice('Coach account created. Share the credentials below securely.');
      setNewCoachForm({ email: '', firstName: '', lastName: '', phone: '' });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setCoachActionNotice(null);
    setSelectedUserIdsForCoach((previous) => {
      if (previous.includes(userId)) {
        return previous.filter((id) => id !== userId);
      }
      return [...previous, userId];
    });
  };

  const handleUserAssignmentSave = async () => {
    if (!selectedCoachIdForAssignments) {
      return;
    }

    if (isAssigningUsers) {
      return;
    }

    setCoachActionNotice(null);
    const targetCoachId = selectedCoachIdForAssignments;
    const movedUserIds = new Set(
      selectedUserIdsForCoach.filter(
        (userId) => assignedCoachByUserId.get(userId) && assignedCoachByUserId.get(userId) !== targetCoachId
      )
    );

    const result = await assignUsersToCoach(targetCoachId, selectedUserIdsForCoach);

    if (result.success) {
      for (const [coachId, userIds] of Object.entries(coachUserAssignments)) {
        if (coachId === targetCoachId) continue;
        const nextUserIds = userIds.filter((userId) => !movedUserIds.has(userId));
        if (nextUserIds.length !== userIds.length) {
          await assignUsersToCoach(coachId, nextUserIds);
        }
      }
      setCoachActionNotice('Athlete assignments updated across coaches.');
    }
  };

  const handleResetUserSelections = () => {
    setCoachActionNotice(null);
    if (!selectedCoachIdForAssignments) {
      setSelectedUserIdsForCoach([]);
      return;
    }

    const assigned = coachUserAssignments[selectedCoachIdForAssignments] ?? [];

    setSelectedUserIdsForCoach(assigned);
  };

  const handleDismissCoachAlert = () => {
    clearCoachManagementStatus();
    setCoachActionNotice(null);
  };

  const handleCopyGeneratedPassword = async () => {
    if (!coachCreationResult) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `Email: ${coachCreationResult.email}\nPassword: ${coachCreationResult.password}`,
      );
      setCoachActionNotice('Coach credentials copied to clipboard.');
    } catch (error) {
      console.error('Unable to copy coach credentials:', error);
      setCoachActionNotice('Copy failed. Please copy the credentials manually.');
    }
  };
  const selectedUserPresence = useMemo(
    () => (selectedUser ? onlineUsers[selectedUser.id] : undefined),
    [onlineUsers, selectedUser],
  );
  const messageThreads = useMemo(() => {
    const map = new Map<
      string,
      { userId: string; lastMessage: CoachMessage; unread: number; profileName: string; profileEmail?: string | null }
    >();
    coachMessages.forEach((message) => {
      const otherUserId = message.sender_id === adminUserId ? message.receiver_id : message.sender_id;
      if (!otherUserId) {
        return;
      }
      const existing = map.get(otherUserId);
      const profile = users.find((user) => user.id === otherUserId);
      const profileName = profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email || 'Athlete'
        : 'Athlete';
      if (!existing) {
        map.set(otherUserId, {
          userId: otherUserId,
          lastMessage: message,
          unread:
            message.receiver_id === adminUserId && !message.is_read
              ? 1
              : 0,
          profileName,
          profileEmail: profile?.email,
        });
      } else {
        if (new Date(message.created_at).getTime() > new Date(existing.lastMessage.created_at).getTime()) {
          existing.lastMessage = message;
        }
        if (message.receiver_id === adminUserId && !message.is_read) {
          existing.unread += 1;
        }
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime(),
    );
  }, [adminUserId, coachMessages, users]);
  const activeConversationUserId = useMemo(() => {
    if (selectedConversationUserId) {
      return selectedConversationUserId;
    }
    return messageThreads[0]?.userId ?? null;
  }, [messageThreads, selectedConversationUserId]);
  const activeConversationMessages = useMemo(() => {
    if (!activeConversationUserId) {
      return [] as CoachMessage[];
    }
    return coachMessages
      .filter(
        (message) =>
          (message.sender_id === adminUserId && message.receiver_id === activeConversationUserId) ||
          (message.receiver_id === adminUserId && message.sender_id === activeConversationUserId),
      )
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [activeConversationUserId, adminUserId, coachMessages]);
  const unreadMessages = useMemo(
    () => coachMessages.filter((message) => message.receiver_id === adminUserId && !message.is_read).length,
    [adminUserId, coachMessages],
  );

  type PhysicianRequest = {
    id: string;
    status: 'pending' | 'approved' | 'denied' | 'slots_proposed' | 'slot_selected';
    requestedDate: string | null;
    dateLabel: string;
    sessionType: string;
    sessionDetails: string;
    proposedSlots?: string[];
    athleteId: string | null;
    athleteName: string;
    athleteEmail: string | null;
    athletePhone: string | null;
    programTitle: string;
    createdAt: string;
    decidedAt?: string;
    coachNote?: string;
  };

  const parsePhysicianPayload = useCallback(
    (message: CoachMessage) => {
      const trimmed = message.message.trim();
      const hasRequest = trimmed.includes(PHYSICIAN_REQUEST_PREFIX);
      const hasResponse = trimmed.includes(PHYSICIAN_RESPONSE_PREFIX);
      const isRequest = hasRequest && !hasResponse;
      const isResponse = hasResponse && !hasRequest;
      if (!isRequest && !isResponse) {
        return null;
      }
      const prefix = isRequest ? PHYSICIAN_REQUEST_PREFIX : PHYSICIAN_RESPONSE_PREFIX;
      const index = trimmed.indexOf(prefix);
      const jsonPart = trimmed.slice(index + prefix.length).trim();
      try {
        const parsed = JSON.parse(jsonPart);
        if (!parsed.id) {
          return null;
        }
        const athleteId = parsed.athlete?.id ?? null;
        const profile = users.find((user) => user.id === athleteId);
        const athleteName =
          (profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : '') ||
          parsed.athlete?.name ||
          'Athlete';
        const base: PhysicianRequest = {
          id: parsed.id,
          status: parsed.status ?? 'pending',
          requestedDate: parsed.requestedDate ?? null,
          dateLabel: parsed.dateLabel ?? 'Requested date',
          sessionType: parsed.sessionType ?? 'Session',
          sessionDetails: parsed.sessionDetails ?? '',
          proposedSlots: parsed.proposedSlots ?? undefined,
          athleteId,
          athleteName,
          athleteEmail: parsed.athlete?.email ?? profile?.email ?? null,
          athletePhone: parsed.athlete?.phone ?? profile?.phone ?? null,
          programTitle: parsed.athlete?.program ?? 'Program not specified',
          createdAt: parsed.createdAt ?? message.created_at,
          decidedAt: parsed.decidedAt,
          coachNote: parsed.coachNote,
        };
        return { payload: base, isResponse };
      } catch {
        return null;
      }
    },
    [users],
  );

  const physicianRequests = useMemo(() => {
    const map = new Map<string, PhysicianRequest>();
    coachMessages.forEach((message) => {
      const parsed = parsePhysicianPayload(message);
      if (!parsed || parsed.isResponse) {
        return;
      }
      map.set(parsed.payload.id, parsed.payload);
    });
    coachMessages.forEach((message) => {
      const parsed = parsePhysicianPayload(message);
      if (!parsed || !parsed.isResponse) {
        return;
      }
      const existing = map.get(parsed.payload.id);
      if (existing) {
        map.set(parsed.payload.id, { ...existing, ...parsed.payload });
      }
    });
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [coachMessages, parsePhysicianPayload]);

  const handlePhysicianDecision = useCallback(
    async (request: PhysicianRequest, status: 'approved' | 'denied') => {
      if (!request.athleteId) {
        setPhysicianPanelError('Missing athlete id on request.');
        return;
      }
      const note = (physicianDecisionNotes[request.id] ?? '').trim();
      if (status === 'denied' && !note) {
        setPhysicianPanelError('Please add a note explaining the denial before sending.');
        return;
      }
      const slots = physicianSlotSelections[request.id] ?? [];
      if (status === 'approved' && slots.length === 0) {
        setPhysicianPanelError('Select at least one slot to send to the physician.');
        return;
      }
      setPhysicianPanelError(null);
      setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: true }));

      const payloadStatus = status === 'approved' ? 'slots_proposed' : 'denied';
      const payload = {
        ...request,
        status: payloadStatus,
        decidedAt: new Date().toISOString(),
        coachNote: note || undefined,
        proposedSlots: slots,
      };

      if (status === 'approved') {
        const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>('physician-appointments', {
          body: {
            action: 'propose_slots',
            appointmentId: request.id,
            slots,
          },
        });
        if (error || !data?.success) {
          setPhysicianPanelError(data?.error ?? error?.message ?? 'Unable to send physician email. Please retry.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }

        const result = await handleSendCoachMessage(
          request.athleteId,
          `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
        );
        if (!result.success) {
          setPhysicianPanelError('Unable to notify athlete. Please try again.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }

      } else {
        await supabase.functions.invoke('physician-appointments', {
          body: { action: 'deny', appointmentId: request.id },
        });
        const result = await handleSendCoachMessage(
          request.athleteId,
          `${PHYSICIAN_RESPONSE_PREFIX} ${JSON.stringify(payload)}`,
        );
        if (!result.success) {
          setPhysicianPanelError('Unable to notify athlete. Please try again.');
          setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
          return;
        }
      }

      setPhysicianDecisionNotes((previous) => ({ ...previous, [request.id]: '' }));
      setPhysicianSlotSelections((previous) => ({ ...previous, [request.id]: [] }));
      refreshCoachInbox();
      setPhysicianActionLoading((previous) => ({ ...previous, [request.id]: false }));
    },
    [handleSendCoachMessage, physicianDecisionNotes, physicianSlotSelections, refreshCoachInbox],
  );

  useEffect(() => {
    if (filteredCheckIns.length === 0) {
      setSelectedCheckIn(null);
      setCoachFeedback('');
      return;
    }

    setSelectedCheckIn((current) => {
      if (current && filteredCheckIns.some((item) => item.id === current.id)) {
        return current;
      }
      return filteredCheckIns[0];
    });
  }, [filteredCheckIns, setSelectedCheckIn]);

  useEffect(() => {
    if (selectedCheckIn) {
      setCoachFeedback(selectedCheckIn.coach_notes ?? '');
    } else {
      setCoachFeedback('');
    }
  }, [selectedCheckIn]);

  useEffect(() => {
    if (messageThreads.length > 0 && !activeConversationUserId) {
      setSelectedConversationUserId(messageThreads[0].userId);
    }
  }, [activeConversationUserId, messageThreads, setSelectedConversationUserId]);

  useEffect(() => {
    if (activeTab !== 'messages') {
      return;
    }
    refreshCoachInbox();
  }, [activeTab, refreshCoachInbox]);

  useEffect(() => {
    if (activeTab !== 'coach') {
      return;
    }
    refreshCoachInbox();
  }, [activeTab, refreshCoachInbox]);

  useEffect(() => {
    if (activeTab !== 'messages') {
      return;
    }
    activeConversationMessages
      .filter((message) => message.receiver_id === adminUserId && !message.is_read)
      .forEach((message) => {
        handleMarkCoachMessageRead(message.id);
      });
  }, [activeTab, activeConversationMessages, adminUserId, handleMarkCoachMessageRead]);

  useEffect(() => {
    if (filteredWorkouts.length === 0) {
      setSelectedAdminWorkoutId(null);
      return;
    }

    setSelectedAdminWorkoutId((current) =>
      current && filteredWorkouts.some((workout) => workout.id === current) ? current : filteredWorkouts[0].id,
    );
  }, [filteredWorkouts]);

  useEffect(() => {
    if (selectedEnrollment && !filteredEnrollments.some((entry) => entry.id === selectedEnrollment.id)) {
      setSelectedEnrollment(null);
    }
  }, [filteredEnrollments, selectedEnrollment, setSelectedEnrollment]);

  useEffect(() => {
    if (selectedCheckIn && !filteredCheckIns.some((entry) => entry.id === selectedCheckIn.id)) {
      setSelectedCheckIn(null);
      setCoachFeedback('');
    }
  }, [filteredCheckIns, selectedCheckIn, setSelectedCheckIn]);

  const selectedEnrollmentHasProfile = Boolean(selectedEnrollment?.profile);
  const selectedEnrollmentContactName = selectedEnrollment ? getEnrollmentName(selectedEnrollment) : null;
  const selectedEnrollmentContactEmail = selectedEnrollment ? getEnrollmentEmail(selectedEnrollment) : null;
  const selectedEnrollmentContactPhone = selectedEnrollment ? getEnrollmentPhone(selectedEnrollment) : null;
  const selectedEnrollmentContactLocation = selectedEnrollment ? getEnrollmentLocation(selectedEnrollment) : null;
  const selectedEnrollmentExperience = selectedEnrollment ? getEnrollmentExperience(selectedEnrollment) : null;
  const selectedEnrollmentProfile = selectedEnrollment?.profile ?? null;
  const selectedEnrollmentAvatar = selectedEnrollmentProfile?.avatar_url ?? null;
  const selectedEnrollmentPresence = selectedEnrollmentProfile ? onlineUsers[selectedEnrollmentProfile.id] : undefined;

  const handleSelectCheckIn = useCallback(
    (checkInId: string) => {
      const match = checkIns.find((entry) => entry.id === checkInId);
      if (match) {
        setSelectedCheckIn(match);
        setCoachFeedback(match.coach_notes ?? '');
      }
    },
    [checkIns, setSelectedCheckIn],
  );

  const selectedAdminWorkout = useMemo(
    () => filteredWorkouts.find((workout) => workout.id === selectedAdminWorkoutId) ?? null,
    [filteredWorkouts, selectedAdminWorkoutId],
  );

  const selectedAdminFocusArea = useMemo(() => getWorkoutFocusArea(selectedAdminWorkout) ?? '', [selectedAdminWorkout]);
  const selectedAdminCoachNotes = useMemo(() => deserializeCoachNotes(selectedAdminWorkout?.coach_notes).coachNotes, [selectedAdminWorkout]);

  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [programModalMode, setProgramModalMode] = useState<'create' | 'edit'>('create');
  const [programForm, setProgramForm] = useState<ProgramFormState>(() => createEmptyProgramForm());
  const [programSaving, setProgramSaving] = useState(false);
  const [programFormError, setProgramFormError] = useState<string | null>(null);
  const [programToEdit, setProgramToEdit] = useState<any | null>(null);

  const openCreateProgramModal = useCallback(() => {
    setProgramModalMode('create');
    setProgramToEdit(null);
    setProgramForm(createEmptyProgramForm());
    setProgramFormError(null);
    setIsProgramModalOpen(true);
  }, []);

  const openEditProgramModal = useCallback((program: any) => {
    setProgramModalMode('edit');
    setProgramToEdit(program);
    setProgramForm({
      title: program.title ?? '',
      subtitle: program.subtitle ?? '',
      description: program.description ?? '',
      program_type: program.program_type ?? 'general_fitness',
      level: program.level ?? 'all_levels',
      duration_weeks:
        program.duration_weeks !== undefined && program.duration_weeks !== null
          ? String(program.duration_weeks)
          : '4',
      price: program.price !== undefined && program.price !== null ? String(program.price) : '0',
      currency: program.currency ?? PROGRAM_DEFAULT_CURRENCY,
      image_url: program.image_url ?? '',
      features: Array.isArray(program.features) ? program.features.join('\n') : '',
      is_popular: Boolean(program.is_popular),
      is_active: Boolean(program.is_active),
      max_participants:
        program.max_participants !== undefined && program.max_participants !== null
          ? String(program.max_participants)
          : '',
      current_participants:
        program.current_participants !== undefined && program.current_participants !== null
          ? String(program.current_participants)
          : '',
    });
    setProgramFormError(null);
    setIsProgramModalOpen(true);
  }, []);

  const closeProgramModal = useCallback(() => {
    if (programSaving) {
      return;
    }
    setIsProgramModalOpen(false);
    setProgramToEdit(null);
    setProgramForm(createEmptyProgramForm());
    setProgramFormError(null);
  }, [programSaving]);

  const handleProgramInputChange = useCallback((field: keyof ProgramFormState, value: string | boolean) => {
    setProgramForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const handleProgramSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (programSaving) {
        return;
      }

      setProgramFormError(null);

      const trimmedTitle = programForm.title.trim();
      if (!trimmedTitle) {
        setProgramFormError('Program title is required.');
        return;
      }

      const durationWeeks = Number(programForm.duration_weeks);
      if (!Number.isFinite(durationWeeks) || durationWeeks <= 0) {
        setProgramFormError('Duration must be a positive number of weeks.');
        return;
      }

      const priceValue = Number(programForm.price);
      if (!Number.isFinite(priceValue) || priceValue < 0) {
        setProgramFormError('Price must be zero or a positive number.');
        return;
      }

      const maxParticipants =
        programForm.max_participants === '' ? null : Number(programForm.max_participants);
      if (
        maxParticipants !== null &&
        (!Number.isFinite(maxParticipants) || Number(maxParticipants) < 0)
      ) {
        setProgramFormError('Max participants must be zero or a positive number.');
        return;
      }

      const currentParticipants =
        programForm.current_participants === '' ? 0 : Number(programForm.current_participants);
      if (!Number.isFinite(currentParticipants) || currentParticipants < 0) {
        setProgramFormError('Current participants must be zero or a positive number.');
        return;
      }

      const featureList = programForm.features
        .split(/\r?\n|,/)
        .map((feature) => feature.trim())
        .filter(Boolean);

      const payload = {
        title: trimmedTitle,
        subtitle: programForm.subtitle.trim() || null,
        description: programForm.description.trim() || null,
        program_type: programForm.program_type,
        level: programForm.level,
        duration_weeks: durationWeeks,
        price: priceValue,
        currency: programForm.currency.trim() || PROGRAM_DEFAULT_CURRENCY,
        image_url: programForm.image_url.trim() || null,
        features: featureList,
        is_popular: programForm.is_popular,
        is_active: programForm.is_active,
        max_participants: maxParticipants,
        current_participants: currentParticipants,
      };

      setProgramSaving(true);
      try {
        const result =
          programModalMode === 'create'
            ? await handleCreateProgram(payload)
            : programToEdit
              ? await handleUpdateProgram(programToEdit.id, payload)
              : null;

        if (result) {
          alert(
            programModalMode === 'create'
              ? 'Program created successfully.'
              : 'Program updated successfully.',
          );
          setIsProgramModalOpen(false);
          setProgramToEdit(null);
          setProgramForm(createEmptyProgramForm());
          setProgramFormError(null);
        }
      } finally {
        setProgramSaving(false);
      }
    },
    [
      handleCreateProgram,
      handleUpdateProgram,
      programForm,
      programModalMode,
      programSaving,
      programToEdit,
    ],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] text-gray-900 flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-gray-200 bg-white text-gray-900 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-400 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-gray-900">
      {/* Header */}
      <div className="bg-white/90 shadow-sm border-b border-gray-200 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={onNavigateBack} className="text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-3">
                <img 
                  src="public/black_logo.png" 
                  alt="Elyes Lift Academy Logo"
                  className="w-16 h-16 object-contain"
                />
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
                  <p className="text-sm text-gray-500">Elyes Lift Academy</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="icon" aria-label="Notifications">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Button>
              <Button onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Enrollments</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalEnrollments}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <BookOpen className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalRevenue} TND</p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Programs</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.activePrograms}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="mb-8 bg-gray-100">
            <TabsTrigger value="overview" className="gap-2">Overview</TabsTrigger>
            <TabsTrigger value="users" className="gap-2">Users</TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-2">Enrollments</TabsTrigger>
            <TabsTrigger value="programs" className="gap-2">Programs</TabsTrigger>
            <TabsTrigger value="check-ins" className="gap-2">
              Check-Ins
              {stats.pendingCheckIns > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-600">
                  {stats.pendingCheckIns}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-2">
              Messages
              {unreadMessages > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-600">
                  {unreadMessages}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contact" className="gap-2">
              Contact Form
              {contactMessages.length > 0 && (
                <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                  {contactMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="workouts" className="gap-2">Workouts</TabsTrigger>
            <TabsTrigger value="coach" className="gap-2">Coach Tools</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filter */}
        {(activeTab === 'users' || activeTab === 'enrollments') && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Status</option>
                {activeTab === 'users' && (
                  <>
                    <option value="user">Users</option>
                    <option value="coach">Coaches</option>
                    <option value="admin">Admins</option>
                  </>
                )}
                {activeTab === 'enrollments' && (
                  <>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'check-ins' && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search check-ins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={checkInStatusFilter}
                onChange={(e) =>
                  setCheckInStatusFilter(
                    e.target.value as 'all' | 'submitted' | 'reviewed' | 'needs_revision',
                  )
                }
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All statuses</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="needs_revision">Needs Revision</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'workouts' && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workouts or athletes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={workoutStatusFilter}
                onChange={(e) =>
                  setWorkoutStatusFilter(
                    e.target.value as 'all' | 'incomplete' | 'needs_review' | 'completed',
                  )
                }
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All workouts</option>
                <option value="incomplete">Incomplete</option>
                <option value="needs_review">Needs review</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Database Health Check */}
            <DatabaseHealthCheck />
            
            {/* Recent Enrollments */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Enrollments</h2>
                <button 
                  onClick={() => setActiveTab('enrollments')}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {recentEnrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{getEnrollmentName(enrollment)}</p>
                          {enrollment.is_women_only && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                              Only women
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">{enrollment.program?.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        enrollment.status === 'active' ? 'bg-green-100 text-green-800' :
                        enrollment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        enrollment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {enrollment.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(enrollment.enrolled_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Check-Ins */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Latest Check-Ins</h2>
                <button
                  onClick={() => setActiveTab('check-ins')}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  Review
                </button>
              </div>
              <div className="space-y-4">
                {recentCheckIns.length > 0 ? (
                  recentCheckIns.map((checkIn) => (
                    <div key={checkIn.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{checkIn.workout?.title}</p>
                        <p className="text-xs text-gray-500">
                          {checkIn.profile?.first_name} {checkIn.profile?.last_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            CHECKIN_STATUS_STYLES[checkIn.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {checkIn.status.replace('_', ' ')}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(checkIn.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-sm text-gray-500">No recent check-ins recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
              <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Experience
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const userPresence = onlineUsers[user.id];
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="relative mr-4 h-10 w-10">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={`${user.first_name || 'User'} avatar`}
                                className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            {userPresence && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {user.phone && (
                            <div className="flex items-center mb-1">
                              <Phone className="w-3 h-3 mr-1 text-gray-400" />
                              {user.phone}
                            </div>
                          )}
                          {user.location && (
                            <div className="flex items-center">
                              <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                              {user.location}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'coach' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userPresence ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                            <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                            <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
                            Offline
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.experience_level}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleSendAccountAccessEmail(user.id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center"
                            title="Send a password setup email to this user"
                          >
                            <Mail className="w-3 h-3 mr-1" />
                            Send Access Email
                          </button>
                          <button 
                            onClick={() => handleViewUserDetails(user)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View Details
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'enrollments' && (
          <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Enrollment Management</h2>
                <p className="text-gray-600 mt-1">Manage program enrollments and payments</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Program
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enrolled
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEnrollments.map((enrollment) => {
                      const isSelected = selectedEnrollment?.id === enrollment.id;
                      const hasProfile = Boolean(enrollment.profile);
                      const enrollmentPresence = enrollment.profile ? onlineUsers[enrollment.profile.id] : undefined;
                      const enrollmentAvatar = enrollment.profile?.avatar_url ?? null;

                      return (
                        <tr
                          key={enrollment.id}
                          onClick={() => setSelectedEnrollment(enrollment)}
                          aria-selected={isSelected}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="relative mr-4 h-10 w-10">
                                {enrollmentAvatar ? (
                                  <img
                                    src={enrollmentAvatar}
                                    alt={`${getEnrollmentName(enrollment)} avatar`}
                                    className="h-10 w-10 rounded-full object-cover border border-gray-200 shadow-sm"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <User className="w-5 h-5" />
                                  </div>
                                )}
                                {enrollmentPresence && (
                                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></span>
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {getEnrollmentName(enrollment)}
                                </div>
                                <div className="text-sm text-gray-500">{getEnrollmentEmail(enrollment)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                              <span>{enrollment.program?.title ?? 'Program unavailable'}</span>
                              {enrollment.is_women_only && (
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                                  Only women
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnrollmentStatusClass(enrollment.status)}`}>
                              {enrollment.status ?? 'unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {enrollment.program?.price != null
                              ? `${enrollment.program.price} ${enrollment.program?.currency ?? ''}`.trim()
                              : 'Not set'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedEnrollment(enrollment);
                                }}
                                className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                title="View enrollment details"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Details
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (enrollment.profile) {
                                    handleViewUserDetails(enrollment.profile);
                                  }
                                }}
                                disabled={!hasProfile}
                                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                  hasProfile
                                    ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                                }`}
                                title={hasProfile ? 'Open user profile' : 'User profile unavailable'}
                              >
                                <User className="w-3 h-3 mr-1" />
                                User
                              </button>
                              {enrollment.status === 'pending' && (
                                <>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      approveEnrollment(enrollment.id);
                                    }}
                                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                    title="Approve enrollment and create user account if needed"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteEnrollment(enrollment.id);
                                    }}
                                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    title="Delete enrollment"
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Enrollment Details</h3>
                <p className="text-sm text-gray-500">Review the learner&apos;s profile and enrollment progress</p>
              </div>
              <div className="p-6">
                {selectedEnrollment ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">Program</span>
                        <h4 className="mt-1 text-xl font-bold text-gray-900">
                          {selectedEnrollment.program?.title ?? 'Program not available'}
                        </h4>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {selectedEnrollment.status ?? 'unknown'}
                          </div>
                          {selectedEnrollment.is_women_only && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                              Only women
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {selectedEnrollment.enrolled_at
                            ? `Enrolled ${new Date(selectedEnrollment.enrolled_at).toLocaleDateString()}`
                            : 'Enrolled date unavailable'}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedEnrollment(null)}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Clear
                      </button>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Student Information</h4>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="relative h-12 w-12">
                            {selectedEnrollmentAvatar ? (
                              <img
                                src={selectedEnrollmentAvatar}
                                alt={`${selectedEnrollmentContactName ?? 'Student'} avatar`}
                                className="h-12 w-12 rounded-full object-cover border border-gray-200 shadow-sm"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            {selectedEnrollmentPresence && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"></span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedEnrollmentContactName ?? 'No contact provided'}
                            </p>
                            <div className="mt-1 flex items-center text-xs text-gray-500 gap-2">
                              <Mail className="w-3 h-3" />
                              <span>{selectedEnrollmentContactEmail ?? 'Email not provided'}</span>
                            </div>
                            <div className="mt-1 flex items-center text-xs text-gray-500 gap-2">
                              <Phone className="w-3 h-3" />
                              <span>{selectedEnrollmentContactPhone ?? 'Phone not provided'}</span>
                            </div>
                            <div className="mt-1 flex items-center text-xs text-gray-500 gap-2">
                              <MapPin className="w-3 h-3" />
                              <span>{selectedEnrollmentContactLocation ?? 'Location not provided'}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">User Details</h4>
                      {selectedEnrollmentHasProfile ? (
                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Role</p>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {selectedEnrollmentProfile?.role ?? 'Not specified'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Experience Level</p>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {selectedEnrollmentProfile?.experience_level ?? 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Member Since</p>
                            <p className="text-sm font-medium text-gray-900">
                              {selectedEnrollmentProfile?.created_at
                                ? new Date(selectedEnrollmentProfile.created_at).toLocaleDateString()
                                : 'Unknown'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2 rounded-lg border border-dashed border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                          <p className="font-medium">Account not created yet</p>
                          <p>
                            The athlete still needs to sign up for an account. Their preferred experience level is{' '}
                            <span className="font-semibold">{selectedEnrollmentExperience ?? 'Not provided'}</span>.
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Enrollment Metrics</h4>
                      <div className="mt-3 space-y-3">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Status</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnrollmentStatusClass(selectedEnrollment.status)}`}>
                            {selectedEnrollment.status ?? 'unknown'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Progress</span>
                          <span className="font-medium text-gray-900">
                            {selectedEnrollment.progress_percentage != null
                              ? `${selectedEnrollment.progress_percentage}%`
                              : 'Not tracked'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>Program Price</span>
                          <span className="font-medium text-gray-900">
                            {selectedEnrollment.program?.price != null
                              ? `${selectedEnrollment.program.price} ${selectedEnrollment.program?.currency ?? ''}`.trim()
                              : 'Not set'}
                          </span>
                        </div>
                        {selectedEnrollment.start_date && (
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>Start Date</span>
                            <span className="font-medium text-gray-900">
                              {new Date(selectedEnrollment.start_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {selectedEnrollment.end_date && (
                          <div className="flex items-center justify-between text-sm text-gray-600">
                            <span>End Date</span>
                            <span className="font-medium text-gray-900">
                              {new Date(selectedEnrollment.end_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedEnrollment.notes && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Application Notes</h4>
                        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-4">
                          {selectedEnrollment.notes}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setSelectedEnrollment(null)}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear Selection
                      </button>
                      <button
                        onClick={() => {
                          if (selectedEnrollmentProfile) {
                            handleViewUserDetails(selectedEnrollmentProfile);
                          }
                        }}
                        disabled={!selectedEnrollmentHasProfile}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          selectedEnrollmentHasProfile
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <User className="w-4 h-4 mr-2" />
                        User Profile
                      </button>
                      {selectedEnrollment.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveEnrollment(selectedEnrollment.id)}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </button>
                          <button
                            onClick={() => deleteEnrollment(selectedEnrollment.id)}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p>Select an enrollment to see user details.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'programs' && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Program Management</h2>
                  <p className="text-gray-600 mt-1">Manage training programs and content</p>
                </div>
                <button 
                  type="button"
                  onClick={openCreateProgramModal}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Program
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {programs.map((program) => (
                <div key={program.id} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">{program.title}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditProgramModal(program)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProgram(program.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">{program.subtitle}</p>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Duration:</span>
                      <span className="font-medium">{program.duration_weeks} weeks</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-medium">{program.price} {program.currency}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Level:</span>
                      <span className="font-medium capitalize">{program.level}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Participants:</span>
                      <span className="font-medium">{program.current_participants}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      program.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {program.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {program.is_popular && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center">
                        <Star className="w-3 h-3 mr-1" />
                        Popular
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'check-ins' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Check-In Submissions</h2>
                <span className="text-sm text-gray-500">{filteredCheckIns.length} records</span>
              </div>
              <div className="space-y-3">
                {filteredCheckIns.map((checkIn) => {
                  const isSelected = selectedCheckIn?.id === checkIn.id;
                  const statusClass = CHECKIN_STATUS_STYLES[checkIn.status] ?? 'bg-gray-100 text-gray-700';
                  return (
                    <button
                      key={checkIn.id}
                      onClick={() => handleSelectCheckIn(checkIn.id)}
                      className={`w-full text-left border rounded-xl p-4 transition ${
                        isSelected ? 'border-red-500 bg-red-50/70' : 'border-gray-200 bg-white hover:border-red-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {checkIn.profile?.first_name} {checkIn.profile?.last_name}
                          </div>
                          <div className="text-xs text-gray-500">{checkIn.profile?.email}</div>
                          <div className="mt-2 text-sm text-gray-700">{checkIn.workout?.title}</div>
                        </div>
                        <div className="text-right space-y-2">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}>
                            {checkIn.status.replace('_', ' ')}
                          </span>
                          <div className="text-xs text-gray-400">
                            {new Date(checkIn.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {checkIn.readiness_score && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100">
                            Readiness {checkIn.readiness_score}/10
                          </span>
                        )}
                        {checkIn.energy_level && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                            Energy: {checkIn.energy_level}
                          </span>
                        )}
                        {checkIn.soreness_level && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-purple-50 text-purple-600">
                            Soreness: {checkIn.soreness_level}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredCheckIns.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No check-ins match the selected filters.</p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {selectedCheckIn ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{selectedCheckIn.workout?.title}</h3>
                      <p className="text-sm text-gray-500">
                        {selectedCheckIn.profile?.first_name} {selectedCheckIn.profile?.last_name}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        CHECKIN_STATUS_STYLES[selectedCheckIn.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedCheckIn.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      Submitted {new Date(selectedCheckIn.created_at).toLocaleString()}
                    </div>
                    {selectedCheckIn.readiness_score && (
                      <div className="flex items-center">
                        <Activity className="w-4 h-4 text-gray-400 mr-2" />
                        Readiness {selectedCheckIn.readiness_score}/10
                      </div>
                    )}
                    {selectedCheckIn.energy_level && (
                      <div className="flex items-center">
                        <Zap className="w-4 h-4 text-gray-400 mr-2" />
                        Energy level: {selectedCheckIn.energy_level}
                      </div>
                    )}
                    {selectedCheckIn.soreness_level && (
                      <div className="flex items-center">
                        <Heart className="w-4 h-4 text-gray-400 mr-2" />
                        Soreness: {selectedCheckIn.soreness_level}
                      </div>
                    )}
                  </div>
                  {selectedCheckIn.notes && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Athlete Notes</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        {selectedCheckIn.notes}
                      </p>
                    </div>
                  )}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Attachments</h4>
                    {selectedCheckIn.media && selectedCheckIn.media.length > 0 ? (
                      <div className="space-y-2">
                        {selectedCheckIn.media.map((media) => (
                          <a
                            key={media.id}
                            href={media.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors"
                          >
                            <div className="flex items-center space-x-2">
                              <PlayCircle className="w-4 h-4 text-red-500" />
                              <span>{media.media_type === 'video' ? 'Video' : 'Image'} attachment</span>
                            </div>
                            <Download className="w-4 h-4" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No media attached.</p>
                    )}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Coach Response</label>
                    <textarea
                      value={coachFeedback}
                      onChange={(event) => setCoachFeedback(event.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="Share guidance or request updated footage..."
                    ></textarea>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={isUpdatingCheckIn || !coachFeedback.trim()}
                      onClick={async () => {
                        if (!selectedCheckIn || !coachFeedback.trim()) {
                          alert('Please add feedback before requesting an update.');
                          return;
                        }
                        setIsUpdatingCheckIn(true);
                        await handleReviewCheckIn(selectedCheckIn.id, 'needs_revision', coachFeedback.trim());
                        setIsUpdatingCheckIn(false);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-yellow-400 text-yellow-700 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Request Update
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingCheckIn}
                      onClick={async () => {
                        if (!selectedCheckIn) {
                          return;
                        }
                        setIsUpdatingCheckIn(true);
                        await handleReviewCheckIn(
                          selectedCheckIn.id,
                          'reviewed',
                          coachFeedback.trim() ? coachFeedback.trim() : undefined,
                        );
                        setIsUpdatingCheckIn(false);
                      }}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Reviewed
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <List className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">Select a check-in to review details.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'coach' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Physician appointments</h3>
                  <p className="mt-1 text-xs text-gray-500">Filter and review athlete requests.</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-500">Status</label>
                  <select
                    value={physicianStatusFilter}
                    onChange={(event) =>
                      setPhysicianStatusFilter(event.target.value as typeof physicianStatusFilter)
                    }
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="slots_proposed">Slots proposed</option>
                    <option value="slot_selected">Scheduled</option>
                    <option value="denied">Denied</option>
                  </select>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-600">
                    {physicianRequests.filter((req) => req.status === 'pending').length} pending
                  </span>
                </div>
              </div>
              {physicianPanelError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {physicianPanelError}
                </div>
              )}
              {physicianRequests.filter((req) =>
                physicianStatusFilter === 'all' ? true : req.status === physicianStatusFilter,
              ).length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">No physician appointment requests for this filter.</p>
              ) : (
                <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {physicianRequests
                    .filter((req) => (physicianStatusFilter === 'all' ? true : req.status === physicianStatusFilter))
                    .map((request) => (
                      <div key={request.id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{request.athleteName}</p>
                            <p className="text-xs text-gray-500">{request.dateLabel}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-200">
                              {request.sessionType}
                            </span>
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700 border border-gray-200">
                              {request.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-700">
                          {request.sessionDetails || 'No additional details provided.'}
                        </p>
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Select time slots</p>
                          <div className="flex flex-wrap gap-2">
                            {DEFAULT_APPOINTMENT_SLOTS.map((slot) => {
                              const selected = (physicianSlotSelections[request.id] ?? []).includes(slot);
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() =>
                                    setPhysicianSlotSelections((previous) => {
                                      const current = previous[request.id] ?? [];
                                      const exists = current.includes(slot);
                                      const next = exists ? current.filter((s) => s !== slot) : [...current, slot];
                                      return { ...previous, [request.id]: next };
                                    })
                                  }
                                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                    selected
                                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                      : 'border-gray-200 bg-white text-gray-700'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => handlePhysicianDecision(request, 'approved')}
                            disabled={physicianActionLoading[request.id]}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {physicianActionLoading[request.id] ? 'Sending...' : 'Approve & email partner'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePhysicianDecision(request, 'denied')}
                            disabled={physicianActionLoading[request.id]}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Deny & notify athlete
                          </button>
                        </div>
                        <div className="mt-3">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 block mb-1">
                            Coach note to athlete
                          </label>
                          <textarea
                            value={physicianDecisionNotes[request.id] ?? ''}
                            onChange={(event) =>
                              setPhysicianDecisionNotes((previous) => ({ ...previous, [request.id]: event.target.value }))
                            }
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                            placeholder="Explain denial or add prep instructions."
                          />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            {coachManagementError && (
              <div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{coachManagementError}</span>
                <button
                  type="button"
                  onClick={handleDismissCoachAlert}
                  className="ml-4 text-red-500 hover:text-red-700"
                  aria-label="Dismiss coach error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {coachActionNotice && (
              <div className="flex items-start justify-between rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <span>{coachActionNotice}</span>
                <button
                  type="button"
                  onClick={() => setCoachActionNotice(null)}
                  className="ml-4 text-green-600 hover:text-green-800"
                  aria-label="Dismiss coach success notice"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {coachCreationResult && (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-yellow-700">
                      New coach credentials
                    </h3>
                    <p className="text-sm text-yellow-800">
                      Share these details securely. The password is only shown once.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyGeneratedPassword}
                      className="inline-flex items-center gap-2 rounded-lg border border-yellow-400 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-yellow-700 hover:bg-yellow-100"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Copy credentials
                    </button>
                    <button
                      type="button"
                      onClick={() => clearCoachManagementStatus({ clearResult: true })}
                      className="inline-flex items-center justify-center rounded-lg border border-yellow-300 bg-white p-2 text-yellow-600 hover:bg-yellow-100"
                      aria-label="Hide credentials"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-yellow-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{coachCreationResult.email}</p>
                  </div>
                  <div className="rounded-xl border border-yellow-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Password</p>
                    <p className="mt-1 text-sm font-mono text-gray-900">{coachCreationResult.password}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <form
                onSubmit={handleCoachFormSubmit}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Create Coach Account</h3>
                    {showCreateCoachCard && (
                      <p className="text-sm text-gray-500">
                        Generate a new coach login with a secure password and optional contact details.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateCoachCard((prev) => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                    aria-label={showCreateCoachCard ? 'Collapse create coach form' : 'Expand create coach form'}
                  >
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${showCreateCoachCard ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>

                {showCreateCoachCard && (
                  <>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">First Name</label>
                        <input
                          value={newCoachForm.firstName}
                          onChange={(event) => setNewCoachForm((prev) => ({ ...prev, firstName: event.target.value }))}
                          required
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Sami"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Name</label>
                        <input
                          value={newCoachForm.lastName}
                          onChange={(event) => setNewCoachForm((prev) => ({ ...prev, lastName: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="Doe"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</label>
                        <input
                          type="email"
                          value={newCoachForm.email}
                          onChange={(event) => setNewCoachForm((prev) => ({ ...prev, email: event.target.value }))}
                          required
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="coach@example.com"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone (optional)</label>
                        <input
                          type="tel"
                          value={newCoachForm.phone}
                          onChange={(event) => setNewCoachForm((prev) => ({ ...prev, phone: event.target.value }))}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="+216 12 345 678"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isCreatingCoach}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCreatingCoach ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Create Coach
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Assign Athletes to Coach</h3>
                    {showAssignCoachCard && (
                      <p className="text-sm text-gray-500">
                        Select a coach and toggle the athletes they support. Reassigning will move an athlete from their current coach.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAssignCoachCard((prev) => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                    aria-label={showAssignCoachCard ? 'Collapse assignment panel' : 'Expand assignment panel'}
                  >
                    <ChevronDown className={`h-5 w-5 transition-transform ${showAssignCoachCard ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showAssignCoachCard && (
                  <>
                    {coachUsers.length === 0 ? (
                      <p className="mt-6 text-sm text-gray-500">
                        Create a coach account to start assigning athletes.
                      </p>
                    ) : (
                      <>
                        <div className="mt-4 space-y-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coach</label>
                          <select
                            value={selectedCoachIdForAssignments ?? ''}
                            onChange={(event) => setSelectedCoachIdForAssignments(event.target.value || null)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
                          >
                            {coachUsers.map((coach) => {
                              const name = `${coach.first_name ?? ''} ${coach.last_name ?? ''}`.trim() || coach.email;
                              return (
                                <option key={coach.id} value={coach.id}>
                                  {name}
                                </option>
                              );
                            })}
                          </select>
                          {selectedCoachProfile && (
                            <p className="text-xs text-gray-500">{selectedCoachProfile.email}</p>
                          )}
                        </div>

                        <div className="mt-4 max-h-72 overflow-y-auto space-y-3 pr-1">
                          {athleteUsers.length === 0 ? (
                            <p className="text-sm text-gray-500">No athletes available yet.</p>
                          ) : (
                            athleteUsers.map((athlete) => {
                              const userId = athlete.id;
                              const isSelected = selectedUserIdsForCoach.includes(userId);
                              const assignedCoachId = assignedCoachByUserId.get(userId) ?? null;
                              const assignedCoachName = assignedCoachId ? coachNameById.get(assignedCoachId) : null;
                              const isAssignedElsewhere =
                                assignedCoachId && assignedCoachId !== selectedCoachIdForAssignments;

                              return (
                                <label
                                  key={userId}
                                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                                    isSelected ? 'border-red-300 bg-red-50/70' : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                                    checked={isSelected}
                                    onChange={() => toggleUserSelection(userId)}
                                  />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      {`${athlete.first_name ?? ''} ${athlete.last_name ?? ''}`.trim() ||
                                        athlete.email}
                                    </p>
                                    <p className="text-xs text-gray-500">{athlete.email}</p>
                                    {assignedCoachName && (
                                      <p
                                        className={`mt-1 text-xs ${
                                          isAssignedElsewhere ? 'text-red-600' : 'text-gray-500'
                                        }`}
                                      >
                                        Currently: {assignedCoachName}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={handleResetUserSelections}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={handleUserAssignmentSave}
                            disabled={isAssigningUsers || !selectedCoachIdForAssignments}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {isAssigningUsers ? (
                              <>
                                <Loader className="h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4" />
                                Save assignments
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

            </div>

            <div className="rounded-3xl border border-gray-100 bg-gray-50 p-2 md:p-4">
              <CoachDashboard
                onNavigateHome={() => setActiveTab('overview')}
                onNavigateSettings={() => setActiveTab('users')}
                onNavigateProgress={() => setActiveTab('workouts')}
              />
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
                <button
                  onClick={refreshCoachInbox}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-3">
                {messageThreads.length > 0 ? (
                  messageThreads.map((thread) => {
                    const isActive = activeConversationUserId === thread.userId;
                    return (
                      <button
                        key={thread.userId}
                        onClick={() => setSelectedConversationUserId(thread.userId)}
                        className={`w-full text-left border rounded-xl px-4 py-3 transition ${
                          isActive ? 'border-red-500 bg-red-50/70' : 'border-gray-200 bg-white hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{thread.profileName}</p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {thread.lastMessage.message}
                            </p>
                          </div>
                          {thread.unread > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-600">
                              {thread.unread}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] uppercase tracking-wide text-gray-400">
                          {new Date(thread.lastMessage.created_at).toLocaleString()}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-sm text-gray-500">
                    <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    No conversations yet. Athlete messages will appear here.
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col">
              {activeConversationUserId ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
                      <p className="text-xs text-gray-500">
                        Chat with {messageThreads.find((thread) => thread.userId === activeConversationUserId)?.profileName ?? 'athlete'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4 overflow-y-auto space-y-3">
                    {activeConversationMessages.length > 0 ? (
                      activeConversationMessages.map((message) => {
                        const isCoach = message.sender_id === adminUserId;
                        return (
                          <div key={message.id} className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                isCoach ? 'bg-red-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'
                              }`}
                            >
                              <p>{message.message}</p>
                              <p className={`mt-2 text-[10px] uppercase tracking-wide ${isCoach ? 'text-red-100' : 'text-gray-400'}`}>
                                {new Date(message.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-12 text-center text-sm text-gray-500">
                        No messages in this conversation yet.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    <textarea
                      rows={4}
                      value={coachReplyBody}
                      onChange={(event) => {
                        setCoachReplyBody(event.target.value);
                        setCoachReplyError(null);
                      }}
                      placeholder="Write a reply..."
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    />
                    {coachReplyError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {coachReplyError}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        Messages are visible to the athlete immediately.
                      </p>
                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={isSendingMessage || !coachReplyBody.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                      >
                        {isSendingMessage ? <Loader className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        {isSendingMessage ? 'Sending...' : 'Send reply'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500">
                  <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
                  Select a conversation to begin responding to athletes.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Contact Form Messages</h2>
                  <p className="text-xs text-gray-500">Newest submissions from the website contact form.</p>
                </div>
                <button
                  onClick={reload}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-red-300 hover:text-red-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={contactSearchTerm}
                  onChange={(event) => setContactSearchTerm(event.target.value)}
                  placeholder="Search name, email, or topic..."
                  className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {filteredContactMessages.length > 0 ? (
                  filteredContactMessages.map((entry) => {
                    const isActive = selectedContactMessage?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedContactId(entry.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                          isActive ? 'border-red-500 bg-red-50/70' : 'border-gray-200 bg-white hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                            <p className="text-xs text-gray-500">{entry.email}</p>
                            {entry.topic && (
                              <p className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                                {entry.topic}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600 line-clamp-2">{entry.message}</p>
                      </button>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-sm text-gray-500">
                    <Mail className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    No contact messages yet.
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {selectedContactMessage ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">From</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedContactMessage.name}</p>
                      <a
                        href={`mailto:${selectedContactMessage.email}`}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {selectedContactMessage.email}
                      </a>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Received</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {new Date(selectedContactMessage.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span>{selectedContactMessage.topic || 'No subject provided'}</span>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedContactMessage.message}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`mailto:${selectedContactMessage.email}?subject=${encodeURIComponent(
                        `Re: ${selectedContactMessage.topic || 'Elyes Lift Academy'}`,
                      )}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      <Mail className="w-4 h-4" />
                      Reply via email
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-500">
                  <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
                  Select a contact submission to read the full message.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'workouts' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Workouts</h2>
                <span className="text-sm text-gray-500">{filteredWorkouts.length} scheduled</span>
              </div>
              <div className="space-y-3">
                {filteredWorkouts.map((workout) => {
                  const isSelected = selectedAdminWorkout?.id === workout.id;
                  const latestCheckIn = workout.checkins?.[0];
                  const statusLabel = latestCheckIn?.status ?? (workout.is_completed ? 'completed' : 'pending');
                  const statusClass =
                    latestCheckIn?.status && CHECKIN_STATUS_STYLES[latestCheckIn.status]
                      ? CHECKIN_STATUS_STYLES[latestCheckIn.status]
                      : workout.is_completed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-700';
                  const focusArea = getWorkoutFocusArea(workout);
                  return (
                    <button
                      key={workout.id}
                      onClick={() => setSelectedAdminWorkoutId(workout.id)}
                      className={`w-full text-left border rounded-xl p-4 transition ${
                        isSelected ? 'border-red-500 bg-red-50/70' : 'border-gray-200 bg-white hover:border-red-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{workout.title}</div>
                          <div className="text-xs text-gray-500">
                            {workout.profile?.first_name} {workout.profile?.last_name}{' | '}
                            Day {workout.day_number}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            {focusArea && <span>Focus: {focusArea}</span>}
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                                workout.is_template
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              <Users className="w-3 h-3 mr-1" />
                              {workout.is_template ? 'Program template' : 'Athlete specific'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${statusClass}`}
                          >
                            {statusLabel.replace('_', ' ')}
                          </span>
                          <div className="text-xs text-gray-400">{workout.checkins?.length ?? 0} check-ins</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {filteredWorkouts.length === 0 && (
                <div className="text-center py-12">
                  <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No workouts match the selected filters.</p>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {selectedAdminWorkout ? (
                <>
                  <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedAdminWorkout.title}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedAdminWorkout.profile?.first_name} {selectedAdminWorkout.profile?.last_name}
                    </p>
                    <div className="mt-1 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      <Users className="w-3 h-3 mr-1" />
                      {selectedAdminWorkout.is_template
                        ? `Program template${selectedAdminWorkout.program?.title ? ` · ${selectedAdminWorkout.program?.title}` : ''}`
                        : 'Athlete specific'}
                    </div>
                  </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedAdminWorkout.is_completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {selectedAdminWorkout.is_completed ? 'Completed' : 'Scheduled'}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      Day {selectedAdminWorkout.day_number}
                    </div>
                    {selectedAdminWorkout.duration_minutes && (
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        {selectedAdminWorkout.duration_minutes} minutes
                      </div>
                    )}
                    {selectedAdminFocusArea && (
                      <div className="flex items-center">
                        <Target className="w-4 h-4 text-gray-400 mr-2" />
                        Focus: {selectedAdminFocusArea}
                      </div>
                    )}
                    {selectedAdminWorkout.program?.title && (
                      <div className="flex items-center">
                        <BookOpen className="w-4 h-4 text-gray-400 mr-2" />
                        Program: {selectedAdminWorkout.program?.title}
                      </div>
                    )}
                  </div>
                  {selectedAdminCoachNotes && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Coach Notes</h4>
                      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                        {selectedAdminCoachNotes}
                      </p>
                    </div>
                  )}
                  {selectedAdminWorkout.workout_exercises && selectedAdminWorkout.workout_exercises.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">Exercises</h4>
                      <ul className="space-y-2 text-sm text-gray-600">
                        {selectedAdminWorkout.workout_exercises.slice(0, 6).map((exercise) => (
                          <li key={exercise.id} className="flex items-center justify-between">
                            <span>{exercise.exercise_name}</span>
                            <span className="text-xs text-gray-400">
                              {exercise.target_sets ?? '-'} sets x {exercise.target_reps ?? '-'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {selectedAdminWorkout.workout_exercises.length > 6 && (
                        <p className="text-xs text-gray-400 mt-1">
                          +{selectedAdminWorkout.workout_exercises.length - 6} more exercises
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">Check-Ins</h4>
                    {selectedAdminWorkout.checkins && selectedAdminWorkout.checkins.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAdminWorkout.checkins.map((checkIn) => (
                          <div
                            key={checkIn.id}
                            className="flex items-center justify-between text-xs text-gray-600 border border-gray-200 rounded-lg px-3 py-2"
                          >
                            <div>
                              <p className="font-medium">{new Date(checkIn.created_at).toLocaleString()}</p>
                              <p className="text-gray-500 capitalize">Status: {checkIn.status.replace('_', ' ')}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectCheckIn(checkIn.id);
                                setActiveTab('check-ins');
                              }}
                              className="text-sm text-red-600 hover:text-red-700 font-medium"
                            >
                              Review
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No check-ins submitted for this workout yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">Select a workout to view details.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Program Modal */}
      {isProgramModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">
                  {programModalMode === 'create' ? 'Create Program' : 'Edit Program'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {programModalMode === 'create'
                    ? 'Define a new training program for the academy.'
                    : 'Update the details of this training program.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProgramModal}
                disabled={programSaving}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleProgramSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={programForm.title}
                    onChange={(event) => handleProgramInputChange('title', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Strong Foundations"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={programForm.subtitle}
                    onChange={(event) => handleProgramInputChange('subtitle', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="12-week strength accelerator"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={programForm.description}
                    onChange={(event) => handleProgramInputChange('description', event.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Share program goals, coaching style, weekly structure..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Program Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={programForm.program_type}
                    onChange={(event) => handleProgramInputChange('program_type', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 capitalize"
                  >
                    {PROGRAM_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={programForm.level}
                    onChange={(event) => handleProgramInputChange('level', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 capitalize"
                  >
                    {PROGRAM_LEVELS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (weeks) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={programForm.duration_weeks}
                    onChange={(event) => handleProgramInputChange('duration_weeks', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={programForm.price}
                    onChange={(event) => handleProgramInputChange('price', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={programForm.currency}
                    onChange={(event) =>
                      handleProgramInputChange('currency', event.target.value.toUpperCase())
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
                    maxLength={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={programForm.image_url}
                    onChange={(event) => handleProgramInputChange('image_url', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants</label>
                  <input
                    type="number"
                    min={0}
                    value={programForm.max_participants}
                    onChange={(event) => handleProgramInputChange('max_participants', event.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Participants</label>
                  <input
                    type="number"
                    min={0}
                    value={programForm.current_participants}
                    onChange={(event) =>
                      handleProgramInputChange('current_participants', event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Features</label>
                <textarea
                  value={programForm.features}
                  onChange={(event) => handleProgramInputChange('features', event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="One feature per line (e.g. Weekly check-ins)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="inline-flex items-center space-x-3 rounded-xl border border-gray-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={programForm.is_active}
                    onChange={(event) => handleProgramInputChange('is_active', event.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Program is active</span>
                </label>
                <label className="inline-flex items-center space-x-3 rounded-xl border border-gray-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={programForm.is_popular}
                    onChange={(event) => handleProgramInputChange('is_popular', event.target.checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">Show as popular</span>
                </label>
              </div>

              {programFormError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {programFormError}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeProgramModal}
                  disabled={programSaving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={programSaving}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:bg-red-600/60"
                >
                  {programSaving
                    ? 'Saving...'
                    : programModalMode === 'create'
                      ? 'Create Program'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    {selectedUser.avatar_url ? (
                      <img
                        src={selectedUser.avatar_url}
                        alt={`${selectedUser.first_name || 'User'} avatar`}
                        className="h-16 w-16 rounded-full object-cover border-2 border-white/40 shadow-lg"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-blue-600 ${
                        selectedUserPresence ? 'bg-emerald-300' : 'bg-blue-300'
                      }`}
                    ></span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">User Details</h2>
                    <p className="text-blue-100">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <div className="mt-1 flex items-center text-xs font-medium text-blue-100 gap-2">
                      {selectedUserPresence ? (
                        <>
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
                          Online now
                        </>
                      ) : (
                        <>
                          <span className="inline-flex h-2 w-2 rounded-full bg-blue-200"></span>
                          Offline
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* User Profile Information */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Full Name</div>
                      <div className="font-medium text-gray-900">
                        {selectedUser.first_name} {selectedUser.last_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-medium text-gray-900">{selectedUser.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Phone</div>
                      <div className="font-medium text-gray-900">{selectedUser.phone || 'Not provided'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Location</div>
                      <div className="font-medium text-gray-900">{selectedUser.location || 'Not provided'}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Award className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Role</div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedUser.role === 'admin' ? 'bg-red-100 text-red-800' :
                        selectedUser.role === 'coach' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedUser.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Experience Level</div>
                      <div className="font-medium text-gray-900 capitalize">{selectedUser.experience_level}</div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-400 mr-3" />
                    <div>
                      <div className="text-sm text-gray-500">Member Since</div>
                      <div className="font-medium text-gray-900">
                        {new Date(selectedUser.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Enrollments */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Program Enrollments</h3>
                  {loadingUserDetails && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  )}
                </div>
                
                {userEnrollments.length > 0 ? (
                  <div className="space-y-4">
                    {userEnrollments.map((enrollment) => (
                      <div key={enrollment.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{enrollment.program?.title}</h4>
                              {enrollment.is_women_only && (
                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                                  Only women
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              Enrolled: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            enrollment.status === 'active' ? 'bg-green-100 text-green-800' :
                            enrollment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            enrollment.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {enrollment.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            Progress: {enrollment.progress_percentage}% | Price: {enrollment.program?.price} {enrollment.program?.currency}
                          </div>
                          <div className="flex items-center space-x-2">
                            {enrollment.status === 'pending' && (
                              <button 
                                onClick={() => handleUpdateEnrollmentStatus(enrollment.id, 'active')}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            {enrollment.status === 'active' && (
                              <button 
                                onClick={() => handleUpdateEnrollmentStatus(enrollment.id, 'completed')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                              >
                                Complete
                              </button>
                            )}
                            <button 
                              onClick={() => handleUpdateEnrollmentStatus(enrollment.id, 'completed')}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                            >
                              End Program
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No program enrollments</p>
                    <p className="text-sm text-gray-500">This user hasn't enrolled in any programs yet</p>
                  </div>
                )}
              </div>

              {/* User Management Actions */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Management</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 mb-1">Danger Zone</h4>
                      <p className="text-sm text-red-700 mb-3">
                        Deleting this user will permanently remove their account, profile, enrollments, 
                        workouts, and all associated data. This action cannot be undone.
                      </p>
                      <button 
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete User Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
