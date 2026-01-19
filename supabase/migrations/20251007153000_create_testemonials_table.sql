/*
  # Testimonials Table

  - Stores marketing testimonials displayed on the public site
  - Captures athlete achievements and before/after progress snapshots
  - Seeds the table with the existing hard-coded testimonial data
*/

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  location text,
  image text,
  quote text not null,
  achievement text,
  before_after jsonb not null,
  rating smallint not null default 5 check (rating between 1 and 5),
  program text,
  duration text,
  created_at timestamptz not null default now()
);

comment on table public.testimonials is 'Marketing site testimonials shown on the home page';
comment on column public.testimonials.before_after is 'Snapshot of athlete progress before and after coaching';

insert into public.testimonials
  (name, role, location, image, quote, achievement, before_after, rating, program, duration)
values
  (
    'Alwa',
    'Powerlifter',
    'France',
    '/alwa.jpg',
    'Working with Elyes for the past year has been a game-changer for my powerlifting journey. His technical expertise and personalized programming helped me break through plateaus I thought were impossible. The attention to detail in mobility and technique work is unmatched.',
    'Becoming a PRO athlete',
    '{"before":"Competing","after":"Athlete"}'::jsonb,
    5,
    'SBD prep',
    '1 year'
  ),
  (
    'Riadh Dbaieb',
    'Junior Powerlifter',
    'Tunisia',
    '/riadh.jpg',
    'At 18, starting powerlifting with Elyes has been incredible. In just 6 months, he''s taught me proper technique, built my strength foundation, and helped me understand the sport. His guidance has been perfect for a young athlete like me.',
    'New PRs',
    '{"before":"Beginner","after":"Competing"}'::jsonb,
    5,
    'SBD prep & Mobility',
    '6 months'
  ),
  (
    'Ons Ouenniche',
    'powerlifting',
    'Tunisia',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Starting my fitness journey with Elyes was the best decision I made. His patient approach and detailed explanations helped me build confidence in the gym. The mobility work has been a game-changer for my daily life, and I''ve never felt stronger or more energetic.',
    'Complete Fitness Transformation',
    '{"before":"Beginner","after":"competing"}'::jsonb,
    5,
    'General Physical Preparation and ,mobility',
    '2years'
  ),
  (
    'Youssef Slimane',
    'Powerlifter',
    'Tunisia',
    'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'It was a way for me to be mind free about whether my program is on point or not - less stress. What I liked most was the group sessions. Good luck with the volume phase with Elyes!',
    'Squat Progression Specialist',
    '{"before":"Program Uncertainty","after":"Confident Training"}'::jsonb,
    5,
    'Powerlifting',
    '3 years'
  ),
  (
    'richard',
    'pack weightlifting',
    'czech',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'After hitting a plateau for months, Elyes'' programming got me back on track. His approach to peaking for competition is methodical and effective. I PR''d all three lifts at my last meet and placed 2nd in my weight class.',
    'Competition Success',
    '{"before":"Plateau","after":"Competition PRs"}'::jsonb,
    5,
    'Competition Prep - 16 Weeks',
    '8 months'
  ),
  (
    'Kenza',
    'Powerlifter',
    'Tunis',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Fixed weak points I couldn''t address on my own, both mentally and physically. The private sessions were incredibly valuable, and the mobility program helped me tremendously. My form has improved significantly along with major squat progress.',
    'Major Squat Progress & Form Improvement',
    '{"before":"90kg","after":"120kg"}'::jsonb,
    5,
    'Strength Up 2',
    'Almost 1 year'
  ),
  (
    'Bochra Ben Yaghlane',
    'Weightlifter',
    'Tunisia',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Elyes'' coaching approach is exceptional - explaining every move and how to improve it. The step-by-step progression has helped me develop proper technique, mobility, and strength. I hope we will see big progress together in the short and long term.',
    'Technique & Mobility Development',
    '{"before":"Beginner","after":"Improved Technique"}'::jsonb,
    5,
    'Olympic Weightlifting',
    '6 weeks'
  ),
  (
    'Aziz Ben Yaghlane',
    'Weightlifter',
    'Tunisia',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'The coaching helped me mentally the most - I understood my body and capabilities. What I liked most was the coaching style, the motivation, and Elyes'' adaptability. Don''t miss out on this opportunity!',
    'Mental & Physical Development',
    '{"before":"Limited Understanding","after":"Body Awareness"}'::jsonb,
    5,
    'Weightlifting',
    '60 sessions'
  ),
  (
    'Aichaa Elbanna',
    'Powerlifter',
    'Tunisia',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Coaching helped me in entering my powerlifting journey to become a stronger version mentally and physically. The most thing I liked is the challenge, the discipline, the consistency, the community and the mindset. Yes for sure I already recommend it every time I have the chance or when someone asks me about it. Big appreciation to our coach for his patience.',
    'Building strength and muscles',
    '{"before":"Beginner","after":"Stronger Version"}'::jsonb,
    5,
    'Powerlifting Fundamentals',
    '1 year and 6 months'
  ),
  (
    'Kenza',
    'Powerlifter',
    'Tunis',
    'https://images.pexels.com/photos/1552108/pexels-photo-1552108.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Fixed weak points I couldn''t address on my own, both mentally and physically. The private sessions were incredibly valuable, and the mobility program helped me tremendously. My form has improved significantly along with major squat progress.',
    'Major Squat Progress & Form Improvement',
    '{"before":"90kg","after":"120kg"}'::jsonb,
    5,
    'Strength Up 2',
    'Almost 1 year'
  ),
  (
    'Aymen Lajili',
    'Powerlifter',
    'Tunisia',
    'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=300&h=300&fit=crop',
    'Stress management, tracking progress, and planning - that''s what made the difference. The charity and atmosphere made training enjoyable. Keep it up!',
    'African Record -83kg Category',
    '{"before":"Squat","after":"+50kg"}'::jsonb,
    5,
    'Strength Up',
    'Since November 2023'
  );
