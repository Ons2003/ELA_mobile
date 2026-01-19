import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Award, Sparkles } from 'lucide-react';
import services from './services/services';
import { ServiceDefinition } from './services/types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

const Services = () => {
  const [activeService, setActiveService] = useState<ServiceDefinition | null>(null);
  const activeServiceRef = useRef<ServiceDefinition | null>(null);
  const hasAutoShownRef = useRef(false);

  const openSignupModal = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ela-open-signup'));
  };

  useEffect(() => {
    activeServiceRef.current = activeService;
  }, [activeService]);

  const graphData = useMemo(() => {
    if (!activeService) return [];
    return activeService.highlights.map((highlight, idx) => ({
      label: highlight.split(' ').slice(0, 3).join(' '),
      value: 62 + (idx * 11) % 30,
    }));
  }, [activeService]);

  useEffect(() => {
    const partnerService = services.find(
      (service) => service.title === 'Brand & Nutrition Partner Offers',
    );
    if (!partnerService || hasAutoShownRef.current) return;
    const isHome = typeof window !== 'undefined' && window.location.pathname === '/';
    if (!isHome) return;

    const storageKey = 'ela_partner_modal_shown';
    try {
      const alreadyShown = sessionStorage.getItem(storageKey);
      if (alreadyShown) {
        hasAutoShownRef.current = true;
        return;
      }
    } catch {
      // ignore storage errors
    }

    const timer = setTimeout(() => {
      if (hasAutoShownRef.current || activeServiceRef.current) return;
      try {
        sessionStorage.setItem(storageKey, '1');
      } catch {
        // ignore storage errors
      }
      hasAutoShownRef.current = true;
      setActiveService(partnerService);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleActionClick = (service: ServiceDefinition) => {
    const isPhysician =
      service.title === 'Sports Physician Discount' || service.title === 'Physiotherapist Services';
    if (isPhysician) {
      window.open(
        'https://kinesitherapeute-toumi.com/?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQMMjU2MjgxMDQwNTU4AAGnulkcGcK9yZf5DDaFAKkxQkIq-htg7HZb340YPxM8rDf4SbPy9w8Nc8cueYM_aem_KbaQcPIPVptwhqXqjo052A',
        '_blank',
      );
      return;
    }
    setActiveService(service);
  };

  return (
    <section
      id="our-services"
      className="relative min-h-screen overflow-hidden bg-slate-950 text-white pt-24"
    >
      <div className="absolute inset-0">
        <img
          src="/IMG_1235.jpg"
          alt="Membership background"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/75" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:px-8 py-16">
        <Card className="border-white/10 bg-black/60 text-white">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="bg-white/10 text-white">
                Discounts and gifts
              </Badge>
              <Badge variant="secondary" className="bg-red-600/20 text-red-200">
                Only for members
              </Badge>
            </div>
            <CardTitle className="text-3xl sm:text-4xl">Membership advantages</CardTitle>
            <CardDescription className="text-white/70">
              Coaching, diagnostics, community, and accountability bundled in a single experience built for strength
              athletes.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={openSignupModal}>
              Join now
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setActiveService(services[0])}>
              Explore services
            </Button>
          </CardFooter>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {services.map((service) => {
            const isPhysician =
              service.title === 'Sports Physician Discount' || service.title === 'Physiotherapist Services';
            const isWomen = service.title === 'Women-Only Coaching Circle';
            const isPartner = service.title === 'Brand & Nutrition Partner Offers';
            const badgeLabel =
              service.title === 'Online Coaching & Personalized Dashboard'
                ? 'Dashboard'
                : isPhysician
                ? '-10%'
                : isWomen
                ? 'Coaching'
                : isPartner
                ? 'Discounts'
                : 'Details';

            return (
              <Card key={service.title} className="border-white/10 bg-white/5 text-white">
                <div className="relative">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="h-48 w-full rounded-t-3xl object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 rounded-t-3xl bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="secondary" className="bg-black/60 text-white">
                      {service.tagline}
                    </Badge>
                  </div>
                </div>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-xl">{service.title}</CardTitle>
                    <Badge variant="outline" className="border-white/20 text-white">
                      {badgeLabel}
                    </Badge>
                  </div>
                  <CardDescription className="text-white/70">{service.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {service.highlights.map((highlight) => (
                    <Badge key={highlight} variant="secondary" className="bg-white/10 text-white">
                      {highlight}
                    </Badge>
                  ))}
                </CardContent>
                <CardFooter className="justify-between">
                  <Button variant="outline" onClick={() => handleActionClick(service)}>
                    {isPhysician ? 'Book session' : isPartner ? 'Show discounts' : 'View details'}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {service.title === 'Online Coaching & Personalized Dashboard' && (
                    <Button variant="secondary" onClick={openSignupModal}>
                      Join now
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(activeService)} onOpenChange={(open) => (!open ? setActiveService(null) : null)}>
        {activeService && (
          <DialogContent className="border-white/10 bg-black text-white">
            <DialogHeader>
              <DialogTitle>{activeService.title}</DialogTitle>
              <DialogDescription className="text-white/70">{activeService.tagline}</DialogDescription>
            </DialogHeader>

            {activeService.title === 'Women-Only Coaching Circle' && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardContent className="p-4">
                    <img
                      src="/IMG_1323.jpg"
                      alt="Women coaching"
                      className="h-56 w-full rounded-2xl object-cover"
                    />
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/5 text-white">
                  <CardHeader>
                    <CardTitle>Meet your coach</CardTitle>
                    <CardDescription className="text-white/70">Yasmine Hkima</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-white/70">
                    <p>
                      3-time Tunisian Powerlifting Champion since 2023, winning 9 out of 9 competitions, and African
                      Champion 2023.
                    </p>
                    <p>3 African records in the Junior Women -52kg category.</p>
                    <p>Vice African Champion in the -57kg Open Women category in 2025.</p>
                    <p>Format: small-group calls, video feedback, and daily check-ins.</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeService.title === 'Brand & Nutrition Partner Offers' && (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: 'BIWAI Vibe', detail: '20% off any order', code: 'ONLY MEMBERS' },
                  { title: 'IMPACT Sports Nutrition', detail: '8% off any purchase', code: 'lift08' },
                  { title: 'CACTUS FIT', detail: '30% off forever', code: 'ONLY MEMBERS' },
                ].map((coupon) => (
                  <Card key={coupon.title} className="border-white/10 bg-white/5 text-white">
                    <CardHeader>
                      <CardTitle className="text-base">{coupon.title}</CardTitle>
                      <CardDescription className="text-white/70">{coupon.detail}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-2xl border border-white/20 bg-black/40 px-3 py-2 text-center text-sm">
                        Code: {coupon.code}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {activeService.title !== 'Women-Only Coaching Circle' &&
              activeService.title !== 'Brand & Nutrition Partner Offers' && (
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-white/10 bg-white/5 text-white">
                    <CardContent className="p-4">
                      <img
                        src={activeService.image}
                        alt={activeService.title}
                        className="h-56 w-full rounded-2xl object-cover"
                      />
                      <p className="mt-4 text-sm text-white/70">{activeService.description}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-white/5 text-white">
                    <CardHeader>
                      <CardTitle>Performance snapshot</CardTitle>
                      <CardDescription className="text-white/70">What athletes report after joining.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {graphData.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm text-white/80">
                            <span>{item.label}</span>
                            <span className="text-red-300 font-semibold">{item.value}%</span>
                          </div>
                          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-300"
                              style={{ width: `${item.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setActiveService(null)}>
                Close
              </Button>
              <Button onClick={openSignupModal}>
                Join now
                <Sparkles className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
};

export default Services;