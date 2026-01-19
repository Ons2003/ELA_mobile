import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Search, Star, Trophy, Users } from 'lucide-react';
import { getPrograms } from '../lib/supabase';
import EnrollmentModal from './EnrollmentModal';
import { withFallbackImage } from '../constants/media';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const ProgramsPage = () => {
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollmentProgram, setEnrollmentProgram] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    try {
      const programsData = await getPrograms();
      setPrograms(programsData);
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

  const filteredPrograms = programs.filter((program) => {
    const matchesSearch =
      !searchTerm ||
      program.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      program.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = filterLevel === 'all' || program.level === filterLevel;
    const matchesType = filterType === 'all' || program.program_type === filterType;

    return matchesSearch && matchesLevel && matchesType;
  });

  const levelOptions = useMemo(() => {
    const levels = new Set(programs.map((program) => program.level).filter(Boolean));
    return ['all', ...Array.from(levels)];
  }, [programs]);

  const typeOptions = useMemo(() => {
    const types = new Set(programs.map((program) => program.program_type).filter(Boolean));
    return ['all', ...Array.from(types)];
  }, [programs]);

  return (
    <section className="min-h-screen bg-black text-white py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="bg-white/10 text-white">
            Full Program Library
          </Badge>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold">Explore every program</h1>
          <p className="mt-3 text-base text-white/70 max-w-3xl mx-auto">
            Search, filter, and choose the program that fits your goals.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-white mb-8">
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search programs"
                className="pl-10"
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by level" />
              </SelectTrigger>
              <SelectContent>
                {levelOptions.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level === 'all' ? 'All levels' : level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'all' ? 'All types' : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="py-16 text-center text-white/70">Loading programs...</div>
        ) : filteredPrograms.length === 0 ? (
          <div className="py-16 text-center text-white/70">
            No programs match your filters. Try adjusting the search.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program, index) => {
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
                  </CardContent>
                  <CardFooter className="flex items-center justify-between">
                    <div className="text-lg font-semibold">
                      {program.price} {program.currency}
                    </div>
                    <Button size="sm" onClick={() => setEnrollmentProgram(program)}>
                      Enroll
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
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

export default ProgramsPage;
