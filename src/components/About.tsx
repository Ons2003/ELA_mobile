import React from 'react';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  Globe,
  LayoutDashboard,
  Medal,
  MessageSquare,
  Play,
  Trophy,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const About = () => {
  const achievements = [
    {
      icon: Trophy,
      text: 'African Squat and Total Record (Junior -93kg)',
      year: '2018',
    },
    {
      icon: Medal,
      text: '6x Tunisian Powerlifting Champion',
      year: '2015-2022',
    },
    {
      icon: Medal,
      text: '10x Tunisian Weightlifting Champion',
      year: '2012-2022',
    },
    {
      icon: Globe,
      text: '7th Place at Deadlift Classic World Championships (Turkey)',
      year: '2022',
    },
    {
      icon: Activity,
      text: 'Coaching lifters worldwide with personalized programming',
      year: '2020-Present',
    },
  ];

  const comingSoonFeatures = [
    {
      title: 'Live Training Dashboard',
      description: 'Upcoming sessions, daily focus, and PR history in one place.',
      icon: LayoutDashboard,
    },
    {
      title: 'Adaptive Progress Tracking',
      description: 'Automatic charts that highlight strength trends and readiness.',
      icon: BarChart3,
    },
    {
      title: 'Weekly Coach Sync',
      description: 'Book feedback calls and review video check-ins on a shared timeline.',
      icon: CalendarCheck,
    },
    {
      title: 'Community and Support',
      description: 'Share wins, ask questions, and receive coach feedback inside a private feed.',
      icon: MessageSquare,
    },
  ];

  const philosophy = [
    {
      title: 'Longevity',
      detail: 'Build strength that lasts decades through smart programming and recovery.',
    },
    {
      title: 'Technique',
      detail: 'Every rep reinforces efficient movement patterns and elite mechanics.',
    },
    {
      title: 'Mobility',
      detail: 'Mobility work is essential for peak performance and injury prevention.',
    },
    {
      title: 'Performance',
      detail: 'Data-driven cycles that evolve with your progress and goals.',
    },
  ];

  const testimonials = [
    {
      quote: 'After 8 weeks with Elyes, I added 35kg to my total. The plan was simple, smart, and effective.',
      author: 'Ali',
      location: 'Tunisia',
    },
    {
      quote: 'The mobility plan fixed my hips. Now I squat pain-free.',
      author: 'Bochra Ben Yaghlene',
      location: 'Tunisia',
    },
  ];

  return (
    <>
      <section id="coming-soon" className="py-16 sm:py-20 bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/10 bg-black/50">
              <CardHeader className="space-y-3">
                <Badge className="w-fit bg-white/10 text-white" variant="secondary">
                  Coming Soon
                </Badge>
                <CardTitle className="text-2xl sm:text-3xl">Your strength command center</CardTitle>
                <CardDescription className="text-white/70">
                  A fully integrated dashboard connecting programs, progress, and coach feedback in real time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl overflow-hidden border border-white/10">
                  <img
                    src="/dashboard.png"
                    alt="Training dashboard preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button variant="outline" className="w-full" onClick={() => {
                  const element = document.getElementById('contact');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}>
                  Join the waitlist
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {comingSoonFeatures.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="border-white/10 bg-white/5 text-white">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/20 text-red-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{title}</CardTitle>
                      <CardDescription className="text-white/70">{description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-16 sm:py-20 bg-gradient-to-br from-black via-gray-950 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl">Meet your coach</CardTitle>
                <CardDescription className="text-white/70">
                  Elyes Zerai is a certified strength coach and elite competitor with over a decade of Olympic
                  weightlifting and powerlifting experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  {achievements.map(({ icon: Icon, text, year }) => (
                    <AccordionItem key={text} value={text}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-red-400" />
                          <span className="text-sm">{text}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>Peak year: {year}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" asChild>
                    <a href="https://www.openpowerlifting.org/u/elyeszerai" target="_blank" rel="noopener noreferrer">
                      Competition History
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://goodlift.info/lifter.php?lid=18728" target="_blank" rel="noopener noreferrer">
                      Detailed Stats
                    </a>
                  </Button>
                </div>
                <Button asChild>
                  <a href="https://www.youtube.com/@ElyesLiftAccademy" target="_blank" rel="noopener noreferrer">
                    <Play className="h-4 w-4" />
                    Training Videos
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-white/10 bg-white/5">
              <div className="relative h-full min-h-[320px]">
                <img
                  src="/creatine_impact_shot.jpeg"
                  alt="Elyes Zerai - Competitive Strength Athlete"
                  className="h-full w-full object-cover object-center"
                  style={{ objectPosition: '50% 30%' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-6 left-6 space-y-2">
                  <Badge className="bg-black/60 text-white" variant="secondary">
                    Sponsored Athlete
                  </Badge>
                  <div className="text-xl font-semibold">Impact Sports Nutrition</div>
                </div>
              </div>
            </Card>
          </div>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-2xl">Coaching philosophy</CardTitle>
              <CardDescription className="text-white/70">
                Build long-term athletes through structured progression, technique, and recovery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {philosophy.map((item) => (
                  <AccordionItem key={item.title} value={item.title}>
                    <AccordionTrigger>{item.title}</AccordionTrigger>
                    <AccordionContent>{item.detail}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-2xl">What athletes say</CardTitle>
              <CardDescription className="text-white/70">Short wins from lifters in the community.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {testimonials.map((testimonial) => (
                <Card key={testimonial.author} className="border-white/10 bg-black/40 text-white">
                  <CardContent className="space-y-3 p-5">
                    <p className="text-sm text-white/80">"{testimonial.quote}"</p>
                    <div className="text-sm font-semibold text-white">
                      {testimonial.author}, {testimonial.location}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
};

export default About;
