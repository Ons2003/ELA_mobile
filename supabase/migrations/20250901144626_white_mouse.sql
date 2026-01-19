/*
  # Seed Initial Data for Elyes Lift Academy

  1. Programs
    - Insert the training programs from the existing data
  
  2. Sample Data
    - Create sample users and enrollments for testing
*/

-- Insert training programs
INSERT INTO programs (
  title,
  subtitle,
  description,
  program_type,
  level,
  duration_weeks,
  price,
  currency,
  image_url,
  features,
  is_popular,
  is_active
) VALUES
(
  'IMPROVE YOUR SQUAT',
  'Master Your Squat Technique',
  '6-week intermediate program focused on improving squat strength, technique, and mobility. Perfect for athletes looking to break through squat plateaus.',
  'powerlifting',
  'intermediate',
  6,
  320.00,
  'TND',
  '/WhatsApp Image 2025-07-03 at 9.25.51 PM.jpeg',
  ARRAY['6-week structured progression', 'Technique refinement', 'Mobility integration', 'Strength building protocols'],
  true,
  true
),
(
  'BENCH PROGRAM',
  'Build Your Bench Press',
  '12-week intermediate bench press specialization program. Comprehensive approach to building pressing strength and technique mastery.',
  'powerlifting',
  'intermediate',
  12,
  650.00,
  'TND',
  '/Dark Purple Man Of The Match Football Sport Instagram Post copy.png',
  ARRAY['12-week progression', 'Technique focus', 'Accessory work', 'Strength protocols'],
  false,
  true
),
(
  'DEADLIFT PROGRAM',
  'Deadlift Strength & Power',
  '10-week intermediate deadlift program focusing on strength, technique, and power development. Build your strongest deadlift yet.',
  'powerlifting',
  'intermediate',
  10,
  490.00,
  'TND',
  'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['10-week progression', 'Power development', 'Technique refinement', 'Strength protocols'],
  false,
  true
),
(
  'START POWERLIFTING',
  'Your Powerlifting Journey Begins',
  '8-week beginner program designed to introduce you to powerlifting. Learn the fundamentals of squat, bench, and deadlift safely.',
  'powerlifting',
  'beginner',
  8,
  390.00,
  'TND',
  'https://images.pexels.com/photos/1552103/pexels-photo-1552103.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['8-week foundation', 'Safety protocols', 'Basic technique', 'Progressive loading'],
  false,
  true
),
(
  'SBD PREP - 8 WEEKS OUT',
  'Competition Peak Protocol',
  '8-week advanced competition preparation for squat, bench, and deadlift. Peak your performance for meet day.',
  'competition_prep',
  'advanced',
  8,
  450.00,
  'TND',
  'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['Competition simulation', 'Peak performance', 'Attempt selection', 'Mental preparation'],
  false,
  true
),
(
  'SBD PREP - 16 WEEKS OUT',
  'Extended Competition Preparation',
  '16-week advanced competition preparation program. Complete preparation cycle from base building to competition peak.',
  'competition_prep',
  'advanced',
  16,
  790.00,
  'TND',
  'https://images.pexels.com/photos/1552244/pexels-photo-1552244.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['16-week progression', 'Base building phase', 'Peak phase', 'Competition strategy'],
  false,
  true
),
(
  'OLYMPIC WEIGHTLIFTING BASICS',
  'Master the Snatch & Clean & Jerk',
  '12-week beginner program introducing Olympic weightlifting fundamentals. Learn proper technique for snatch and clean & jerk from the ground up.',
  'olympic_weightlifting',
  'beginner',
  12,
  580.00,
  'TND',
  '/WeighliftingBasics.png',
  ARRAY['12-week progression', 'Technique mastery', 'Mobility protocols', 'Safety fundamentals'],
  false,
  true
),
(
  'WEIGHTLIFTING TECHNIQUE MASTERY',
  'Perfect Your Olympic Lifts',
  '8-week intermediate program focused on refining snatch and clean & jerk technique. Includes video analysis and personalized corrections.',
  'olympic_weightlifting',
  'intermediate',
  8,
  720.00,
  'TND',
  'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['8-week refinement', 'Video analysis', 'Technical drills', 'Competition prep'],
  false,
  true
),
(
  'ELITE WEIGHTLIFTING PERFORMANCE',
  'Competition-Level Training',
  '16-week advanced program for competitive weightlifters. Includes periodization, peak cycles, and competition strategy for elite performance.',
  'olympic_weightlifting',
  'advanced',
  16,
  950.00,
  'TND',
  'https://images.pexels.com/photos/1552244/pexels-photo-1552244.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['16-week periodization', 'Competition cycles', 'Peak performance', 'Elite strategies'],
  false,
  true
),
(
  'REHAB & RECOVERY',
  'Return to Strength Training',
  '8-week rehabilitation program designed to safely return to training after injury. Focus on movement quality, pain-free progression, and building resilience.',
  'general_fitness',
  'all_levels',
  8,
  420.00,
  'TND',
  'https://images.pexels.com/photos/1552103/pexels-photo-1552103.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['8-week progression', 'Injury prevention', 'Movement quality', 'Pain-free training'],
  false,
  true
),
(
  'GENERAL PHYSICAL PREPARATION',
  'Build Your Athletic Foundation',
  '10-week comprehensive program focusing on overall fitness, movement quality, and athletic development. Perfect for building a strong foundation before specializing in powerlifting or weightlifting.',
  'general_fitness',
  'all_levels',
  10,
  360.00,
  'TND',
  'https://images.pexels.com/photos/1552103/pexels-photo-1552103.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['10-week progression', 'Movement fundamentals', 'Conditioning protocols', 'Athletic development'],
  false,
  true
),
(
  'WOMEN WEIGHTLIFTING 2.0',
  'Advanced Women''s Olympic Lifting',
  'Specialized 12-week program designed specifically for women in Olympic weightlifting. Addresses female-specific biomechanics, hormonal considerations, and competition preparation.',
  'olympic_weightlifting',
  'intermediate',
  12,
  680.00,
  'TND',
  'https://images.pexels.com/photos/1552238/pexels-photo-1552238.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['12-week specialization', 'Female-specific programming', 'Hormonal periodization', 'Competition preparation'],
  false,
  true
),
(
  'POWERLIFTING MASTERY',
  'Complete Powerlifting Development',
  'Comprehensive 16-week powerlifting program for serious athletes. Covers all three lifts with advanced periodization, technique refinement, and competition strategies.',
  'powerlifting',
  'advanced',
  16,
  850.00,
  'TND',
  'https://images.pexels.com/photos/1552252/pexels-photo-1552252.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
  ARRAY['16-week periodization', 'Advanced techniques', 'Competition strategies', 'Strength maximization'],
  false,
  true
);

-- Update current_participants count for programs (simulate some enrollments)
UPDATE programs SET current_participants = 
  CASE 
    WHEN title = 'IMPROVE YOUR SQUAT' THEN 245
    WHEN title = 'BENCH PROGRAM' THEN 189
    WHEN title = 'START POWERLIFTING' THEN 312
    WHEN title = 'DEADLIFT PROGRAM' THEN 156
    WHEN title = 'SBD PREP - 8 WEEKS OUT' THEN 89
    WHEN title = 'SBD PREP - 16 WEEKS OUT' THEN 67
    WHEN title = 'OLYMPIC WEIGHTLIFTING BASICS' THEN 134
    WHEN title = 'WEIGHTLIFTING TECHNIQUE MASTERY' THEN 87
    WHEN title = 'ELITE WEIGHTLIFTING PERFORMANCE' THEN 43
    WHEN title = 'REHAB & RECOVERY' THEN 78
    WHEN title = 'GENERAL PHYSICAL PREPARATION' THEN 198
    WHEN title = 'WOMEN WEIGHTLIFTING 2.0' THEN 92
    WHEN title = 'POWERLIFTING MASTERY' THEN 156
    ELSE 0
  END;