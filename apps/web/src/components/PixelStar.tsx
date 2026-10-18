/**
 * A pixel-art star, drawn from a grid like the logo: each X is a square.
 * Lit up to `fill` of its width (1, 0.5 or 0), grey beyond. One pixel of
 * shine on the lit part.
 */
const GRID = [
  '....X....',
  '...XXX...',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '..XX.XX..',
  '.XX...XX.',
];
const WIDTH = GRID[0]!.length;
const HEIGHT = GRID.length;
const SHINE = '4,1';

const PIXELS = GRID.flatMap((row, y) =>
  [...row].flatMap((cell, x) => (cell === 'X' ? [[x, y] as const] : [])),
);

export function PixelStar({
  fill,
  className = '',
}: {
  fill: 0 | 0.5 | 1;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {PIXELS.map(([x, y]) => {
        // Half a star: the columns left of the middle; the middle one too,
        // so 4.5 of 9 reads as half.
        const lit = fill === 1 || (fill === 0.5 && x < WIDTH / 2);
        const shine = lit && `${x},${y}` === SHINE;
        return (
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            className={
              shine ? 'fill-fg' : lit ? 'fill-star' : 'fill-line-strong'
            }
          />
        );
      })}
    </svg>
  );
}
