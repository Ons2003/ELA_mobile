import React, { useEffect, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Quote, Star, Target, Trophy, TrendingUp } from 'lucide-react';
import { getTestimonials, Testimonial as TestimonialRecord } from '../lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

type Testimonial = Omit<TestimonialRecord, 'before_after'> & {
  beforeAfter: { before: string; after: string };
};

const stats = [
  { number: '57', label: 'Athletes Coached', icon: Target },
  { number: '5', label: 'African Records', icon: Trophy },
  { number: '68+', label: 'Medals Won', icon: Award },
  { number: '15+', label: 'Years Experience', icon: TrendingUp },
];

const Testimonials = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemsPerSlide, setItemsPerSlide] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 2 : 1,
  );
  const [currentSlide, setCurrentSlide] = useState(0);

  const fallbackImage = '/logoELA.png';

  useEffect(() => {
    let isMounted = true;

    const loadTestimonials = async () => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const data = await getTestimonials();
        if (!isMounted) {
          return;
        }

        const mapped: Testimonial[] = data.map(({ before_after, rating, ...rest }) => ({
          ...rest,
          rating: typeof rating === 'number' ? rating : 0,
          beforeAfter: before_after ?? { before: '', after: '' },
        }));

        setTestimonials(mapped);
        setCurrentSlide(0);
      } catch (error) {
        console.error('Error loading testimonials:', error);
        if (isMounted) {
          setLoadError('Unable to load testimonials right now.');
          setTestimonials([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadTestimonials();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setItemsPerSlide(window.innerWidth >= 1024 ? 2 : 1);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalSlides = Math.ceil(testimonials.length / itemsPerSlide);

  useEffect(() => {
    if (currentSlide >= totalSlides && totalSlides > 0) {
      setCurrentSlide(totalSlides - 1);
    }
  }, [currentSlide, totalSlides]);

  useEffect(() => {
    if (totalSlides <= 1 || typeof window === 'undefined') {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [totalSlides]);

  const handlePrevious = () => {
    if (totalSlides === 0) {
      return;
    }

    setCurrentSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  const handleNext = () => {
    if (totalSlides === 0) {
      return;
    }

    setCurrentSlide((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const slides: Testimonial[][] = [];
  for (let i = 0; i < testimonials.length; i += itemsPerSlide) {
    slides.push(testimonials.slice(i, i + itemsPerSlide));
  }

  const renderStars = (count: number) =>
    Array.from({ length: Math.max(0, count) }, (_, i) => (
      <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
    ));

  const getInitials = (name?: string | null) => {
    if (!name) return 'EA';
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <section id="testimonials" className="py-16 sm:py-20 bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge className="bg-white/10 text-white" variant="secondary">
            Proven Results
          </Badge>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold">Success Stories</h2>
          <p className="mt-3 text-base text-white/70 max-w-3xl mx-auto">
            Real transformations from real athletes. See how evidence-based programming drives performance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-12">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-white/10 bg-white/5 text-white">
              <CardContent className="p-4 text-center space-y-2">
                <stat.icon className="h-5 w-5 mx-auto text-red-300" />
                <div className="text-2xl font-semibold">{stat.number}</div>
                <div className="text-xs text-white/70">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Community wins</CardTitle>
            <CardDescription className="text-white/70">
              Slide through recent athlete reviews and progress highlights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center text-white/70">Loading testimonials...</div>
            ) : loadError ? (
              <div className="py-10 text-center text-red-300">{loadError}</div>
            ) : slides.length === 0 ? (
              <div className="py-10 text-center text-white/70">No testimonials available yet.</div>
            ) : (
              <>
                <div className="relative">
                  <div className="overflow-hidden">
                    <div
                      className="flex transition-transform duration-700 ease-in-out"
                      style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                      {slides.map((slideTestimonials, slideIndex) => (
                        <div key={slideIndex} className="w-full flex-shrink-0 px-1">
                          <div className="grid gap-4 lg:grid-cols-2">
                            {slideTestimonials.map((testimonial, testimonialIndex) => (
                              <Card
                                key={`${slideIndex}-${testimonialIndex}-${testimonial.name}`}
                                className="border-white/10 bg-black/50 text-white"
                              >
                                <CardHeader className="flex flex-row items-start gap-4">
                                  <Avatar>
                                    <AvatarImage
                                      src={testimonial.image || fallbackImage}
                                      alt={testimonial.name}
                                    />
                                    <AvatarFallback>{getInitials(testimonial.name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <CardTitle className="text-base">{testimonial.name}</CardTitle>
                                    {testimonial.role && (
                                      <CardDescription className="text-white/70">
                                        {testimonial.role}
                                      </CardDescription>
                                    )}
                                    {testimonial.location && (
                                      <p className="text-xs text-white/60">{testimonial.location}</p>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                      <div className="flex items-center gap-1">{renderStars(testimonial.rating)}</div>
                                      {testimonial.program && (
                                        <span className="text-xs text-white/60">Program: {testimonial.program}</span>
                                      )}
                                    </div>
                                    {testimonial.duration && (
                                      <div className="mt-1 text-xs text-red-300">
                                        Coaching duration: {testimonial.duration}
                                      </div>
                                    )}
                                  </div>
                                  <Quote className="h-6 w-6 text-red-300/60" />
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <p className="text-sm text-white/80">"{testimonial.quote}"</p>
                                  <div className="flex items-center justify-between text-xs text-white/60">
                                    <div className="flex items-center gap-2">
                                      <Trophy className="h-4 w-4 text-red-300" />
                                      <span>{testimonial.achievement ?? ''}</span>
                                    </div>
                                    <div>
                                      {testimonial.beforeAfter.before} to {testimonial.beforeAfter.after}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {slides.length > 1 && (
                    <div className="flex items-center justify-between pt-6">
                      <Button variant="outline" size="icon" onClick={handlePrevious} aria-label="Previous">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex gap-2">
                        {slides.map((_, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setCurrentSlide(index)}
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              currentSlide === index ? 'w-8 bg-red-500' : 'w-2.5 bg-white/20 hover:bg-white/40'
                            }`}
                            aria-label={`Go to testimonials set ${index + 1}`}
                          />
                        ))}
                      </div>
                      <Button variant="outline" size="icon" onClick={handleNext} aria-label="Next">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default Testimonials;