import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface HeroProps {
  onNavigate?: (page: string) => void;
}

const Hero = ({ onNavigate }: HeroProps) => {
  const [showCoupons, setShowCoupons] = useState(false);
  const storageKey = 'ela_hero_coupons_shown';

  const offerings = [
    'Powerlifting Training Programs',
    'Olympic Weightlifting Programs',
    'Mobility and Rehab Plans',
    'Competition Peak Cycles',
    'Women and Youth Focused Plans',
    'Private Coaching (Online and In-person)',
  ];

  const coupons = [
    { title: 'BIWAI Vibe', detail: '20% off any order', code: 'ONLY MEMBERS' },
    { title: 'IMPACT Sports Nutrition', detail: '8% off any purchase', code: 'lift08' },
    { title: 'CACTUS FIT', detail: '30% off forever', code: 'ONLY MEMBERS' },
  ];

  const openCoupons = useCallback(() => {
    setShowCoupons(true);
    try {
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  const handleOpenSignUpModal = () => {
    window.dispatchEvent(new CustomEvent('ela-open-signup'));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: number | undefined;
    try {
      const alreadyShown = sessionStorage.getItem(storageKey);
      if (alreadyShown) return;
    } catch {
      // continue to show once if storage unavailable
    }

    timer = window.setTimeout(() => {
      openCoupons();
    }, 5000);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [openCoupons]);

  return (
    <section id="home" className="relative min-h-screen overflow-hidden pt-20 sm:pt-24">
      <div className="absolute inset-0">
        <img className="h-full w-full object-cover" src="/back.JPG" alt="" aria-hidden="true" />
        <div className="absolute inset-0 bg-black/70" aria-hidden="true" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/10 bg-black/60 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur">
            <CardHeader className="space-y-4">
              <Badge className="w-fit bg-white/10 text-white" variant="secondary">
                Elite strength coaching
              </Badge>
              <div>
                <CardTitle className="text-3xl font-bold sm:text-4xl">Elyes Lift Academy</CardTitle>
                <CardDescription className="text-base text-white/80">
                  Championship-level programs built by a record-holding powerlifter. Train with precision, recover with
                  intention, and break your limits.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {offerings.slice(0, 4).map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-white/80">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-red-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-red-300" />
                  <span>Designed for serious lifters ready to own the platform.</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={() => onNavigate && onNavigate('strength-assessment')}>
                Take Strength Test
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => onNavigate && onNavigate('programs')}>
                Browse Programs
              </Button>
              <Button size="lg" variant="secondary" onClick={handleOpenSignUpModal}>
                <UserPlus className="h-4 w-4" />
                Create Account
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-6">
            <Card className="border-white/10 bg-black/50 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
              <CardHeader>
                <CardTitle className="text-xl">Quick Actions</CardTitle>
                <CardDescription className="text-white/70">
                  Build your plan in minutes and get direct access to coach guidance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="programs" className="w-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="programs" className="flex-1">
                      Programs
                    </TabsTrigger>
                    <TabsTrigger value="results" className="flex-1">
                      Results
                    </TabsTrigger>
                    <TabsTrigger value="coach" className="flex-1">
                      Coach
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="programs" className="space-y-3">
                    <p className="text-sm text-white/70">
                      Choose a peak cycle or long-term plan tailored to your experience level.
                    </p>
                    <Button className="w-full" onClick={() => onNavigate && onNavigate('programs')}>
                      Explore Programs
                    </Button>
                  </TabsContent>
                  <TabsContent value="results" className="space-y-3">
                    <p className="text-sm text-white/70">
                      Read performance stories and see the records achieved with Elyes Lift Academy.
                    </p>
                    <Button className="w-full" variant="outline" onClick={() => {
                      const element = document.getElementById('testimonials');
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}>
                      See Results
                    </Button>
                  </TabsContent>
                  <TabsContent value="coach" className="space-y-3">
                    <p className="text-sm text-white/70">
                      Work with Elyes directly for form checks, programming, and accountability.
                    </p>
                    <Button className="w-full" variant="secondary" onClick={handleOpenSignUpModal}>
                      Join Coaching
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-white/10 bg-black/50">
              <button type="button" onClick={openCoupons} className="group relative block w-full text-left">
                <img
                  src="/front.JPG"
                  alt="Elyes Zerai Training - Sponsored by Impact Nutrition"
                  className="h-56 w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  style={{ objectPosition: '50% 30%' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 space-y-2">
                  <Badge className="bg-black/60 text-white" variant="secondary">
                    Sponsored Athlete
                  </Badge>
                  <div className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Award className="h-5 w-5 text-red-400" />
                    Impact Nutrition
                  </div>
                </div>
              </button>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: '10x Tunisian Champion', icon: Trophy },
            { label: 'African Record Holder', icon: Target },
            { label: 'Global Online Coaching', icon: TrendingUp },
            { label: 'Elite Athlete Support', icon: Sparkles },
          ].map(({ label, icon: Icon }) => (
            <Card key={label} className="border-white/10 bg-black/50 p-4 text-white">
              <div className="flex items-center gap-3 text-sm">
                <Icon className="h-4 w-4 text-red-400" />
                <span>{label}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {showCoupons && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8"
          onClick={() => setShowCoupons(false)}
        >
          <Card
            className="max-w-5xl w-full border border-red-900/60 bg-black/90 p-6 text-white shadow-[0_32px_120px_rgba(0,0,0,0.65)] max-h-[calc(100vh-3rem)] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Member Discounts</CardTitle>
              <CardDescription className="text-white/70">
                Exclusive partner perks for Elyes Lift Academy athletes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-3">
              {coupons.map((coupon) => (
                <Card key={coupon.title} className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle className="text-lg">{coupon.title}</CardTitle>
                    <CardDescription className="text-white/70">{coupon.detail}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-2xl border border-white/15 bg-black/40 px-3 py-2 text-center text-sm">
                      Code: {coupon.code}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
            <CardFooter className="justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCoupons(false)}>
                Close
              </Button>
              <Button asChild>
                <a href="https://www.impactnutrition.com.tn/" target="_blank" rel="noopener noreferrer">
                  Visit Impact Nutrition
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </section>
  );
};

export default Hero;
