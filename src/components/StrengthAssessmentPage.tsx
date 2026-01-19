import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  Calculator, 
  Target, 
  TrendingUp, 
  Award, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Dumbbell, 
  BarChart3, 
  CheckCircle, 
  AlertCircle, 
  Star,
  Clock,
  Trophy,
  ArrowRight,
  RefreshCw,
  Info,
  Scale,
  Activity,
  Zap,
  Medal,
  Crown,
  Flame,
  Download,
  Eye,
  HelpCircle
} from 'lucide-react';

import PageTransitionOverlay from './PageTransitionOverlay';
import EnrollmentModal from './EnrollmentModal';
import { getPrograms } from '../lib/supabase';
import type { Program } from '../lib/supabase';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

interface StrengthAssessmentPageProps {
  onNavigateBack: () => void;
}

interface AssessmentData {
  personalInfo: {
    age: number;
    gender: 'male' | 'female';
    bodyweight: number;
    unit: 'kg' | 'lbs';
    experience: string;
  };
  lifts: {
    // Powerlifting
    squat: number;
    bench: number;
    deadlift: number;
    // Weightlifting
    snatch: number;
    cleanAndJerk: number;
    // Shared/Optional
    overhead: number;
    frontSquat: number;
    row: number;
    pullup: number;
    dip: number;
    inclineBench: number;
    sumoDeadlift: number;
    closeGripBench: number;
    pendlayRow: number;
    backSquat: number;
    powerClean: number;
    powerSnatch: number;
    pushPress: number;
    hangClean: number;
    hangSnatch: number;
  };
  goals: string[];
  limitations: string;
}

interface StrengthLevel {
  level: string;
  color: string;
  bgColor: string;
  description: string;
  icon: React.ReactNode;
  percentile: number;
}

type SelectionMessage = {
  text: string;
  variant: 'success' | 'error' | 'info';
};

type RecommendedProgram = {
  id: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  match: number;
  reasons: string[];
  program: Program;
};

type StrengthGaugeSegment = {
  label: string;
  min: number;
  max: number;
  color: string;
  description: string;
};

const STRENGTH_GAUGE_SEGMENTS: StrengthGaugeSegment[] = [
  { label: 'Untrained', min: 0, max: 20, color: '#ef4444', description: 'You are developing baseline movement patterns and capacity. Focus on consistent practice and technique.' },
  { label: 'Novice', min: 20, max: 40, color: '#f97316', description: 'You have foundational strength. Progressive overload and structured practice will drive rapid progress.' },
  { label: 'Intermediate', min: 40, max: 60, color: '#eab308', description: 'You are well-developed and now need thoughtful periodisation to keep improving.' },
  { label: 'Advanced', min: 60, max: 80, color: '#22c55e', description: 'You are performing at a high level. Small technical gains and recovery strategy matter most.' },
  { label: 'Elite', min: 80, max: 100, color: '#6366f1', description: 'You are in the top tier for your class. Competition-level execution and precision keep you ahead.' }
];

const clampPercentile = (value: number) => Math.min(100, Math.max(0, value));

interface StrengthSpectrumChartProps {
  percentile: number;
  currentLevel: string;
}

const StrengthSpectrumChart = ({ percentile, currentLevel }: StrengthSpectrumChartProps) => {
  const clampedPercentile = clampPercentile(percentile);
  const markerLeft = Math.min(99.5, Math.max(0.5, clampedPercentile));
  const activeSegment = STRENGTH_GAUGE_SEGMENTS.find((segment) => clampedPercentile >= segment.min && clampedPercentile <= segment.max) ?? STRENGTH_GAUGE_SEGMENTS[0];

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Overall Percentile</span>
        <span className="text-3xl font-bold text-white">
          {Math.round(clampedPercentile)}
          <span className="text-base font-semibold text-white/70">th</span>
        </span>
      </div>

      <div className="relative h-6 w-full overflow-hidden rounded-full border border-white/20 bg-white/10">
        {STRENGTH_GAUGE_SEGMENTS.map((segment) => (
          <div
            key={segment.label}
            className="absolute inset-y-0"
            style={{
              left: `${segment.min}%`,
              width: `${segment.max - segment.min}%`,
              background: `linear-gradient(90deg, ${segment.color}33, ${segment.color})`
            }}
          />
        ))}
        <div
          className="absolute inset-y-0 w-px bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
          style={{ left: `${markerLeft}%` }}
        />
        <div
          className="absolute -top-1 h-3 w-3 -translate-x-1/2 rounded-full border border-white/80 bg-white"
          style={{ left: `${markerLeft}%` }}
        />
      </div>

      <div className="grid grid-cols-5 gap-2 text-[10px] uppercase tracking-wide text-white/60">
        {STRENGTH_GAUGE_SEGMENTS.map((segment) => (
          <div
            key={segment.label}
            className={`rounded-lg border px-2 py-1 text-center transition-colors ${segment.label === activeSegment.label ? 'border-white/50 bg-white/10 text-white' : 'border-white/10 bg-white/5'}`}
          >
            <p className="text-xs font-semibold">{segment.label}</p>
            <p className="text-[9px] text-white/50">{segment.min}-{segment.max}th</p>
          </div>
        ))}
      </div>

      <div className="text-xs text-white/60 sm:text-sm">
        Current level: <span className="font-semibold text-white/80">{currentLevel}</span>. {activeSegment.description}
      </div>
    </div>
  );
};

