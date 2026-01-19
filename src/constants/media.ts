export const FALLBACK_PROGRAM_IMAGE = 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop';

export const withFallbackImage = (value?: string | null) => {
  if (typeof value !== 'string') {
    return FALLBACK_PROGRAM_IMAGE;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_PROGRAM_IMAGE;
};
