/** How lit a star is for a rating: 1 full, 0.5 half, 0 empty. */
export function starFill(star: number, rating: number | null): 0 | 0.5 | 1 {
  if (rating === null || rating <= star - 1) {
    return 0;
  }
  return rating >= star ? 1 : 0.5;
}

/**
 * The rating a tap gives: the left half of a star is half of it. Tapping
 * the rating already given takes it back (null).
 */
export function tappedRating(
  star: number,
  half: boolean,
  current: number | null,
): number | null {
  const value = half ? star - 0.5 : star;
  return value === current ? null : value;
}
