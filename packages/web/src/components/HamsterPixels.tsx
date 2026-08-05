/**
 * The mascot's resting pose (frame 0 of hamster-sprite.svg's sprite sheet), extracted as
 * plain rects rather than referenced through a CSS background-image. Everywhere this needs
 * to sit inside a scene built from other inline SVG shapes — the carousel's loading wheel,
 * illustrations elsewhere — a background-image is a second network request racing the rest
 * of the page, and on a slow connection can still be in flight after everything around it
 * has already painted, with nothing to trigger a repaint once it finally arrives. Inline
 * rects are part of the same markup as the rest of the scene, so there is nothing to wait
 * for and nothing that can be "not loaded yet".
 *
 * Grouped by fill colour rather than one [x, y, fill] tuple per pixel: the same handful of
 * colours repeat across all 144 pixels, so this is the difference between spelling out
 * "#8e979c" 72 times and once.
 */
const FRAME: ReadonlyArray<
  readonly [fill: string, points: ReadonlyArray<readonly [number, number]>]
> = [
  [
    '#0c343d99',
    [
      [2, 1],
      [3, 1],
      [10, 1],
      [11, 1],
      [1, 2],
      [4, 2],
      [9, 2],
      [12, 2],
      [1, 3],
      [5, 3],
      [6, 3],
      [7, 3],
      [8, 3],
      [12, 3],
      [1, 4],
      [12, 4],
      [0, 5],
      [13, 5],
      [0, 6],
      [13, 6],
      [0, 7],
      [13, 7],
      [0, 8],
      [13, 8],
      [2, 9],
      [13, 9],
      [2, 10],
      [13, 10],
      [3, 11],
      [12, 11],
      [3, 12],
      [12, 12],
      [4, 13],
      [5, 13],
      [6, 13],
      [7, 13],
      [8, 13],
      [9, 13],
      [10, 13],
      [11, 13],
    ],
  ],
  [
    '#8e979c',
    [
      [2, 2],
      [11, 2],
      [2, 3],
      [3, 3],
      [4, 3],
      [9, 3],
      [10, 3],
      [11, 3],
      [2, 4],
      [3, 4],
      [4, 4],
      [5, 4],
      [6, 4],
      [7, 4],
      [8, 4],
      [9, 4],
      [10, 4],
      [11, 4],
      [1, 5],
      [2, 5],
      [3, 5],
      [4, 5],
      [5, 5],
      [6, 5],
      [7, 5],
      [8, 5],
      [9, 5],
      [10, 5],
      [11, 5],
      [12, 5],
      [1, 6],
      [2, 6],
      [4, 6],
      [5, 6],
      [6, 6],
      [7, 6],
      [8, 6],
      [9, 6],
      [11, 6],
      [12, 6],
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
      [8, 7],
      [9, 7],
      [10, 7],
      [11, 7],
      [12, 7],
      [1, 8],
      [2, 8],
      [3, 8],
      [4, 8],
      [5, 8],
      [6, 8],
      [7, 8],
      [8, 8],
      [9, 8],
      [10, 8],
      [11, 8],
      [12, 8],
      [3, 9],
      [4, 9],
      [11, 9],
      [12, 9],
      [3, 10],
      [12, 10],
      [4, 12],
      [5, 12],
      [10, 12],
      [11, 12],
    ],
  ],
  [
    '#e88fa0',
    [
      [3, 2],
      [10, 2],
      [6, 7],
      [7, 7],
    ],
  ],
  [
    '#0c343d',
    [
      [3, 6],
      [10, 6],
    ],
  ],
  [
    '#e9edee',
    [
      [5, 9],
      [6, 9],
      [7, 9],
      [8, 9],
      [9, 9],
      [10, 9],
      [4, 10],
      [5, 10],
      [8, 10],
      [11, 10],
      [4, 11],
      [5, 11],
      [8, 11],
      [11, 11],
    ],
  ],
  [
    '#eeb7bd',
    [
      [6, 10],
      [7, 10],
      [9, 10],
      [10, 10],
      [6, 11],
      [7, 11],
      [9, 11],
      [10, 11],
    ],
  ],
  [
    '#b4bcc0',
    [
      [6, 12],
      [7, 12],
      [8, 12],
      [9, 12],
    ],
  ],
];

/**
 * Renders the mascot's resting pose on the same 16×15 grid the real sprite sheet uses.
 * `x`/`y` offset it in that grid's own units, so it can be positioned inside a larger scene
 * sharing the same viewBox — see ProjectCarousel.tsx's loading wheel, the only remaining
 * user of this: the page illustrations (HamsterScene.tsx) use the real animated `.mascot`
 * element instead now, not pixel data redrawn as SVG rects, so their animation is the
 * literal same one the header plays. A static resting pose is still right for the loading
 * wheel specifically — it's a transient loading indicator, not page content, and a
 * background-image is a second network request that can still be in flight after
 * everything around it has already painted, with nothing to trigger a repaint once it
 * finally arrives.
 */
export function HamsterPixels({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <>
      {FRAME.map(([fill, points]) => (
        <g key={fill} fill={fill}>
          {points.map(([px, py]) => (
            <rect key={`${px}-${py}`} x={x + px} y={y + py} width={1} height={1} />
          ))}
        </g>
      ))}
    </>
  );
}
