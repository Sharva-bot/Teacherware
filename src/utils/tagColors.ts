// Monochrome tag color styling helper for minimal black & white theme

export interface TagBadgeStyle {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export function getTagStyle(tag: string): TagBadgeStyle {
  const normalized = tag.toLowerCase().trim();
  
  // High-priority tag (like Needs Front Row, Eye Strain) -> solid black text, light gray bg, dark gray border
  if (normalized.includes('front row') || normalized.includes('needs') || normalized.includes('eye strain') || normalized.includes('vision')) {
    return {
      bg: 'bg-neutral-100',
      text: 'text-neutral-950 font-bold',
      border: 'border-neutral-900',
      dot: 'bg-neutral-900',
    };
  }
  
  // Behavioral tag (like Talkative, Easily Distracted) -> outlined style with a dark border
  if (normalized.includes('talkative') || normalized.includes('distract')) {
    return {
      bg: 'bg-neutral-50',
      text: 'text-neutral-900',
      border: 'border-neutral-400 border-dashed',
      dot: 'bg-neutral-600',
    };
  }

  // Academic/Positive tags -> clean dark tag with white text
  if (normalized.includes('high performer') || normalized.includes('tutor') || normalized.includes('performer')) {
    return {
      bg: 'bg-neutral-900',
      text: 'text-neutral-50',
      border: 'border-neutral-950',
      dot: 'bg-neutral-100',
    };
  }
  
  // Standard Default Minimal Grayscale Badge
  return {
    bg: 'bg-white',
    text: 'text-neutral-700',
    border: 'border-neutral-200',
    dot: 'bg-neutral-400',
  };
}
