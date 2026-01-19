import React, { useEffect, useState } from 'react';
import { X, User, Mail, Phone, MapPin, Calendar, Target, Send, CheckCircle, Loader, AlertCircle, Clock, ChevronDown, ChevronUp, Dumbbell, BadgeCheck } from 'lucide-react';
import { enrollmentsAPI } from '../lib/api';
import { withFallbackImage } from '../constants/media';

interface EnrollmentModalProps {
  program: any;
  onClose: () => void;
  onEnrollmentComplete?: (programId: string, updatedCount?: number) => Promise<void> | void;
  prefillData?: Partial<EnrollmentData>;
}

interface EnrollmentData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  age: string;
  location: string;
  experience: string;
  goals: string;
  injuries: string;
  additionalInfo: string;
  womenOnly: boolean;
}

type EnrollmentTextField = Exclude<keyof EnrollmentData, 'womenOnly'>;

const normalizeString = (value: unknown): string => {
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

const EnrollmentModal = ({ program, onClose, onEnrollmentComplete, prefillData }: EnrollmentModalProps) => {
  const [formData, setFormData] = useState<EnrollmentData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    age: '',
    location: '',
    experience: '',
    goals: '',
    injuries: '',
    additionalInfo: '',
    womenOnly: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentParticipants, setCurrentParticipants] = useState<number>(program?.current_participants ?? 0);
  const [showFullDetails, setShowFullDetails] = useState(false);

  useEffect(() => {
    setCurrentParticipants(program?.current_participants ?? 0);
  }, [program]);

  useEffect(() => {
    if (!prefillData) {
      return;
    }
    setFormData((previous) => {
      const next = { ...previous };
      (Object.keys(prefillData) as Array<keyof EnrollmentData>).forEach((key) => {
        const incoming = prefillData[key];
        if (key === 'womenOnly') {
          if (typeof incoming === 'boolean') {
            next.womenOnly = incoming;
          }
          return;
        }
        const normalized = normalizeString(incoming);
        if (normalized) {
          next[key as EnrollmentTextField] = normalized;
        }
      });
      return next;
    });
  }, [prefillData, program?.id]);

  const handleInputChange = (field: EnrollmentTextField, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (submitStatus === 'error') {
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  const toggleWomenOnly = () => {
    setFormData((prev) => ({ ...prev, womenOnly: !prev.womenOnly }));
    if (submitStatus === 'error') {
      setSubmitStatus('idle');
      setErrorMessage('');
    }
  };

  const validateForm = () => {
    const required: EnrollmentTextField[] = ['firstName', 'lastName', 'email', 'phone', 'age', 'experience', 'goals'];
    const missing = required.filter((field) => {
      const value = formData[field];
      return typeof value !== 'string' || !value.trim();
    });
    
    if (missing.length > 0) {
      setErrorMessage(`Please fill in all required fields: ${missing.join(', ')}`);
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }

    // Age validation
    const age = parseInt(formData.age);
    if (isNaN(age) || age < 13 || age > 80) {
      setErrorMessage('Please enter a valid age between 13 and 80');
      return false;
    }

    return true;
  };

  const handleEnrollmentSuccess = async (nextCount?: number | null) => {
    setSubmitStatus('success');

    if (typeof nextCount === 'number') {
      setCurrentParticipants(nextCount);
    } else {
      setCurrentParticipants((prev) => prev + 1);
    }

    if (program?.id && onEnrollmentComplete) {
      try {
        await onEnrollmentComplete(
          program.id,
          typeof nextCount === 'number' ? nextCount : undefined
        );
      } catch (callbackError) {
        console.error('Error running enrollment completion callback:', callbackError);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Create enrollment directly without requiring authentication
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          program_id: program.id,
          user_data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            age: parseInt(formData.age),
            location: formData.location,
            experience_level: formData.experience,
            goals: formData.goals,
            injuries: formData.injuries,
            additional_info: formData.additionalInfo,
            is_women_only: formData.womenOnly
          }
        })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to submit enrollment');
      }

      await handleEnrollmentSuccess(result.current_participants);

    } catch (error) {
      console.error('Error submitting enrollment:', error);
      setSubmitStatus('error');
      setErrorMessage('Failed to submit enrollment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOld = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const result = await enrollmentsAPI.create(program.id, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        age: parseInt(formData.age),
        location: formData.location,
        experience_level: formData.experience,
        goals: formData.goals,
        injuries: formData.injuries,
        additional_info: formData.additionalInfo,
        is_women_only: formData.womenOnly
      });

      if (result.error) {
        throw new Error(result.error);
      }

      await handleEnrollmentSuccess(result.current_participants);

    } catch (error) {
      console.error('Error submitting enrollment:', error);
      setSubmitStatus('error');
      setErrorMessage('Failed to submit enrollment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncateText = (text: string, limit = 200) => {
    if (!text) {
      return '';
    }
    return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
  };

  const formatLabel = (value?: string | number) => {
    if (value === undefined || value === null) {
      return '';
    }
    return value
      .toString()
      .split(/[_-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const splitToItems = (value: string) =>
    value
      .split(/\r?\n|\u2022/)
      .map((item) => item.replace(/^[-\u2022]\s*/, '').trim())
      .filter(Boolean);

  type DetailChip = { icon: React.ComponentType<{ className?: string }>; label: string };

  const durationLabel =
    program?.duration ||
    (typeof program?.duration_weeks === 'number' ? `${program.duration_weeks} weeks` : '');

  const levelLabel = formatLabel(program?.level);
  const typeLabel = formatLabel(program?.program_type);
  const sessionsPerWeek = program?.sessions_per_week || program?.training_days_per_week;
  const commitmentLabel =
    normalizeString(program?.weekly_commitment || program?.training_commitment || program?.time_commitment) ||
    (sessionsPerWeek ? `${sessionsPerWeek} sessions / week` : '');

  const participantLabel = currentParticipants > 0
    ? `${currentParticipants.toLocaleString()}+ athletes enrolled`
    : '';
  const supportLabel = normalizeString(
    program?.coach_support ?? program?.support_details ?? program?.coaching_support
  );

  const detailChips = (
    [
      durationLabel ? { icon: Clock, label: durationLabel as string } : null,
      levelLabel ? { icon: BadgeCheck, label: levelLabel } : null,
      typeLabel ? { icon: Dumbbell, label: typeLabel } : null,
      commitmentLabel ? { icon: Calendar, label: commitmentLabel } : null,
      participantLabel ? { icon: User, label: participantLabel } : null,
      supportLabel ? { icon: Target, label: supportLabel } : null,
    ] as Array<DetailChip | null>
  ).filter((chip): chip is DetailChip => Boolean(chip));

  const descriptionCandidates = [
    normalizeString(program?.description),
    normalizeString(program?.long_description),
    normalizeString(program?.detailed_description),
    normalizeString(program?.program_overview),
    normalizeString(program?.subtitle),
  ].filter(Boolean);

  const baseDescription = descriptionCandidates[0] || '';
  const nextDescription = descriptionCandidates.slice(1).find((desc) => desc && desc !== baseDescription) || '';
  const primaryDescription = baseDescription || nextDescription;
  const secondaryDescription = nextDescription && nextDescription !== primaryDescription ? nextDescription : '';
  const descriptionPreview = truncateText(primaryDescription, 220);

  const features: string[] = Array.isArray(program?.features)
    ? (program.features as unknown[]).map(normalizeString).filter(Boolean)
    : [];

  const visibleFeatures = showFullDetails ? features : features.slice(0, 3);
  const hiddenFeatureCount = Math.max(features.length - visibleFeatures.length, 0);

  type AdditionalSection = {
    label: string;
    type: 'list' | 'text';
    items?: string[];
    content?: string;
  };

  const sectionSpecs: Array<{ key: string; label: string }> = [
    { key: 'highlights', label: 'Highlights' },
    { key: 'focus_points', label: 'Focus Points' },
    { key: 'training_phases', label: 'Training Phases' },
    { key: 'phases', label: 'Training Phases' },
    { key: 'modules', label: 'Program Modules' },
    { key: 'includes', label: "What's Included" },
    { key: 'bonus_content', label: 'Bonus Content' },
    { key: 'requirements', label: 'Requirements' },
    { key: 'prerequisites', label: 'Prerequisites' },
    { key: 'equipment_needed', label: 'Equipment Needed' },
    { key: 'equipment', label: 'Equipment Needed' },
    { key: 'nutrition_plan', label: 'Nutrition Support' },
    { key: 'support_materials', label: 'Support Materials' },
    { key: 'community_access', label: 'Community Access' },
    { key: 'resources', label: 'Resources Included' },
  ];

  const seenSectionLabels = new Set<string>();
  const additionalSections: AdditionalSection[] = [];

  sectionSpecs.forEach(({ key, label }) => {
    if (seenSectionLabels.has(label)) {
      return;
    }
    const value = program?.[key];
    if (Array.isArray(value) && value.length > 0) {
      const items = value
        .map((item: unknown) => normalizeString(item))
        .filter(Boolean);
      if (items.length > 0) {
        additionalSections.push({ label, type: 'list', items });
        seenSectionLabels.add(label);
      }
    } else {
      const stringValue = normalizeString(value);
      if (stringValue) {
        const items = splitToItems(stringValue);
        if (items.length > 1) {
          additionalSections.push({ label, type: 'list', items });
        } else {
          additionalSections.push({ label, type: 'text', content: stringValue });
        }
        seenSectionLabels.add(label);
      }
    }
  });

  const hasAdditionalSections = additionalSections.length > 0;

  const priceLabel = (() => {
    if (typeof program?.price === 'number') {
      const currency = normalizeString(program?.currency);
      return currency ? `${program.price} ${currency}` : program.price.toString();
    }
    return (
      normalizeString(program?.pricing) ||
      normalizeString(program?.price_display) ||
      normalizeString(program?.price_label) ||
      normalizeString(program?.price)
    );
  })();

  const paymentFrequency =
    normalizeString(program?.payment_frequency) ||
    normalizeString(program?.billing_cycle) ||
    normalizeString(program?.price_context);

  const shouldRenderDescription = Boolean(primaryDescription);
  const shouldRenderMoreDetails = showFullDetails && (Boolean(secondaryDescription) || hasAdditionalSections);
  if (submitStatus === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Enrollment Submitted!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for your interest in <strong>{program.title}</strong>. 
              Coach Elyes will review your application and contact you.
              Once approved, you'll receive login credentials to access your training dashboard.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
              <ul className="text-sm text-blue-800 space-y-1 text-left">
                <li>• Coach Elyes will review your application</li>
                <li>• You'll receive login credentials if accepted</li>
                <li>• Access your personalized training dashboard</li>
                <li>• Start your program with coach guidance</li>
              </ul>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button 
              onClick={onClose}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Enroll in Program</h2>
              <p className="text-red-100">{program.title}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Program Summary */}
          <div className="p-6 bg-gray-50 border-b">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="overflow-hidden rounded-xl bg-gray-200 shadow-inner lg:w-56 lg:flex-shrink-0">
              <img
                src={withFallbackImage(program?.image_url)}
                alt={program.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{program.title}</h1>
                  {program.subtitle && <p className="text-gray-600">{program.subtitle}</p>}
                </div>
                <div className="sm:text-right">
                  {priceLabel && (
                    <div className="text-lg font-semibold text-red-600">{priceLabel}</div>
                  )}
                  {paymentFrequency && (
                    <p className="text-xs uppercase tracking-wide text-gray-500">{paymentFrequency}</p>
                  )}
                </div>
              </div>
              {detailChips.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detailChips.map((chip, index) => {
                    const Icon = chip.icon;
                    return (
                      <span
                        key={`${chip.label}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600"
                      >
                        <Icon className="h-4 w-4 text-red-500" />
                        {chip.label}
                      </span>
                    );
                  })}
                </div>
              )}
              {shouldRenderDescription && (
                <p className="text-sm leading-relaxed text-gray-600">
                  {showFullDetails ? primaryDescription : descriptionPreview}
                </p>
              )}
              {visibleFeatures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Key Focus Areas</p>
                  <ul className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    {visibleFeatures.map((feature, index) => (
                      <li key={`${feature}-${index}`} className="flex items-start gap-2">
                        <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {!showFullDetails && hiddenFeatureCount > 0 && (
                    <p className="text-xs text-gray-500">+{hiddenFeatureCount} more focus areas</p>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowFullDetails((prev) => !prev)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 transition-colors hover:text-red-700"
                aria-expanded={showFullDetails}
              >
                {showFullDetails ? (
                  <>
                    Show less
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    More about this program
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          {shouldRenderMoreDetails && (
            <div className="mt-6 space-y-5">
              {secondaryDescription && (
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Program Overview</h4>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{secondaryDescription}</p>
                </div>
              )}
              {additionalSections.map((section, sectionIndex) => (
                <div key={`${section.label}-${sectionIndex}`} className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">{section.label}</h4>
                  {section.type === 'list' && section.items ? (
                    <ul className="space-y-2 text-sm text-gray-700">
                      {section.items.map((item, itemIndex) => (
                        <li key={`${section.label}-${itemIndex}`} className="flex items-start gap-2">
                          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-relaxed text-gray-700">{section.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/80 p-2 text-purple-700 shadow-inner">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-purple-900">Request a women-only cohort</p>
                <p className="text-xs text-purple-700/80">
                  Turn this on if you want to be placed in a women-only group. Admins will see this tag on your enrollment.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={formData.womenOnly}
              onClick={toggleWomenOnly}
              className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors ${
                formData.womenOnly ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <span className="sr-only">Toggle women-only enrollment</span>
              <span
                className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform ${
                  formData.womenOnly ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h3>
          
          {/* Error Message */}
          {submitStatus === 'error' && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800 mb-1">Error</h4>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Enter your first name"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="Enter your last name"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="your@email.com"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="+216 XX XXX XXX"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Age *
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="25"
                min="13"
                max="80"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Location
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                placeholder="City, Country"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Training Experience *
            </label>
            <select
              value={formData.experience}
              onChange={(e) => handleInputChange('experience', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
              disabled={isSubmitting}
            >
              <option value="">Select your experience level</option>
              <option value="complete-beginner">Complete Beginner (Never lifted weights)</option>
              <option value="beginner">Beginner (0-6 months)</option>
              <option value="novice">Novice (6 months - 2 years)</option>
              <option value="intermediate">Intermediate (2-5 years)</option>
              <option value="advanced">Advanced (5+ years)</option>
              <option value="competitive">Competitive Athlete</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Target className="w-4 h-4 inline mr-2" />
              Training Goals *
            </label>
            <textarea
              value={formData.goals}
              onChange={(e) => handleInputChange('goals', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors resize-none"
              placeholder="What do you want to achieve with this program? (e.g., increase squat strength, compete in powerlifting, improve technique, etc.)"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current or Past Injuries
            </label>
            <textarea
              value={formData.injuries}
              onChange={(e) => handleInputChange('injuries', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors resize-none"
              placeholder="Any injuries or limitations Coach Elyes should know about? (Optional)"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Information
            </label>
            <textarea
              value={formData.additionalInfo}
              onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors resize-none"
              placeholder="Tell Coach Elyes more about yourself, your training history, or any questions you have... (Optional)"
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Submit Enrollment
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              * Coach Elyes will personally review your application and respond within 24 hours
            </p>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EnrollmentModal;


