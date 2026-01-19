import React from 'react';
import {
  Award,
  Target,
  Heart,
  TrendingUp,
  Quote,
  Users,
  MapPin,
  ExternalLink,
  Play,
  BarChart3,
  Trophy,
  Medal,
  Globe,
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { ServiceDefinition } from './types';

export const onlineCoachingService: ServiceDefinition = {
  title: 'Online Coaching & Personalized Dashboard',
  tagline: 'The command center for your strength journey',
  description:
    'We built a unified coaching dashboard that connects workouts, recovery, metrics, and coach notes in one place.',
  image: '/IMG_1345.jpg',
  highlights: [
    'Video Check-ins',
    'Adaptive progress tracking',
  ],
};

const achievements = [
  {
    icon: <Trophy className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />,
    text: 'Over 1,200 online sessions delivered to lifters across 4 continents',
    category: 'reach',
    year: '2018-Present',
  },
  {
    icon: <Medal className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />,
    text: '90% of athletes hit new PRs inside 12 weeks using the dashboard',
    category: 'results',
    year: 'Ongoing',
  },
  {
    icon: <Globe className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />,
    text: 'Global community with athletes tuning in from Tunisia, Europe, and North America',
    category: 'community',
    year: '2020-Present',
  },
  {
    icon: <MapPin className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" />,
    text: 'Tailored plans for powerlifters, weightlifters, and hybrid athletes',
    category: 'programming',
    year: 'Every cycle',
  },
];

const comingSoonFeatures = [
  {
    title: 'Live Training Dashboard',
    description: 'See upcoming sessions, daily focuses, and PR history in a single glance.',
    icon: LayoutDashboard,
  },
  {
    title: 'Adaptive Progress Tracking',
    description: 'Automatic charts that highlight strength trends and recovery readiness.',
    icon: TrendingUp,
  },
  {
    title: 'Weekly Coach Sync',
    description: 'Book feedback calls and review video check-ins from one shared timeline.',
    icon: CalendarCheck,
  },
  {
    title: 'Community + Support',
    description: 'Share wins, ask questions, and get coach responses inside a private feed.',
    icon: MessageSquare,
  },
  {
    title: 'Session Analytics',
    description: 'Track volume, intensity, and fatigue with auto-generated training reports.',
    icon: BarChart3,
  },
  {
    title: 'Recovery Insights',
    description: 'Log sleep, wellness, and readiness markers to keep your plan sustainable.',
    icon: Activity,
  },
];

const testimonials = [
  {
    quote: 'After 8 weeks with Elyes, I added 35kg to my total. The plan was simple, smart, and effective.',
    author: 'Ali',
    location: 'Tunisia',
  },
  {
    quote: 'The mobility plan and dashboard checkpoints fixed my hips. Now I squat pain-free.',
    author: 'Bochra Ben Yaghlene',
    location: 'Tunisia',
  },
];

const philosophyHighlights = [
  {
    icon: <Heart className="w-12 h-12 text-red-600 mx-auto mb-4" />,
    title: 'Longevity',
    description: 'Build strength that lasts decades, not seasons. Smart programming prevents burnout and injury.',
  },
  {
    icon: <Target className="w-12 h-12 text-red-600 mx-auto mb-4" />,
    title: 'Technique',
    description: 'Perfect form is the foundation of strength. Every rep builds better movement patterns.',
  },
  {
    icon: <TrendingUp className="w-12 h-12 text-red-600 mx-auto mb-4" />,
    title: 'Mobility',
    description: 'Flexibility and mobility work keeps you moving cleanly under load for the long run.',
  },
  {
    icon: <Award className="w-12 h-12 text-red-600 mx-auto mb-4" />,
    title: 'Performance',
    description: 'Data-driven coaching adapts to your progress and pushes you to new personal records safely.',
  },
];

type OnlineCoachingSectionProps = {
  service: ServiceDefinition;
};

export const OnlineCoachingSection = ({ service }: OnlineCoachingSectionProps) => (
  <section id="online-coaching" className="space-y-16 rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.5)] backdrop-blur min-h-[50rem]">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.5em] text-red-200">
          Online Coaching
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white">{service.title}</h2>
        <p className="text-xl text-gray-300 leading-relaxed">{service.description}</p>
        <p className="text-sm uppercase tracking-[0.4em] text-red-400">{service.tagline}</p>
        <div className="space-y-3 text-sm text-gray-200">
          {service.highlights.map((item) => (
            <div key={item} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-red-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button className="rounded-full bg-red-600 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-red-500">
            Start coaching
          </button>
          <button className="rounded-full border border-white/40 px-6 py-3 text-xs font-semibold uppercase tracking-[0.4em] text-white/90 transition hover:border-white hover:bg-white/10">
            Schedule consultation
          </button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-white/15">
        <img
          src={service.image}
          alt={service.title}
          className="h-[420px] w-full object-cover"
          loading="lazy"
        />
        <div className="absolute bottom-6 left-6 space-y-1 text-white">
          <p className="text-sm font-medium">Coaching cadence</p>
          <p className="text-xl font-semibold">Weekly check-ins + live feedback</p>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs uppercase tracking-[0.5em] text-red-200 mb-6">
          Dashboard Highlights
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {comingSoonFeatures.map(({ title, description, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-gray-200 backdrop-blur">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-white">{title}</h4>
              </div>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.4em] text-white/70">
          Coach Impact
        </div>
        <div className="space-y-4">
          {achievements.map((achievement) => (
            <div key={achievement.text} className="flex items-start gap-3 text-gray-200">
              {achievement.icon}
              <div>
                <p className="font-semibold text-white">{achievement.text}</p>
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">{achievement.year}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6 text-sm text-gray-200">
          <p className="text-gray-300 mb-2">Live diagnostics & communication</p>
          <p className="text-white font-semibold">
            Track readiness, recovery, and performance in one coach-managed dashboard — no more juggling spreadsheets.
          </p>
        </div>
      </div>
    </div>

    <div className="w-full max-w-none -mx-6 px-6 py-16 bg-gradient-to-br from-black to-gray-900 rounded-[28px]">
      <div className="text-center">
        <blockquote className="max-w-5xl mx-auto">
          <p className="text-xl md:text-2xl lg:text-3xl font-light text-white leading-relaxed italic tracking-wide mb-6">
            "Strength is more than lifting heavy. I build long-term athletes through technique, mobility, and structured progression backed by real-time coaching."
          </p>
          <footer>
            <cite className="text-lg md:text-xl text-gray-300 font-medium not-italic">— Elyes Zerai</cite>
          </footer>
        </blockquote>
      </div>
    </div>

    <div>
      <h3 className="text-3xl font-bold text-white text-center mb-12">What Athletes Say</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {testimonials.map((testimonial) => (
          <div key={testimonial.author} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 shadow-lg">
            <Quote className="w-8 h-8 text-red-600 mb-4" />
            <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
            <div className="text-white font-semibold">
              — {testimonial.author}, {testimonial.location}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button className="rounded-full bg-red-600 px-8 py-3 text-sm font-semibold uppercase tracking-[0.4em] text-white transition hover:bg-red-500">
          See more results
        </button>
      </div>
    </div>

    <div>
      <h3 className="text-3xl font-bold text-white text-center mb-10">Coaching Philosophy</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {philosophyHighlights.map((item) => (
          <div key={item.title} className="group text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20 overflow-hidden">
            <div className="transition-all duration-300 group-hover:mb-4">
              {item.icon}
              <h4 className="text-xl font-semibold text-white mb-3">{item.title}</h4>
            </div>
            <div className="max-h-0 group-hover:max-h-32 overflow-hidden transition-all duration-300 ease-in-out">
              <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="text-center">
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-3xl p-8 md:p-12">
        <div className="flex justify-center mb-6">
          <img src="/logoELA.png" alt="Elyes Lift Academy Logo" className="w-28 h-28 object-contain" />
        </div>
        <h3 className="text-3xl font-bold text-white mb-4">Ready to start online coaching?</h3>
        <p className="text-xl text-red-100 mb-8 max-w-2xl mx-auto">
          Join Elyes Lift Academy and receive a personalized plan backed by live coaching, analytics, and accountability.
        </p>
        <button className="bg-white text-red-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold transition-colors text-base">
          Book onboarding call
        </button>
      </div>
    </div>
  </section>
);

export default onlineCoachingService;
