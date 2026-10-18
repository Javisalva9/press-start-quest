/**
 * A player's stars, 0.5 to 5 in half steps, are stored as a whole number
 * of half stars, 1 to 10: 3.5 stars is saved as 7. Whole numbers compare
 * and sum exactly; 3.5 as a float can come back as 3.4999…. Only the
 * database sees half stars: everything else speaks in stars.
 */
export function toHalfStars(stars: number): number {
  return Math.round(stars * 2);
}

export function fromHalfStars(halves: number): number {
  return halves / 2;
}
