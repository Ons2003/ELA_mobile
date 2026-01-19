import React, { useState } from 'react';
import { ArrowRight, Clock, Star, Trophy, Users, Video } from 'lucide-react';
import { getPrograms } from '../lib/supabase';
import EnrollmentModal from './EnrollmentModal';
import { withFallbackImage } from '../constants/media';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const Programs = () => {
  const [enrollmentProgram, setEnrollmentProgram] = useState<any>(null);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const programsData = await getPrograms();
      const popularPrograms = Array.isArray(programsData)
        ? programsData.filter((program) => program?.is_popular)
        : [];
      setPrograms(popularPrograms);
    } catch (error) {
      console.error('Error loading programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentComplete = async (programId: string, updatedCount?: number) => {
    await loadPrograms();
    setEnrollmentProgram((prev) => {
      if (prev && prev.id === programId) {
        const nextCount =
          updatedCount ?? (typeof prev.current_participants === 'number' ? prev.current_participants + 1 : 1);
        return { ...prev, current_participants: nextCount, enrollment_count: nextCount };
      }
      return prev;
    });
  };

  const scrollToContact = () => {
    const element = document.getElementById('contact');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="programs" className="py-16 sm:py-20 bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="bg-white/10 text-white">
            Evidence-based programs
          </Badge>
          <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">Training Programs</h2>
          <p className="mt-3 text-base text-white/70 max-w-3xl mx-auto">
            Choose from structured strength programs created by an international champion. Each plan includes mobility
            work, progress tracking, and coach support.
          </p>
        </div>

        <Tabs defaultValue="popular" className="w-full">
          <TabsList className="mx-auto">
            <TabsTrigger value="popular">Popular Programs</TabsTrigger>
            <TabsTrigger value="consultation">Consultation</TabsTrigger>
          </TabsList>

          <TabsContent value="popular">
            {loading ? (
              <div className="py-16 text-center text-white/70">Loading programs...</div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {programs.map((program, index) => {
                  const enrollmentCount = program.enrollment_count ?? program.current_participants ?? 0;
                  const averageRating = typeof program.average_rating === 'number' ? program.average_rating : null;
                  const ratingLabel = averageRating !== null ? averageRating.toFixed(1) : '-';
                  const ratingCount = program.rating_count ?? 0;

                  return (
                    <Card key={index} className="overflow-hidden border-white/10 bg-white/5 text-white">
                      <div className="relative">
                        <img
                          src={withFallbackImage(program.image_url)}
                          alt={program.title}
                          className="h-44 w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute top-4 left-4">
                          <Badge className="bg-black/60 text-white" variant="secondary">
                            {program.level}
                          </Badge>
                        </div>
                        <div className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div className="absolute bottom-4 left-4 text-sm text-white">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-400" />
                            <span>{ratingLabel}</span>
                            <span className="text-xs text-white/70">
                              ({enrollmentCount} users{ratingCount ? ` - ${ratingCount} ratings` : ''})
                            </span>
                          </div>
                        </div>
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg">{program.title}</CardTitle>
                        <CardDescription className="text-white/70">{program.subtitle}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-white/70">{program.description}</p>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{program.duration_weeks} weeks</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{enrollmentCount} athletes</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {program.features.slice(0, 3).map((feature: string) => (
                            <div key={feature} className="flex items-start gap-2 text-xs text-white/70">
                              <ArrowRight className="mt-0.5 h-3 w-3 text-red-300" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between">
                        <div className="text-lg font-semibold">
                          {program.price} {program.currency}
                        </div>
                        <Button size="sm" onClick={() => setEnrollmentProgram(program)}>
                          Enroll
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="consultation">
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Not sure which program is right?</CardTitle>
                <CardDescription className="text-white/70">
                  Book a free 15-minute consultation and get a personalized recommendation from Elyes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/70">
                  We will match your goals, training history, and schedule to the right plan.
                </div>
                <Button className="w-full" onClick={scrollToContact}>
                  <Video className="h-4 w-4" />
                  Book Free Consultation
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {enrollmentProgram && (
        <EnrollmentModal
          program={enrollmentProgram}
          onClose={() => setEnrollmentProgram(null)}
          onEnrollmentComplete={handleEnrollmentComplete}
        />
      )}
    </section>
  );
};

export default Programs;