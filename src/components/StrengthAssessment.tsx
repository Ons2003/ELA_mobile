import React, { useEffect, useState } from 'react';
import { 
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
  Info
} from 'lucide-react';
import { assessmentsAPI } from '../lib/api';
import { supabase, getPrograms, Program } from '../lib/supabase';

interface AssessmentData {
  personalInfo: {
    age: number;
    gender: 'male' | 'female';
    bodyweight: number;
    unit: 'kg' | 'lbs';
    experience: string;
  };
  lifts: {
    squat: number;
    bench: number;
    deadlift: number;
    overhead: number;
  };
  goals: string[];
  limitations: string;
}

interface StrengthStandards {
  [key: string]: {
    untrained: number;
    novice: number;
    intermediate: number;
    advanced: number;
    elite: number;
  };
}

const StrengthAssessment = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [assessmentData, setAssessmentData] = useState<AssessmentData>({
    personalInfo: {
      age: 25,
      gender: 'male',
      bodyweight: 75,
      unit: 'kg',
      experience: 'beginner'
    },
    lifts: {
      squat: 0,
      bench: 0,
      deadlift: 0,
      overhead: 0
    },
    goals: [],
    limitations: ''
  });

  const [availablePrograms, setAvailablePrograms] = useState<Program[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  useEffect(() => {
    const loadPrograms = async () => {
      setProgramsLoading(true);
      try {
        const data = await getPrograms();
        setAvailablePrograms(data);
        setProgramsError(null);
      } catch (error) {
        console.error('Error loading programs for assessment:', error);
        setProgramsError('Unable to load training programs right now. Please try again later.');
      } finally {
        setProgramsLoading(false);
      }
    };

    loadPrograms();
  }, []);

  const levelOrder: Array<Exclude<Program['level'], 'all_levels'>> = ['beginner', 'intermediate', 'advanced'];

  const mapStrengthLevelToProgramLevel = (level: string): Program['level'] => {
    switch (level) {
      case 'Beginner':
      case 'Novice':
        return 'beginner';
      case 'Intermediate':
        return 'intermediate';
      case 'Advanced':
      case 'Elite':
        return 'advanced';
      default:
        return 'all_levels';
    }
  };

  const goalProgramTypeMap: Record<string, Program['program_type'][]> = {
    'Increase overall strength': ['powerlifting', 'general_fitness'],
    'Compete in powerlifting': ['powerlifting', 'competition_prep'],
    'Improve technique': ['powerlifting', 'olympic_weightlifting'],
    'Build muscle mass': ['general_fitness', 'powerlifting'],
    'Lose body fat': ['general_fitness'],
    'Improve mobility': ['mobility'],
    'Prevent injuries': ['mobility', 'general_fitness'],
    'Return from injury': ['mobility', 'general_fitness']
  };

  const describeProgramType = (programType: Program['program_type']) => {
    switch (programType) {
      case 'powerlifting':
        return 'Powerlifting-focused progression';
      case 'olympic_weightlifting':
        return 'Technical Olympic lifting work';
      case 'general_fitness':
        return 'General strength and conditioning balance';
      case 'mobility':
        return 'Mobility and movement quality focus';
      case 'competition_prep':
        return 'Competition peaking and tapering structure';
      default:
        return '';
    }
  };

  const formatProgramPrice = (price: number | null | undefined, currency: string | undefined) => {
    if (price === 0) {
      return 'Free';
    }

    if (price === null || price === undefined || !currency) {
      return 'Contact for pricing';
    }

    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
    } catch (error) {
      console.warn('Unable to format program price:', error);
      return `${price} ${currency}`;
    }
  };

  // Strength standards (simplified version - in real app would be more comprehensive)
  const strengthStandards: StrengthStandards = {
    male: {
      untrained: 0.5,
      novice: 0.75,
      intermediate: 1.25,
      advanced: 1.75,
      elite: 2.25
    },
    female: {
      untrained: 0.4,
      novice: 0.6,
      intermediate: 1.0,
      advanced: 1.4,
      elite: 1.8
    }
  };

  const calculateStrengthLevel = (lift: number, bodyweight: number, gender: string) => {
    const ratio = lift / bodyweight;
    const standards = strengthStandards[gender];
    
    if (ratio >= standards.elite) return { level: 'Elite', color: 'text-purple-600', bgColor: 'bg-purple-100' };
    if (ratio >= standards.advanced) return { level: 'Advanced', color: 'text-red-600', bgColor: 'bg-red-100' };
    if (ratio >= standards.intermediate) return { level: 'Intermediate', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    if (ratio >= standards.novice) return { level: 'Novice', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    return { level: 'Beginner', color: 'text-green-600', bgColor: 'bg-green-100' };
  };

  const getOverallStrengthLevel = () => {
    const { squat, bench, deadlift } = assessmentData.lifts;
    const { bodyweight, gender } = assessmentData.personalInfo;
    
    if (squat === 0 || bench === 0 || deadlift === 0) return { level: 'Incomplete', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    
    const squatLevel = calculateStrengthLevel(squat, bodyweight, gender);
    const benchLevel = calculateStrengthLevel(bench, bodyweight, gender);
    const deadliftLevel = calculateStrengthLevel(deadlift, bodyweight, gender);
    
    const levels = [squatLevel.level, benchLevel.level, deadliftLevel.level];
    const levelCounts = levels.reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantLevel = Object.keys(levelCounts).reduce((a, b) => 
      levelCounts[a] > levelCounts[b] ? a : b
    );
    
    return calculateStrengthLevel(
      (squat + bench + deadlift) / 3, 
      bodyweight, 
      gender
    );
  };

  const getRecommendedPrograms = () => {
    if (!availablePrograms.length) {
      return [];
    }

    const overallLevel = getOverallStrengthLevel();
    const normalizedLevel = mapStrengthLevelToProgramLevel(overallLevel.level);
    const userLevelIndex = normalizedLevel === 'all_levels'
      ? -1
      : levelOrder.indexOf(normalizedLevel as Exclude<Program['level'], 'all_levels'>);
    const goals = assessmentData.goals;

    return availablePrograms
      .map((program) => {
        let score = 45;
        const reasons = new Set<string>();

        if (program.level === 'all_levels') {
          score += 25;
          reasons.add('Adaptable for any training level');
        } else if (normalizedLevel === 'all_levels' || userLevelIndex === -1) {
          score += 18;
          reasons.add('Helps you build a strong foundation');
        } else {
          const programLevelIndex = program.level === 'all_levels'
            ? -1
            : levelOrder.indexOf(program.level as Exclude<Program['level'], 'all_levels'>);

          if (programLevelIndex !== -1 && userLevelIndex !== -1) {
            const levelDifference = Math.abs(programLevelIndex - userLevelIndex);
            if (levelDifference === 0) {
              score += 35;
              reasons.add(`Tailored to ${overallLevel.level.toLowerCase()} lifters`);
            } else if (levelDifference === 1) {
              score += 22;
              reasons.add('Provides the right challenge to level up');
            } else {
              score += 8;
            }
          }
        }

        const matchingGoals = goals.filter((goal) => {
          const supportedTypes = goalProgramTypeMap[goal];
          return supportedTypes ? supportedTypes.includes(program.program_type) : false;
        });

        if (matchingGoals.length > 0) {
          score += matchingGoals.length * 10;
          matchingGoals.forEach((goal) => reasons.add(`Supports goal: ${goal}`));
        }

        if ((overallLevel.level === 'Advanced' || overallLevel.level === 'Elite') && program.program_type === 'competition_prep') {
          score += 10;
          reasons.add('Structured for meet preparation and peaking');
        }

        if (program.is_popular) {
          score += 5;
          reasons.add('Community favorite program');
        }

        const typeDescription = describeProgramType(program.program_type);
        if (typeDescription) {
          reasons.add(typeDescription);
        }

        const reasonsList = Array.from(reasons);
        if (reasonsList.length < 3 && Array.isArray(program.features)) {
          for (const feature of program.features) {
            if (!reasonsList.includes(feature)) {
              reasonsList.push(feature);
            }
            if (reasonsList.length >= 3) {
              break;
            }
          }
        }

        if (!reasonsList.length) {
          reasonsList.push('Comprehensive coaching support included');
        }

        const durationLabel = program.duration_weeks ? `${program.duration_weeks} weeks` : 'Custom duration';
        const priceLabel = formatProgramPrice(program.price, program.currency);
        const levelLabel = program.level === 'all_levels'
          ? 'All Levels'
          : program.level.charAt(0).toUpperCase() + program.level.slice(1);
        const typeLabel = program.program_type
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
        const match = Math.max(55, Math.min(97, Math.round(score)));

        return {
          id: program.id,
          title: program.title,
          description: program.description || '',
          duration: durationLabel,
          price: priceLabel,
          match,
          reasons: reasonsList,
          levelLabel,
          typeLabel
        };
      })
      .sort((a, b) => b.match - a.match)
      .slice(0, 3);
  };

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmitAssessment();
    }
  };

  const handleSubmitAssessment = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const result = await assessmentsAPI.create({
        user_id: user?.id,
        squat_max: assessmentData.lifts.squat,
        bench_max: assessmentData.lifts.bench,
        deadlift_max: assessmentData.lifts.deadlift,
        overhead_press_max: assessmentData.lifts.overhead,
        bodyweight_at_assessment: assessmentData.personalInfo.bodyweight,
        bodyweight: assessmentData.personalInfo.bodyweight,
        gender: assessmentData.personalInfo.gender,
        goals: assessmentData.goals,
        limitations: assessmentData.limitations
      });

      if (result.error) {
        console.error('Error saving assessment:', result.error);
      }
    } catch (error) {
      console.error('Error saving assessment:', error);
    }
    
    setShowResults(true);
  };
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetAssessment = () => {
    setCurrentStep(1);
    setShowResults(false);
    setAssessmentData({
      personalInfo: {
        age: 25,
        gender: 'male',
        bodyweight: 75,
        unit: 'kg',
        experience: 'beginner'
      },
      lifts: {
        squat: 0,
        bench: 0,
        deadlift: 0,
        overhead: 0
      },
      goals: [],
      limitations: ''
    });
  };

  const steps = [
    { number: 1, title: 'Personal Info', icon: <User className="w-5 h-5" /> },
    { number: 2, title: 'Current Lifts', icon: <Dumbbell className="w-5 h-5" /> },
    { number: 3, title: 'Goals', icon: <Target className="w-5 h-5" /> },
    { number: 4, title: 'Experience', icon: <BarChart3 className="w-5 h-5" /> }
  ];

  if (showResults) {
    const overallLevel = getOverallStrengthLevel();
    const recommendedPrograms = getRecommendedPrograms();
    const { squat, bench, deadlift } = assessmentData.lifts;
    const { bodyweight, gender } = assessmentData.personalInfo;

    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <CheckCircle className="w-4 h-4 mr-2" />
            Assessment Complete
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Strength Assessment Results</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Based on your current lifts and goals, here's your personalized strength profile and program recommendations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Overall Level */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Overall Strength Level</h3>
              <div className={`${overallLevel.bgColor} ${overallLevel.color} rounded-xl p-6 text-center`}>
                <Trophy className="w-12 h-12 mx-auto mb-3" />
                <div className="text-2xl font-bold mb-2">{overallLevel.level}</div>
                <div className="text-sm opacity-75">
                  {assessmentData.personalInfo.gender === 'male' ? 'Male' : 'Female'} • {assessmentData.personalInfo.bodyweight}{assessmentData.personalInfo.unit}
                </div>
              </div>
            </div>
          </div>

          {/* Individual Lifts */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Lift Breakdown</h3>
              <div className="space-y-4">
                {[
                  { name: 'Squat', value: squat, icon: '🏋️' },
                  { name: 'Bench Press', value: bench, icon: '💪' },
                  { name: 'Deadlift', value: deadlift, icon: '⚡' }
                ].map((lift) => {
                  const level = calculateStrengthLevel(lift.value, bodyweight, gender);
                  const ratio = (lift.value / bodyweight).toFixed(2);
                  
                  return (
                    <div key={lift.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{lift.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900">{lift.name}</div>
                          <div className="text-sm text-gray-600">{lift.value}{assessmentData.personalInfo.unit} • {ratio}x bodyweight</div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${level.bgColor} ${level.color}`}>
                        {level.level}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Programs */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200 mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Recommended Programs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programsLoading && (
              <div className="col-span-full text-center text-gray-500 py-6">
                Loading recommended programs...
              </div>
            )}
            {!programsLoading && programsError && (
              <div className="col-span-full text-center text-red-600 bg-red-50 border border-red-100 rounded-xl py-6">
                {programsError}
              </div>
            )}
            {!programsLoading && !programsError && recommendedPrograms.length === 0 && (
              <div className="col-span-full text-center text-gray-600 bg-gray-50 border border-gray-200 rounded-xl py-6">
                We couldn't find a perfect match yet. Explore the full programs list for more options.
              </div>
            )}
            {!programsLoading && !programsError && recommendedPrograms.map((program, index) => (
              <div key={program.id} className={`border-2 rounded-xl p-6 ${index === 0 ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                {index === 0 && (
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-4 w-fit">
                    Best Match
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{program.typeLabel}</div>
                    <h4 className="font-bold text-gray-900">{program.title}</h4>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                    <span className="text-sm font-medium">{program.match}%</span>
                  </div>
                </div>
                <div className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full mb-3">
                  {program.levelLabel}
                </div>
                <p className="text-gray-600 text-sm mb-4">{program.description}</p>
                <div className="space-y-2 mb-4">
                  {program.reasons.map((reason, reasonIndex) => (
                    <div key={reasonIndex} className="flex items-center text-sm text-gray-700">
                      <CheckCircle className="w-3 h-3 text-green-500 mr-2 flex-shrink-0" />
                      {reason}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <div className="font-bold text-gray-900">{program.price}</div>
                    <div className="text-sm text-gray-500">{program.duration}</div>
                  </div>
                  <button
                    onClick={() => {
                      const element = document.getElementById('programs');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      index === 0
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    View details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center">
          <button 
            onClick={resetAssessment}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors mr-4"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Retake Assessment
          </button>
          <button 
            onClick={() => {
              const element = document.getElementById('programs');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Get Started with Recommended Program
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= step.number 
                  ? 'bg-red-600 border-red-600 text-white' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                {currentStep > step.number ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <div className={`text-sm font-medium ${
                  currentStep >= step.number ? 'text-red-600' : 'text-gray-400'
                }`}>
                  Step {step.number}
                </div>
                <div className="text-xs text-gray-500">{step.title}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  currentStep > step.number ? 'bg-red-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
        {currentStep === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age</label>
                <input
                  type="number"
                  value={assessmentData.personalInfo.age}
                  onChange={(e) => setAssessmentData({
                    ...assessmentData,
                    personalInfo: { ...assessmentData.personalInfo, age: parseInt(e.target.value) || 0 }
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                  placeholder="25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                <select
                  value={assessmentData.personalInfo.gender}
                  onChange={(e) => setAssessmentData({
                    ...assessmentData,
                    personalInfo: { ...assessmentData.personalInfo, gender: e.target.value as 'male' | 'female' }
                  })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Body Weight</label>
                <div className="flex">
                  <input
                    type="number"
                    value={assessmentData.personalInfo.bodyweight}
                    onChange={(e) => setAssessmentData({
                      ...assessmentData,
                      personalInfo: { ...assessmentData.personalInfo, bodyweight: parseFloat(e.target.value) || 0 }
                    })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    placeholder="75"
                  />
                  <select
                    value={assessmentData.personalInfo.unit}
                    onChange={(e) => setAssessmentData({
                      ...assessmentData,
                      personalInfo: { ...assessmentData.personalInfo, unit: e.target.value as 'kg' | 'lbs' }
                    })}
                    className="px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                >
                  <option value="beginner">Beginner (0-6 months)</option>
                  <option value="novice">Novice (6 months - 2 years)</option>
                  <option value="intermediate">Intermediate (2-5 years)</option>
                  <option value="advanced">Advanced (5+ years)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Lift Maxes</h2>
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-1">How to enter your lifts</h4>
                  <p className="text-sm text-blue-700">
                    Enter your current 1-rep max (1RM) for each lift. If you don't know your 1RM, 
                    enter the heaviest weight you can lift for 3-5 reps and we'll estimate it.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'squat', label: 'Back Squat', icon: '🏋️' },
                { key: 'bench', label: 'Bench Press', icon: '💪' },
                { key: 'deadlift', label: 'Deadlift', icon: '⚡' },
                { key: 'overhead', label: 'Overhead Press', icon: '🔥' }
              ].map((lift) => (
                <div key={lift.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="mr-2">{lift.icon}</span>
                    {lift.label} (1RM)
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      value={assessmentData.lifts[lift.key as keyof typeof assessmentData.lifts]}
                      onChange={(e) => setAssessmentData({
                        ...assessmentData,
                        lifts: { 
                          ...assessmentData.lifts, 
                          [lift.key]: parseFloat(e.target.value) || 0 
                        }
                      })}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      placeholder="0"
                    />
                    <div className="px-4 py-3 border border-l-0 border-gray-300 rounded-r-lg bg-gray-50 text-gray-600">
                      {assessmentData.personalInfo.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Training Goals</h2>
            <p className="text-gray-600 mb-6">Select all that apply to your training goals:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Increase overall strength',
                'Compete in powerlifting',
                'Improve technique',
                'Build muscle mass',
                'Lose body fat',
                'Improve mobility',
                'Prevent injuries',
                'Return from injury'
              ].map((goal) => (
                <label key={goal} className="flex items-center p-4 border border-gray-300 rounded-lg hover:border-red-600 cursor-pointer transition-colors">
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
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-600"
                  />
                  <span className="ml-3 text-gray-700">{goal}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Additional Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Injuries or Limitations (Optional)
              </label>
              <textarea
                value={assessmentData.limitations}
                onChange={(e) => setAssessmentData({
                  ...assessmentData,
                  limitations: e.target.value
                })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                placeholder="Describe any current or past injuries, mobility limitations, or other factors that might affect your training..."
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>
          <button
            onClick={nextStep}
            className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            {currentStep === 4 ? 'Get Results' : 'Next'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StrengthAssessment;