const StrengthAssessmentPage = ({ onNavigateBack }: StrengthAssessmentPageProps) => {
  const [selectedSport, setSelectedSport] = useState<'powerlifting' | 'weightlifting' | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    personalInfo: {
      age: 0,
      gender: 'male',
      bodyweight: 0,
      unit: 'kg',
      experience: 'intermediate'
    },
    lifts: {
      squat: 0,
      bench: 0,
      deadlift: 0,
      snatch: 0,
      cleanAndJerk: 0,
      overhead: 0,
      frontSquat: 0,
      row: 0,
      pullup: 0,
      dip: 0,
      inclineBench: 0,
      sumoDeadlift: 0,
      closeGripBench: 0,
      pendlayRow: 0,
      backSquat: 0,
      powerClean: 0,
      powerSnatch: 0,
      pushPress: 0,
      hangClean: 0,
      hangSnatch: 0
    },
    goals: [],
    limitations: ''
  });

  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
  const [programsLoaded, setProgramsLoaded] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedProgramData, setSelectedProgramData] = useState<Program | null>(null);
  const [enrollmentProgram, setEnrollmentProgram] = useState<Program | null>(null);
  const [selectionMessage, setSelectionMessage] = useState<SelectionMessage | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('results are loading');

  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const resultsOverlayTimeoutRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const RESULTS_LOADING_DURATION_MS = 1500;

  useEffect(() => {
    return () => {
      if (resultsOverlayTimeoutRef.current) {
        window.clearTimeout(resultsOverlayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedProgramId && !availablePrograms.some(program => program.id === selectedProgramId)) {
      setSelectedProgramId(null);
      setSelectedProgramData(null);
      setSelectionMessage(null);
    }
  }, [selectedProgramId, availablePrograms]);

  useEffect(() => {
    let isMounted = true;

    const loadPrograms = async () => {
      try {
        const programs = await getPrograms();
        if (!isMounted) {
          return;
        }

        const strengthPrograms = programs.filter((program) =>
          program.program_type === 'powerlifting' || program.program_type === 'olympic_weightlifting'
        );
        setAvailablePrograms(strengthPrograms);
        setProgramsError(null);
      } catch (error) {
        console.error('Error loading strength programs:', error);
        if (isMounted) {
          setProgramsError('Unable to load recommended programs right now.');
        }
      } finally {
        if (isMounted) {
          setProgramsLoaded(true);
        }
      }
    };

    loadPrograms();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleProgramEnrollmentComplete = async (programId: string, updatedCount?: number) => {
    try {
      const programs = await getPrograms();
      const strengthPrograms = programs.filter((program) =>
        program.program_type === 'powerlifting' || program.program_type === 'olympic_weightlifting'
      );
      setAvailablePrograms(strengthPrograms);
      setProgramsError(null);
    } catch (error) {
      console.error('Error refreshing programs after enrollment:', error);
    }

    const applyUpdatedCount = <T extends Program | null>(programRecord: T): T => {
      if (programRecord && programRecord.id === programId) {
        const nextCount = updatedCount ?? (typeof programRecord.current_participants === 'number' ? programRecord.current_participants + 1 : 1);
        return { ...programRecord, current_participants: nextCount } as T;
      }
      return programRecord;
    };

    setSelectedProgramData((prev) => applyUpdatedCount(prev));
    setEnrollmentProgram((prev) => applyUpdatedCount(prev));
  };

  const accentGradient = selectedSport === 'powerlifting'
    ? 'from-red-600 via-red-500 to-red-400'
    : 'from-blue-600 via-blue-500 to-blue-400';
  const headerGradient = selectedSport === 'powerlifting'
    ? 'bg-gradient-to-r from-red-900 via-red-800 to-gray-900/90 border-b border-red-900/40'
    : 'bg-gradient-to-r from-blue-900 via-blue-800 to-gray-900/90 border-b border-blue-900/40';
  const badgeTone = selectedSport === 'powerlifting'
    ? 'bg-red-100 text-red-800'
    : 'bg-blue-100 text-blue-800';
  const infoBoxTone = selectedSport === 'powerlifting'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-blue-50 border-blue-200 text-blue-700';
  const infoIconTone = selectedSport === 'powerlifting' ? 'text-red-600' : 'text-blue-600';
  const submitButtonTone = selectedSport === 'powerlifting'
    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300';
  const highlightTextTone = selectedSport === 'powerlifting' ? 'text-red-500' : 'text-blue-500';
  const liftIconTone = selectedSport === 'weightlifting'
    ? 'text-blue-500'
    : selectedSport === 'powerlifting'
      ? 'text-red-500'
      : 'text-gray-400';
  const liftIconClass = `w-4 h-4 ${liftIconTone}`;
  const makeLiftIcon = (Icon: React.ComponentType<{ className?: string }>) => <Icon className={liftIconClass} />;
  const unitBadgeTone = selectedSport === 'powerlifting'
    ? 'border-red-300 bg-red-100'
    : 'border-blue-300 bg-blue-100';
  const requiredInputTone = selectedSport === 'powerlifting'
    ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:bg-white'
    : 'border-blue-300 bg-blue-50 focus:ring-blue-500 focus:bg-white';
  const optionalInputTone = selectedSport === 'powerlifting'
    ? 'border-gray-300 bg-gray-50 focus:ring-red-500 focus:bg-white'
    : 'border-gray-300 bg-gray-50 focus:ring-blue-500 focus:bg-white';
  const checkboxTone = selectedSport === 'powerlifting' ? 'focus:ring-red-600 text-red-600' : 'focus:ring-blue-600 text-blue-600';
  const accentHoverBorder = selectedSport === 'powerlifting' ? 'hover:border-red-600' : 'hover:border-blue-600';

  const recommendedSelectedTone = selectedSport === 'powerlifting'
    ? 'border-red-600 bg-red-100 shadow-lg'
    : 'border-blue-600 bg-blue-50 shadow-lg';
  const recommendedFirstTone = selectedSport === 'powerlifting'
    ? 'border-red-200'
    : 'border-blue-500 bg-blue-50';
  const recommendedBadgeTone = selectedSport === 'powerlifting'
    ? 'bg-red-500'
    : 'bg-blue-500';
  const recommendedSelectedButtonTone = selectedSport === 'powerlifting'
    ? 'bg-red-600 text-white'
    : 'bg-blue-600 text-white';
  const recommendedButtonHoverTone = selectedSport === 'powerlifting'
    ? 'hover:bg-red-600 hover:text-white'
    : 'hover:bg-blue-600 hover:text-white';

  const highlightIconTone = selectedSport === 'powerlifting' ? 'text-red-300' : 'text-blue-300';
  const focusRingTone = selectedSport === 'powerlifting' ? 'focus:ring-red-500' : 'focus:ring-blue-500';
  // Comprehensive strength standards for both sports
  const strengthStandards = {
    male: {
      // Powerlifting
      squat: { untrained: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25, worldClass: 2.75 },
      bench: { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.4, elite: 1.8, worldClass: 2.2 },
      deadlift: { untrained: 0.6, novice: 0.9, intermediate: 1.5, advanced: 2.1, elite: 2.7, worldClass: 3.3 },
      // Weightlifting
      snatch: { untrained: 0.3, novice: 0.5, intermediate: 0.8, advanced: 1.1, elite: 1.4, worldClass: 1.7 },
      cleanAndJerk: { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.4, elite: 1.8, worldClass: 2.2 },
      // Shared
      overhead: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      frontSquat: { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.4, elite: 1.8, worldClass: 2.2 },
      row: { untrained: 0.3, novice: 0.45, intermediate: 0.75, advanced: 1.05, elite: 1.35, worldClass: 1.65 },
      pullup: { untrained: 0.1, novice: 0.2, intermediate: 0.4, advanced: 0.6, elite: 0.8, worldClass: 1.0 },
      dip: { untrained: 0.2, novice: 0.35, intermediate: 0.6, advanced: 0.85, elite: 1.1, worldClass: 1.35 },
      inclineBench: { untrained: 0.35, novice: 0.5, intermediate: 0.8, advanced: 1.1, elite: 1.4, worldClass: 1.7 },
      sumoDeadlift: { untrained: 0.55, novice: 0.8, intermediate: 1.35, advanced: 1.9, elite: 2.45, worldClass: 3.0 },
      closeGripBench: { untrained: 0.35, novice: 0.5, intermediate: 0.8, advanced: 1.1, elite: 1.4, worldClass: 1.7 },
      pendlayRow: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      backSquat: { untrained: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25, worldClass: 2.75 },
      powerClean: { untrained: 0.35, novice: 0.5, intermediate: 0.8, advanced: 1.1, elite: 1.4, worldClass: 1.7 },
      powerSnatch: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      pushPress: { untrained: 0.3, novice: 0.45, intermediate: 0.75, advanced: 1.05, elite: 1.35, worldClass: 1.65 },
      hangClean: { untrained: 0.3, novice: 0.45, intermediate: 0.75, advanced: 1.05, elite: 1.35, worldClass: 1.65 },
      hangSnatch: { untrained: 0.2, novice: 0.35, intermediate: 0.6, advanced: 0.85, elite: 1.1, worldClass: 1.35 }
    },
    female: {
      // Powerlifting
      squat: { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.4, elite: 1.8, worldClass: 2.2 },
      bench: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      deadlift: { untrained: 0.5, novice: 0.75, intermediate: 1.25, advanced: 1.75, elite: 2.25, worldClass: 2.75 },
      // Weightlifting
      snatch: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      cleanAndJerk: { untrained: 0.3, novice: 0.5, intermediate: 0.8, advanced: 1.1, elite: 1.4, worldClass: 1.7 },
      // Shared
      overhead: { untrained: 0.15, novice: 0.25, intermediate: 0.4, advanced: 0.55, elite: 0.7, worldClass: 0.85 },
      frontSquat: { untrained: 0.3, novice: 0.45, intermediate: 0.75, advanced: 1.05, elite: 1.35, worldClass: 1.65 },
      row: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      pullup: { untrained: 0.05, novice: 0.1, intermediate: 0.2, advanced: 0.35, elite: 0.5, worldClass: 0.65 },
      dip: { untrained: 0.1, novice: 0.2, intermediate: 0.35, advanced: 0.5, elite: 0.65, worldClass: 0.8 },
      inclineBench: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      sumoDeadlift: { untrained: 0.45, novice: 0.65, intermediate: 1.1, advanced: 1.55, elite: 2.0, worldClass: 2.45 },
      closeGripBench: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      pendlayRow: { untrained: 0.15, novice: 0.25, intermediate: 0.4, advanced: 0.55, elite: 0.7, worldClass: 0.85 },
      backSquat: { untrained: 0.4, novice: 0.6, intermediate: 1.0, advanced: 1.4, elite: 1.8, worldClass: 2.2 },
      powerClean: { untrained: 0.25, novice: 0.4, intermediate: 0.65, advanced: 0.9, elite: 1.15, worldClass: 1.4 },
      powerSnatch: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      pushPress: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      hangClean: { untrained: 0.2, novice: 0.3, intermediate: 0.5, advanced: 0.7, elite: 0.9, worldClass: 1.1 },
      hangSnatch: { untrained: 0.15, novice: 0.25, intermediate: 0.4, advanced: 0.55, elite: 0.7, worldClass: 0.85 }
    }
  };

  const calculateStrengthLevel = (lift: number, bodyweight: number, gender: string, liftType: string): StrengthLevel => {
    if (lift === 0 || bodyweight === 0) {
      return { 
        level: 'Not Entered', 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-100', 
        description: 'Enter your lift to see assessment',
        icon: <AlertCircle className="w-4 h-4" />,
        percentile: 0
      };
    }

    const ratio = lift / bodyweight;
    const standards = strengthStandards[gender as keyof typeof strengthStandards][liftType as keyof typeof strengthStandards.male];
    
    let percentile = 0;
    if (ratio >= standards.worldClass) {
      percentile = 99;
      return { 
        level: 'World Class', 
        color: 'text-purple-700', 
        bgColor: 'bg-purple-100 border-purple-300', 
        description: 'Elite international competitor level',
        icon: <Crown className="w-4 h-4" />,
        percentile
      };
    }
    if (ratio >= standards.elite) {
      percentile = 95;
      return { 
        level: 'Elite', 
        color: 'text-red-700', 
        bgColor: 'bg-red-100 border-red-300', 
        description: 'National competitor level',
        icon: <Flame className="w-4 h-4" />,
        percentile
      };
    }
    if (ratio >= standards.advanced) {
      percentile = 80;
      return { 
        level: 'Advanced', 
        color: 'text-orange-700', 
        bgColor: 'bg-orange-100 border-orange-300', 
        description: 'Regional competitor level',
        icon: <Medal className="w-4 h-4" />,
        percentile
      };
    }
    if (ratio >= standards.intermediate) {
      percentile = 60;
      return { 
        level: 'Intermediate', 
        color: 'text-blue-700', 
        bgColor: 'bg-blue-100 border-blue-300', 
        description: 'Experienced lifter',
        icon: <Trophy className="w-4 h-4" />,
        percentile
      };
    }
    if (ratio >= standards.novice) {
      percentile = 30;
      return { 
        level: 'Novice', 
        color: 'text-green-700', 
        bgColor: 'bg-green-100 border-green-300', 
        description: 'Some training experience',
        icon: <TrendingUp className="w-4 h-4" />,
        percentile
      };
    }
    
    percentile = 10;
    return { 
      level: 'Untrained', 
      color: 'text-gray-700', 
      bgColor: 'bg-gray-100 border-gray-300', 
      description: 'New to strength training',
      icon: <User className="w-4 h-4" />,
      percentile
    };
  };

  const getOverallStrengthLevel = () => {
    const { bodyweight, gender } = assessmentData.personalInfo;
    
    if (selectedSport === 'powerlifting') {
      const { squat, bench, deadlift } = assessmentData.lifts;
      
      if (squat === 0 || bench === 0 || deadlift === 0) {
        return { 
          level: 'Incomplete', 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100', 
          description: 'Complete all main lifts for assessment',
          icon: <AlertCircle className="w-4 h-4" />,
          percentile: 0
        };
      }
      
      const squatLevel = calculateStrengthLevel(squat, bodyweight, gender, 'squat');
      const benchLevel = calculateStrengthLevel(bench, bodyweight, gender, 'bench');
      const deadliftLevel = calculateStrengthLevel(deadlift, bodyweight, gender, 'deadlift');
      
      const avgPercentile = Math.round(
        (squatLevel.percentile * 0.35 + benchLevel.percentile * 0.25 + deadliftLevel.percentile * 0.4)
      );
      
      const levelValues = {
        'Untrained': 1, 'Novice': 2, 'Intermediate': 3, 'Advanced': 4, 'Elite': 5, 'World Class': 6
      };
      
      const avgValue = (
        levelValues[squatLevel.level as keyof typeof levelValues] * 0.35 +
        levelValues[benchLevel.level as keyof typeof levelValues] * 0.25 +
        levelValues[deadliftLevel.level as keyof typeof levelValues] * 0.4
      );
      
      const levels = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'World Class'];
      const overallLevel = levels[Math.round(avgValue) - 1] || 'Untrained';
      
      const result = calculateStrengthLevel((squat + bench + deadlift) / 3, bodyweight, gender, 'squat');
      return { ...result, level: overallLevel, percentile: avgPercentile };
    } else {
      const { snatch, cleanAndJerk } = assessmentData.lifts;
      
      if (snatch === 0 || cleanAndJerk === 0) {
        return { 
          level: 'Incomplete', 
          color: 'text-gray-600', 
          bgColor: 'bg-gray-100', 
          description: 'Complete both lifts for assessment',
          icon: <AlertCircle className="w-4 h-4" />,
          percentile: 0
        };
      }
      
      const snatchLevel = calculateStrengthLevel(snatch, bodyweight, gender, 'snatch');
      const cleanJerkLevel = calculateStrengthLevel(cleanAndJerk, bodyweight, gender, 'cleanAndJerk');
      
      const avgPercentile = Math.round((snatchLevel.percentile + cleanJerkLevel.percentile) / 2);
      
      const levelValues = {
        'Untrained': 1, 'Novice': 2, 'Intermediate': 3, 'Advanced': 4, 'Elite': 5, 'World Class': 6
      };
      
      const avgValue = (
        levelValues[snatchLevel.level as keyof typeof levelValues] * 0.45 +
        levelValues[cleanJerkLevel.level as keyof typeof levelValues] * 0.55
      );
      
      const levels = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite', 'World Class'];
      const overallLevel = levels[Math.round(avgValue) - 1] || 'Untrained';
      
      const result = calculateStrengthLevel((snatch + cleanAndJerk) / 2, bodyweight, gender, 'snatch');
      return { ...result, level: overallLevel, percentile: avgPercentile };
    }
  };

  const getRecommendedPrograms = (): RecommendedProgram[] => {
    if (!selectedSport || !programsLoaded) {
      return [];
    }

    const { bodyweight, gender } = assessmentData.personalInfo;
    const relevantPrograms = availablePrograms.filter((program) =>
      selectedSport === 'powerlifting'
        ? program.program_type === 'powerlifting'
        : program.program_type === 'olympic_weightlifting'
    );

    if (relevantPrograms.length === 0) {
      return [];
    }

    const liftConfigs = selectedSport === 'powerlifting'
      ? [
        { key: 'squat', label: 'Back Squat' },
        { key: 'bench', label: 'Bench Press' },
        { key: 'deadlift', label: 'Deadlift' },
      ]
      : [
        { key: 'snatch', label: 'Snatch' },
        { key: 'cleanAndJerk', label: 'Clean & Jerk' },
      ];

    const liftLabelMap = liftConfigs.reduce<Record<string, string>>((acc, lift) => {
      acc[lift.key] = lift.label;
      return acc;
    }, {});

    const liftEvaluations = liftConfigs
      .map((lift) => {
        const value = assessmentData.lifts[lift.key as keyof typeof assessmentData.lifts] || 0;
        const level = calculateStrengthLevel(value, bodyweight, gender, lift.key);
        return {
          ...lift,
          value,
          level,
          percentile: level.percentile,
        };
      })
      .filter((lift) => lift.value > 0);

    if (liftEvaluations.length === 0) {
      return [];
    }

    const minPercentile = Math.min(...liftEvaluations.map((lift) => lift.percentile));
    const percentileBand = Math.min(minPercentile + 5, 70);
    let weakLifts = liftEvaluations.filter((lift) => lift.percentile <= percentileBand);
    if (weakLifts.length === 0) {
      const weakestLift = liftEvaluations.reduce((lowest, current) =>
        current.percentile < lowest.percentile ? current : lowest
      );
      weakLifts = [weakestLift];
    }
    const levelHierarchy = ['untrained', 'novice', 'intermediate', 'advanced', 'elite', 'world class'];
    const programLevelRank: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };
    const overallLevel = getOverallStrengthLevel();
    const normalizedOverallLevel = (overallLevel.level || 'Untrained').toLowerCase();
    const overallRank = Math.max(levelHierarchy.indexOf(normalizedOverallLevel), 0);

    const goalKeywords: Record<string, string[]> = {
      deadlift: ['deadlift', 'hinge'],
      squat: ['squat'],
      bench: ['bench', 'press'],
      snatch: ['snatch'],
      cleanAndJerk: ['clean & jerk', 'clean and jerk', 'clean', 'jerk'],
      competition: ['competition', 'meet', 'platform', 'prep'],
      strength: ['strength', 'power', 'total'],
      mobility: ['mobility', 'flexibility'],
      injury: ['rehab', 'recovery'],
    };

    const lowerCaseGoals = assessmentData.goals.map((goal) => goal.toLowerCase());

    const scoredPrograms = relevantPrograms.map((program) => {
      const searchableText = [
        program.title,
        program.subtitle,
        program.description,
        ...(program.features || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const focusKeys = new Set<string>();
      const addFocus = (keywords: string[], key: string) => {
        if (keywords.some((keyword) => searchableText.includes(keyword))) {
          focusKeys.add(key);
        }
      };

      addFocus(['squat'], 'squat');
      addFocus(['deadlift', 'hinge', 'pull'], 'deadlift');
      addFocus(['bench', 'press'], 'bench');
      addFocus(['snatch'], 'snatch');
      addFocus(['clean & jerk', 'clean and jerk', 'clean', 'jerk'], 'cleanAndJerk');

      const isFoundational = ['foundation', 'beginner', 'fundamentals', 'starter', 'intro'].some((keyword) =>
        searchableText.includes(keyword)
      );
      const isPeaking = ['peaking', 'peak', 'competition', 'meet prep', 'meet-prep'].some((keyword) =>
        searchableText.includes(keyword)
      );

      let score = 25;
      const reasons: string[] = [];

      const targetedWeakLifts = weakLifts.filter((lift) => focusKeys.has(lift.key));
      if (targetedWeakLifts.length > 0) {
        score += 40 + targetedWeakLifts.length * 5;
        const liftNames = targetedWeakLifts.map((lift) => lift.label).join(', ');
        reasons.push(`Targets your ${liftNames.toLowerCase()} progression`);
      } else {
        const supportiveLifts = liftEvaluations.filter((lift) => focusKeys.has(lift.key));
        if (supportiveLifts.length > 0) {
          score += 15;
          const liftNames = supportiveLifts.map((lift) => lift.label).join(', ');
          reasons.push(`Supports ${liftNames.toLowerCase()} development`);
        }
      }

      if (isFoundational && minPercentile < 60) {
        score += 15;
        reasons.push('Builds essential technique and base strength');
      }

      if (isPeaking && overallRank >= 3) {
        score += 10;
        reasons.push('Helps you peak for upcoming competition efforts');
      }

      if (program.level === 'all_levels') {
        score += 18;
        reasons.push('Flexible structure for any experience level');
      } else {
        const programRank = programLevelRank[program.level] ?? overallRank;
        const levelGap = Math.abs(programRank - overallRank);
        if (levelGap <= 1) {
          score += 20;
          reasons.push('Matches your current training level');
        } else if (programRank > overallRank) {
          score += 12;
          reasons.push('Designed to push you to the next level');
        }
      }

      Object.entries(goalKeywords).forEach(([goalKey, keywords]) => {
        if (keywords.some((keyword) => searchableText.includes(keyword))) {
          const matchesGoal = lowerCaseGoals.some((goal) => {
            if (goalKey === 'cleanAndJerk') {
              return goal.includes('clean') || goal.includes('jerk');
            }
            if (goalKey === 'injury') {
              return goal.includes('injury') || goal.includes('return');
            }
            return goal.includes(goalKey.replace('cleanAndJerk', 'clean'));
          });

          if (matchesGoal) {
            score += 8;
            if (goalKey === 'competition') {
              reasons.push('Aligns with your competition goals');
            } else if (goalKey === 'strength') {
              reasons.push('Focuses on building overall strength');
            } else if (goalKey === 'mobility') {
              reasons.push('Supports your mobility and recovery focus');
            } else if (goalKey === 'injury') {
              reasons.push('Includes recovery-minded progressions');
            } else {
              const label = (liftLabelMap[goalKey] || goalKey).toLowerCase();
              reasons.push(`Reinforces your ${label} goal`);
            }
          }
        }
      });

      if (program.is_popular) {
        score += 5;
      }

      score = Math.min(100, Math.round(score));

      if (reasons.length === 0) {
        reasons.push(`Well-rounded ${selectedSport === 'powerlifting' ? 'powerlifting' : 'weightlifting'} focus`);
      }

      return {
        rawProgram: program,
        score,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
      };
    });

    const topMatches = scoredPrograms
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ rawProgram, score, reasons }) => ({
        id: rawProgram.id,
        name: rawProgram.title,
        description: rawProgram.description || rawProgram.subtitle || 'High-impact training plan',
        duration: rawProgram.duration_weeks ? `${rawProgram.duration_weeks} weeks` : 'Flexible duration',
        price:
          typeof rawProgram.price === 'number'
            ? `${rawProgram.price.toLocaleString()} ${rawProgram.currency}`
            : rawProgram.currency || 'Contact for pricing',
        match: score,
        reasons,
        program: rawProgram,
      }));

    return topMatches;
  };

  const handleSubmit = () => {
    if (resultsOverlayTimeoutRef.current) {
      window.clearTimeout(resultsOverlayTimeoutRef.current);
    }

    setOverlayMessage('results are loading');
    setSelectionMessage(null);
    setSelectedProgramId(null);
    setSelectedProgramData(null);
    setEnrollmentProgram(null);

    setIsLoadingResults(true);
    resultsOverlayTimeoutRef.current = window.setTimeout(() => {
      setShowResults(true);
      setIsLoadingResults(false);
      resultsOverlayTimeoutRef.current = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, RESULTS_LOADING_DURATION_MS);
  };

  const handleRetake = () => {
    if (resultsOverlayTimeoutRef.current) {
      window.clearTimeout(resultsOverlayTimeoutRef.current);
    }

    setOverlayMessage('resetting assessment...');
    setIsLoadingResults(true);

    resultsOverlayTimeoutRef.current = window.setTimeout(() => {
      resetAssessment();
      resultsOverlayTimeoutRef.current = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, RESULTS_LOADING_DURATION_MS);
  };

  const resetAssessment = () => {
    if (resultsOverlayTimeoutRef.current) {
      window.clearTimeout(resultsOverlayTimeoutRef.current);
      resultsOverlayTimeoutRef.current = null;
    }
    setIsLoadingResults(false);
    setSelectedSport(null);
    setShowResults(false);
    setSelectedProgramId(null);
    setSelectionMessage(null);
    setEnrollmentProgram(null);
    setOverlayMessage('results are loading');
    setIsExporting(false);
    setAssessmentData({
      personalInfo: {
        age: 0,
        gender: 'male',
        bodyweight: 0,
        unit: 'kg',
        experience: 'intermediate'
      },
      lifts: {
        squat: 0,
        bench: 0,
        deadlift: 0,
        snatch: 0,
        cleanAndJerk: 0,
        overhead: 0,
        frontSquat: 0,
        row: 0,
        pullup: 0,
        dip: 0,
        inclineBench: 0,
        sumoDeadlift: 0,
        closeGripBench: 0,
        pendlayRow: 0,
        backSquat: 0,
        powerClean: 0,
        powerSnatch: 0,
        pushPress: 0,
        hangClean: 0,
        hangSnatch: 0
      },
      goals: [],
      limitations: ''
    });
  };

  const handleSelectRecommendedProgram = (programRecord: RecommendedProgram) => {
    setSelectedProgramId(programRecord.id);
    setSelectedProgramData(programRecord.program);
  };

  const handleGetStartedWithProgram = () => {
    if (!selectedProgramData) {
      setSelectionMessage({ text: 'Select a program to get started.', variant: 'error' });
      return;
    }

    setSelectionMessage(null);
    setEnrollmentProgram(selectedProgramData);
  };

  const handleExportResults = async () => {
    if (!resultsRef.current) {
      setSelectionMessage({ text: 'Results are not ready to export yet.', variant: 'error' });
      return;
    }

    try {
      setIsExporting(true);
      setSelectionMessage(null);
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(resultsRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#111827',
        filter: (node) => {
          if (!(node instanceof HTMLElement)) {
            return true;
          }
          return !node.dataset?.exportExclude;
        },
      });
      const link = document.createElement('a');
      const filePrefix = selectedSport === 'powerlifting' ? 'powerlifting' : 'weightlifting';
      link.download = `${filePrefix}-assessment-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      setSelectionMessage({ text: 'Assessment exported as PNG.', variant: 'success' });
    } catch (error) {
      console.error('Failed to export assessment results:', error);
      setSelectionMessage({ text: 'Unable to export the assessment right now. Please try again.', variant: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const powerliftingCategories = [
    {
      title: "Main Lifts",
      description: "Core powerlifting movements",
      lifts: [
        { key: 'squat', label: 'Back Squat', icon: makeLiftIcon(Activity), required: true },
        { key: 'bench', label: 'Bench Press', icon: makeLiftIcon(Dumbbell), required: true },
        { key: 'deadlift', label: 'Deadlift', icon: makeLiftIcon(TrendingUp), required: true }
      ]
    },
    {
      title: "Accessory Lifts",
      description: "Supporting movements",
      lifts: [
        { key: 'overhead', label: 'Overhead Press', icon: makeLiftIcon(Target), required: false },
        { key: 'inclineBench', label: 'Incline Bench Press', icon: makeLiftIcon(Dumbbell), required: false },
        { key: 'closeGripBench', label: 'Close Grip Bench', icon: makeLiftIcon(Dumbbell), required: false },
        { key: 'row', label: 'Barbell Row', icon: makeLiftIcon(BarChart3), required: false },
        { key: 'sumoDeadlift', label: 'Sumo Deadlift', icon: makeLiftIcon(TrendingUp), required: false },
        { key: 'frontSquat', label: 'Front Squat', icon: makeLiftIcon(Activity), required: false }
      ]
    }
  ];

  const weightliftingCategories = [
    {
      title: "Competition Lifts",
      description: "Olympic weightlifting movements",
      lifts: [
        { key: 'snatch', label: 'Snatch', icon: makeLiftIcon(Zap), required: true },
        { key: 'cleanAndJerk', label: 'Clean & Jerk', icon: makeLiftIcon(Flame), required: true }
      ]
    },
    {
      title: "Training Variations",
      description: "Technique and strength builders",
      lifts: [
        { key: 'powerSnatch', label: 'Power Snatch', icon: makeLiftIcon(Zap), required: false },
        { key: 'powerClean', label: 'Power Clean', icon: makeLiftIcon(Flame), required: false },
        { key: 'hangSnatch', label: 'Hang Snatch', icon: makeLiftIcon(Zap), required: false },
        { key: 'hangClean', label: 'Hang Clean', icon: makeLiftIcon(Flame), required: false },
        { key: 'pushPress', label: 'Push Press', icon: makeLiftIcon(Target), required: false },
        { key: 'frontSquat', label: 'Front Squat', icon: makeLiftIcon(Activity), required: false }
      ]
    },
    {
      title: "Strength Builders",
      description: "Supporting strength movements",
      lifts: [
        { key: 'backSquat', label: 'Back Squat', icon: makeLiftIcon(Activity), required: false },
        { key: 'overhead', label: 'Overhead Press', icon: makeLiftIcon(Target), required: false },
        { key: 'row', label: 'Barbell Row', icon: makeLiftIcon(BarChart3), required: false },
        { key: 'pullup', label: 'Pull-ups', icon: makeLiftIcon(Activity), required: false }
      ]
    }
  ];

  const sportCardImages = {
    powerlifting: '/Programs/start_powerlifting.png',
    weightlifting: '/Programs/improve_your_snatch.png',
  } as const;

  const sportBackdropImages = {
    powerlifting: '/Programs/Improve_your_squat.png',
    weightlifting: '/WeighliftingBasics.png',
  } as const;

  const selectionHeroImage = '/impactGroup.jpeg';

  const sportHeroPanels = {
    powerlifting: '/Programs/powerlifting_mastery.jpg',
    weightlifting: '/Programs/improve_your_snatch.png',
  } as const;

  // Sport Selection Screen
  if (!selectedSport) {
    const cards: Array<{
      id: 'powerlifting' | 'weightlifting';
      title: string;
      subtitle: string;
      description: string;
      accentClass: string;
      badge: string;
      icon: React.ReactNode;
      bulletPoints: string[];
    }> = [
      {
        id: 'powerlifting',
        title: 'Powerlifting',
        subtitle: 'Squat / Bench Press / Deadlift',
        description: 'Test your total and get rankings for the three foundational powerlifting movements.',
        accentClass: 'from-red-600 via-red-500 to-red-400',
        badge: 'Strength Focused',
        icon: <Dumbbell className="w-6 h-6" />,
        bulletPoints: [
          'Competition-standard ratios for squat, bench, and deadlift',
          'Technical focus areas based on your current sticking points',
          'Accessory guidance to keep your total climbing',
        ],
      },
      {
        id: 'weightlifting',
        title: 'Olympic Weightlifting',
        subtitle: 'Snatch / Clean & Jerk',
        description: 'Gauge your readiness across the two Olympic lifts with speed, mobility, and strength indicators.',
        accentClass: 'from-blue-600 via-blue-500 to-blue-400',
        badge: 'Explosive Power',
        icon: <Trophy className="w-6 h-6" />,
        bulletPoints: [
          'Mobility & speed readiness for each phase of the lift',
          'Priority drills for sharper technique and timing',
          'Support work to build confident platform performances',
        ],
      },
    ];

    return (
      <>
        <PageTransitionOverlay isVisible={isLoadingResults} message={overlayMessage} />
        <div className="relative min-h-screen bg-black text-white pb-24 lg:pb-0">
          <div className="absolute inset-0">
            <img
              src="/back.JPG"
              alt="Strength assessment background"
              className="h-full w-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/85 to-black/95" />
          </div>
          <div className="relative z-10">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onNavigateBack} className="text-white">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <img src="/logoELA.png" alt="Elyes Lift Academy Logo" className="h-10 w-10 object-contain" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Strength test</p>
                  <h1 className="text-lg font-semibold">Strength Level Calculator</h1>
                </div>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex bg-white/10 text-white">
                <Eye className="mr-2 h-4 w-4" />
                Coach-reviewed standards
              </Badge>
            </div>

            <div className="mx-auto max-w-6xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader className="space-y-3">
                  <Badge variant="secondary" className="w-fit bg-white/10 text-white">
                    <Calculator className="mr-2 h-4 w-4 text-red-300" />
                    Elite strength analysis
                  </Badge>
                  <CardTitle className="text-3xl sm:text-4xl">
                    Discover your competition readiness in minutes.
                  </CardTitle>
                  <CardDescription className="text-white/70">
                    Compare your lifts against international standards curated by Elyes Zerai. Receive a tailored
                    roadmap toward your next total PR or platform appearance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                    <BarChart3 className={`h-4 w-4 ${highlightIconTone}`} />
                    Strength percentile and level badges
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                    <Target className={`h-4 w-4 ${highlightIconTone}`} />
                    Goal-specific training focus points
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                    <Zap className="h-4 w-4 text-red-300" />
                    Explosive power and speed metrics
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                    <Medal className={`h-4 w-4 ${highlightIconTone}`} />
                    Program suggestions from the academy
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                {cards.map((card) => (
                  <Card key={card.id} className="border-white/10 bg-white/5 text-white">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className={`bg-gradient-to-r ${card.accentClass} text-white`}>
                          {card.badge}
                        </Badge>
                        <span className="text-white/80">{card.icon}</span>
                      </div>
                      <CardTitle>{card.title}</CardTitle>
                      <CardDescription className="text-red-200">{card.subtitle}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-white/70">{card.description}</p>
                      <div className="space-y-2 text-sm text-white/70">
                        {card.bulletPoints.map((point) => (
                          <div key={point} className="flex items-start gap-2">
                            <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-300" />
                            <span>{point}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" onClick={() => setSelectedSport(card.id)}>
                        Start assessment
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showResults) {
    const overallLevel = getOverallStrengthLevel();
    const recommendedPrograms = getRecommendedPrograms();
    const { bodyweight, gender, unit, experience } = assessmentData.personalInfo;

    const currentCategories = selectedSport === 'powerlifting' ? powerliftingCategories : weightliftingCategories;
    const enteredLifts = Object.entries(assessmentData.lifts)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => {
        const liftInfo = currentCategories
          .flatMap(cat => cat.lifts)
          .find(lift => lift.key === key);
        return {
          key,
          name: liftInfo?.label || key,
          value,
          icon: liftInfo?.icon ?? makeLiftIcon(Dumbbell),
          level: calculateStrengthLevel(value, bodyweight, gender, key)
        };
      });

    const strongestLift = enteredLifts.length > 0
      ? enteredLifts.reduce((best, current) => (current.level.percentile > (best.level.percentile) ? current : best), enteredLifts[0])
      : null;
    const priorityLift = enteredLifts.length > 0
      ? enteredLifts.reduce((worst, current) => (current.level.percentile < (worst.level.percentile) ? current : worst), enteredLifts[0])
      : null;
    const formattedExperience = experience.charAt(0).toUpperCase() + experience.slice(1);
  const heroImage = sportBackdropImages[selectedSport];
  const heroPanelImage = sportHeroPanels[selectedSport];
    return (
      <>
        <PageTransitionOverlay isVisible={isLoadingResults} message={overlayMessage} />
        <div ref={resultsRef} className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-black text-white pb-24 lg:pb-0">
        <img
          src={heroImage}
          alt={`${selectedSport === 'powerlifting' ? 'Powerlifting' : 'Weightlifting'} assessment background`}
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-black/85" />
        <div className="relative z-10">
          <div className={headerGradient}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onNavigateBack}
                    className="mr-4 text-white"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <h1 className="text-lg font-semibold uppercase tracking-wide text-white">
                    {selectedSport === 'powerlifting' ? 'Powerlifting Results' : 'Weightlifting Results'}
                  </h1>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportResults}
                    disabled={isExporting || !programsLoaded}
                    className={isExporting || !programsLoaded ? 'text-white/50' : 'text-white'}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {isExporting ? 'Exporting...' : 'Export PNG'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetake}
                    className="text-white"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retake
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-12 items-center">
              <div className="space-y-6">
                <Badge variant="secondary" className="bg-white/10 text-white">
                  <CheckCircle className={`mr-2 h-4 w-4 ${highlightIconTone}`} />
                  Assessment Complete
                </Badge>
                <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                  Your {selectedSport === 'powerlifting' ? 'Powerlifting' : 'Weightlifting'} Profile
                </h2>
                <p className="text-lg text-gray-200 leading-relaxed">
                  {gender === 'male' ? 'Male' : 'Female'} / {bodyweight}{unit} / {assessmentData.personalInfo.age} years old / {formattedExperience}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                    <p className="text-white/70 text-xs uppercase tracking-wide">Overall Level</p>
                    <p className="font-semibold text-white text-lg">{overallLevel.level}</p>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                    <p className="text-white/70 text-xs uppercase tracking-wide">Percentile</p>
                    <p className="font-semibold text-white text-lg">{overallLevel.percentile}th</p>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3">
                    <p className="text-white/70 text-xs uppercase tracking-wide">Goals Selected</p>
                    <p className="font-semibold text-white text-lg">{assessmentData.goals.length}</p>
                  </div>
                </div>

                <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">Strength Spectrum</h3>
                    <span className="text-xs font-semibold text-white/60">{Math.round(overallLevel.percentile)}th percentile</span>
                  </div>
                  <div className="mt-4">
                    <StrengthSpectrumChart percentile={overallLevel.percentile} currentLevel={overallLevel.level} />
                  </div>
                  <div className="mt-6 space-y-3 text-sm text-gray-200">
                    <p>
                      {selectedSport === 'powerlifting'
                        ? 'We analyse your squat, bench press, and deadlift relative to bodyweight using allometric scaling and experience adjustments to create a blended strength index.'
                        : 'We analyse your snatch, clean & jerk, and supporting strength lifts relative to bodyweight using Sinclair-style scaling and experience adjustments to create a blended strength index.'}
                    </p>
                    <p>
                      Standards reference {selectedSport === 'powerlifting'
                        ? 'IPF and USAPL meet data (2018-2024), OpenPowerlifting percentiles, and the StrengthLevel database'
                        : 'IWF competition data, Catalyst Athletics benchmark tables, and the StrengthLevel database'} to define the Untrained to Elite spectrum.
                    </p>
                  </div>
                </div>
              </div>
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle className="text-lg">Performance Highlights</CardTitle>
                  <CardDescription className="text-white/70">
                    Key focus areas based on your input and lift ratios.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-white/70">
                  <div className="flex items-start gap-2">
                    <CheckCircle className={`mt-0.5 h-4 w-4 ${highlightIconTone}`} />
                    <span>
                      Your strongest lift is {strongestLift?.name ?? 'N/A'} at the {strongestLift?.level.level ?? 'N/A'} level.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className={`mt-0.5 h-4 w-4 ${highlightIconTone}`} />
                    <span>
                      Priority focus: {priorityLift?.name ?? 'N/A'}. Dial technique and accessory work there.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className={`mt-0.5 h-4 w-4 ${highlightIconTone}`} />
                    <span>
                      Maintain {formattedExperience.toLowerCase()} momentum with weekly progress checks and video review.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1">
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle className="text-lg">Overall Level</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`inline-flex items-center ${overallLevel.bgColor} ${overallLevel.color} rounded-2xl p-6 border-2 mb-4`}>
                      <div className="text-center">
                        <div className="flex justify-center mb-3">
                          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            {overallLevel.icon && React.cloneElement(overallLevel.icon as React.ReactElement, { className: 'w-6 h-6' })}
                          </div>
                        </div>
                        <div className="text-xl font-bold mb-1">{overallLevel.level}</div>
                        <div className="text-sm opacity-75">{overallLevel.percentile}th percentile</div>
                      </div>
                    </div>
                    <p className="text-sm text-white/70">{overallLevel.description}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-3">
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">Detailed Breakdown</CardTitle>
                      <CardDescription className="text-white/70">
                        How each lift compares against standards
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                      <div className="flex items-center">
                        <div className="mr-2 h-3 w-3 rounded-full bg-green-500" />
                        Advanced +
                      </div>
                      <div className="flex items-center">
                        <div className="mr-2 h-3 w-3 rounded-full bg-yellow-400" />
                        Intermediate
                      </div>
                      <div className="flex items-center">
                        <div className="mr-2 h-3 w-3 rounded-full bg-gray-300" />
                        Developing
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {enteredLifts.map((lift) => (
                      <div key={lift.key} className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-white/60">{lift.icon}</span>
                            <h4 className="font-semibold text-white">{lift.name}</h4>
                          </div>
                          <span className={lift.level.color}>{lift.level.level}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-white/70">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-white/50">Best Lift</p>
                            <p className="font-medium text-white">{lift.value}{unit}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-white/50">Ratio</p>
                            <p className="font-medium text-white">{(lift.value / bodyweight).toFixed(2)} x BW</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-white/50">Percentile</p>
                            <p className="font-medium text-white">{lift.level.percentile}th</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="mt-8 border-white/20 bg-white text-gray-900" data-export-exclude="true">
              <CardHeader>
                <CardTitle className="text-lg">Recommended Programs</CardTitle>
                <CardDescription className="text-gray-600">
                  Programs aligned to your weakest lifts and goals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendedPrograms.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {recommendedPrograms.map((program, index) => {
                      const isSelected = selectedProgramId === program.id;
                      const cardTone = isSelected
                        ? recommendedSelectedTone
                        : index === 0
                          ? recommendedFirstTone
                          : 'border-gray-200 bg-white';
                      return (
                        <div
                          key={program.id}
                          className={`border-2 rounded-xl p-6 transition-all duration-200 h-full flex flex-col ${cardTone}`}
                        >
                          {index === 0 && program.match > 0 && (
                            <div className={`${recommendedBadgeTone} text-white px-3 py-1 rounded-full text-sm font-medium mb-4 w-fit`}>
                              Best Match
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-gray-900 text-sm">{program.name}</h4>
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                              <span className="text-sm font-medium">{program.match}%</span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm mb-4">{program.description}</p>
                          <div className="space-y-2 mb-4">
                            {program.reasons.map((reason, reasonIndex) => (
                              <div key={reasonIndex} className="flex items-start text-xs text-gray-700">
                                <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                {reason}
                              </div>
                            ))}
                          </div>
                          <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-200">
                            <div>
                              <div className="font-bold text-gray-900">{program.price}</div>
                              <div className="text-sm text-gray-500">{program.duration}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectRecommendedProgram(program)}
                              disabled={isSelected}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${isSelected ? recommendedSelectedButtonTone + ' cursor-default shadow-md' : 'bg-gray-100 text-gray-700 ' + recommendedButtonHoverTone}`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-600">
                    {programsError ?? 'No programs matched your current inputs yet. Adjust your lifts or goals to see suggestions.'}
                  </div>
                )}
                {selectionMessage && (
                  <p className={`text-sm ${selectionMessage.variant === 'error' ? 'text-red-600' : selectionMessage.variant === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
                    {selectionMessage.text}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="text-center" data-export-exclude="true">
              <Button
                onClick={handleGetStartedWithProgram}
                disabled={!selectedProgramData}
                className="px-8 py-4 text-base"
              >
                Get Started with Selected Program
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      {enrollmentProgram && (
        <EnrollmentModal program={enrollmentProgram} onClose={() => setEnrollmentProgram(null)} onEnrollmentComplete={handleProgramEnrollmentComplete} />
      )}
      </>
    );
  }


  // Assessment Form
  const currentCategories = selectedSport === 'powerlifting' ? powerliftingCategories : weightliftingCategories;
  const requiredLifts = selectedSport === 'powerlifting' 
    ? ['squat', 'bench', 'deadlift'] 
    : ['snatch', 'cleanAndJerk'];
  
  const isFormValid = requiredLifts.every(lift => assessmentData.lifts[lift as keyof typeof assessmentData.lifts] > 0) 
    && assessmentData.personalInfo.bodyweight > 0
    && assessmentData.personalInfo.age > 0;

  const sportGoals = selectedSport === 'powerlifting' ? [
    'Increase overall strength',
    'Compete in powerlifting',
    'Improve squat technique',
    'Improve bench technique', 
    'Improve deadlift technique',
    'Build muscle mass',
    'Lose body fat',
    'Prevent injuries',
    'Return from injury'
  ] : [
    'Learn Olympic lifts',
    'Compete in weightlifting',
    'Improve snatch technique',
    'Improve clean & jerk technique',
    'Increase power output',
    'Improve mobility',
    'Build explosive strength',
    'Prevent injuries',
    'Return from injury'
  ];

  const heroImage = sportBackdropImages[selectedSport];
  const heroPanelImage = sportHeroPanels[selectedSport];

  return (
    <>
      <PageTransitionOverlay isVisible={isLoadingResults} message={overlayMessage} />
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-black text-white pb-24 lg:pb-0">
      <img
        src={heroImage}
        alt={`${selectedSport === 'powerlifting' ? 'Powerlifting' : 'Weightlifting'} training backdrop`}
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-black/85" />
      <div className="relative z-10">
        <div className={headerGradient}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedSport(null)}
                  className="mr-4 text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-3">
                  <img
                    src="/logoELA.png"
                    alt="Elyes Lift Academy Logo"
                    className="w-12 h-12 object-contain"
                  />
                  <h1 className="text-lg font-semibold uppercase tracking-wide text-white">
                    {selectedSport === 'powerlifting' ? 'Powerlifting Assessment' : 'Weightlifting Assessment'}
                  </h1>
                </div>
              </div>
              <Button variant="outline" size="sm" className="hidden sm:inline-flex text-white">
                <HelpCircle className="mr-2 h-4 w-4" />
                Need help?
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-12 mb-12 items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="bg-white/10 text-white">
                {selectedSport === 'powerlifting' ? (
                  <Dumbbell className="mr-2 h-4 w-4 text-red-300" />
                ) : (
                  <Trophy className="mr-2 h-4 w-4 text-blue-300" />
                )}
                {selectedSport === 'powerlifting' ? 'Powerlifting Readiness' : 'Weightlifting Readiness'}
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Build the numbers that matter on the platform.
              </h2>
              <p className="text-lg text-gray-200 leading-relaxed">
                Share your best attempts and current training insights to unlock a personalised roadmap from Elyes Lift Academy.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <BarChart3 className={`w-5 h-5 ${highlightIconTone} mr-3`} />
                  <span className="text-gray-100">Strength ratios for every required lift</span>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Target className={`w-5 h-5 ${highlightIconTone} mr-3`} />
                  <span className="text-gray-100">Coaching cues tailored to your goals</span>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Activity className={`w-5 h-5 ${highlightIconTone} mr-3`} />
                  <span className="text-gray-100">Recovery and accessory priorities</span>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Medal className={`w-5 h-5 ${highlightIconTone} mr-3`} />
                  <span className="text-gray-100">Program suggestions to progress faster</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
                <img
                  src={heroPanelImage}
                  alt={`${selectedSport === 'powerlifting' ? 'Powerlifting' : 'Weightlifting'} spotlight`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/80">
                  <span className="font-semibold">Assessment Preview</span>
                  <span className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${highlightIconTone}`} />
                    Under 5 minutes
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/95 text-gray-900 rounded-2xl shadow-2xl border border-white/20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                      <select
                        value={assessmentData.personalInfo.gender}
                        onChange={(e) => setAssessmentData({
                          ...assessmentData,
                          personalInfo: { ...assessmentData.personalInfo, gender: e.target.value as 'male' | 'female' }
                        })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${focusRingTone} focus:border-transparent text-sm`}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Age <span className={highlightTextTone}>*</span></label>
                      <input
                        type="number"
                        value={assessmentData.personalInfo.age || ''}
                        onChange={(e) => setAssessmentData({
                          ...assessmentData,
                          personalInfo: { ...assessmentData.personalInfo, age: parseInt(e.target.value) || 0 }
                        })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${focusRingTone} focus:border-transparent text-sm`}
                        placeholder="25"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Body Weight *</label>
                    <div className="flex">
                      <input
                        type="number"
                        step="0.1"
                        value={assessmentData.personalInfo.bodyweight || ''}
                        onChange={(e) => setAssessmentData({
                          ...assessmentData,
                          personalInfo: { ...assessmentData.personalInfo, bodyweight: parseFloat(e.target.value) || 0 }
                        })}
                        className={`flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:border-transparent text-sm transition-colors ${requiredInputTone}`}
                        placeholder="75"
                      />
                      <select
                        value={assessmentData.personalInfo.unit}
                        onChange={(e) => setAssessmentData({
                          ...assessmentData,
                          personalInfo: { ...assessmentData.personalInfo, unit: e.target.value as 'kg' | 'lbs' }
                        })}
                        className={`px-3 py-2 border border-l-0 rounded-r-lg text-sm ${unitBadgeTone}`}
                      >
                        <option value="kg">kg</option>
                        <option value="lbs">lbs</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Training Experience</label>
                    <select
                      value={assessmentData.personalInfo.experience}
                      onChange={(e) => setAssessmentData({
                        ...assessmentData,
                        personalInfo: { ...assessmentData.personalInfo, experience: e.target.value }
                      })}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 ${focusRingTone} focus:border-transparent text-sm`}
                    >
                      <option value="beginner">Beginner (0-6 months)</option>
                      <option value="novice">Novice (6 months - 2 years)</option>
                      <option value="intermediate">Intermediate (2-5 years)</option>
                      <option value="advanced">Advanced (5+ years)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Enter your best lifts (1RM)</h3>
                <div className={`mb-4 p-4 rounded-lg ${infoBoxTone}`}>
                  <div className="flex items-start">
                    <Info className={`w-4 h-4 mr-2 flex-shrink-0 mt-0.5 ${infoIconTone}`} />
                    <div>
                      <h4 className="font-medium text-sm mb-1">How to enter your lifts</h4>
                      <p className="text-xs">
                        <span className={`font-semibold ${highlightTextTone}`}>Required fields are highlighted</span>. Enter your one-rep max values. If you only know a rep-max, estimate using a trusted calculator.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {currentCategories.map((category, categoryIndex) => (
                    <div key={categoryIndex}>
                      <div className="mb-3">
                        <h4 className="font-semibold text-gray-900 text-sm">{category.title}</h4>
                        <p className="text-xs text-gray-600">{category.description}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {category.lifts.map((lift) => (
                          <div key={lift.key}>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              <span className="mr-1">{lift.icon}</span>
                              {lift.label} {lift.required && <span className={highlightTextTone}>*</span>}
                            </label>
                            <div className="flex">
                              <input
                                type="number"
                                step="0.5"
                                value={assessmentData.lifts[lift.key as keyof typeof assessmentData.lifts] || ''}
                                onChange={(e) => setAssessmentData({
                                  ...assessmentData,
                                  lifts: { 
                                    ...assessmentData.lifts, 
                                    [lift.key]: parseFloat(e.target.value) || 0 
                                  }
                                })}
                                className={`flex-1 px-3 py-2 border rounded-l-lg focus:ring-2 focus:border-transparent text-sm transition-colors ${lift.required ? requiredInputTone : optionalInputTone}`}
                                placeholder=""
                              />
                              <div className={`px-3 py-2 border border-l-0 rounded-r-lg text-gray-600 text-sm ${lift.required ? unitBadgeTone : 'border-gray-300 bg-gray-100'}`}>
                                {assessmentData.personalInfo.unit}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Training Goals (Optional)</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sportGoals.map((goal) => (
                  <label key={goal} className={`flex items-center p-3 border border-gray-300 rounded-lg transition-colors ${accentHoverBorder}`}>
                    <input
                      type="checkbox"
                      checked={assessmentData.goals.includes(goal)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssessmentData({
                            ...assessmentData,
                            goals: [...assessmentData.goals, goal]
                          });
                        } else {
                          setAssessmentData({
                            ...assessmentData,
                            goals: assessmentData.goals.filter(g => g !== goal)
                          });
                        }
                      }}
                      className={`w-4 h-4 rounded ${checkboxTone}`}
                    />
                    <span className="ml-2 text-sm text-gray-700">{goal}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 p-8 text-center">
              <button
                onClick={handleSubmit}
                disabled={!isFormValid || isLoadingResults}
                className={`${submitButtonTone} text-white px-8 py-4 rounded-xl font-semibold transition-colors flex items-center mx-auto`}
              >
                <Calculator className="w-5 h-5 mr-2" />
                Calculate My {selectedSport === 'powerlifting' ? 'Powerlifting' : 'Weightlifting'} Level
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
              <p className="text-sm text-gray-500 mt-3">
                * Required fields: Body weight and {selectedSport === 'powerlifting' ? 'Squat, Bench Press, Deadlift' : 'Snatch, Clean & Jerk'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    {enrollmentProgram && (
      <EnrollmentModal program={enrollmentProgram} onClose={() => setEnrollmentProgram(null)} onEnrollmentComplete={handleProgramEnrollmentComplete} />
    )}
    </>
  );
};
export default StrengthAssessmentPage;















