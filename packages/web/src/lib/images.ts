/**
 * Inject Cloudinary format/quality/resize transforms into an image URL.
 *
 * `f_auto` picks WebP/AVIF per browser and `q_auto` picks a quality level from the image
 * content, which together do most of the work: the untransformed originals are 0.5-1.2MB
 * PNGs. Non-Cloudinary URLs (blob: previews from the admin file picker, the placeholder)
 * are returned untouched.
 *
 * Lives here rather than beside one caller because it was previously module-local to
 * Home.tsx, so ProjectCarousel silently served the full-size originals on the home page.
 */
export function optimizeUrl(url: string, w = 400): string {
  if (!url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${w}/`);
}

/** Width for full-bleed images as opposed to smaller in-content ones. */
export const FULL_BLEED_W = 1600;

/**
 * Candidate widths for the full-bleed images. The browser picks using CSS width x device
 * pixel ratio, not CSS width alone, so a 412px phone at DPR 2.6 asks for ~1080px and lands
 * on 1200 — the saving there is modest. The wins are on ordinary-DPR laptops and on phones
 * that report DPR 2, which currently download 1600 regardless.
 *
 * Kept to four steps: each extra candidate is another Cloudinary derivative to generate and
 * cache for no benefit once the ladder is dense enough to avoid overshooting by much.
 */
const FULL_BLEED_WIDTHS = [640, 960, 1280, 1600];

/** `srcset` for a full-bleed image. Empty for non-Cloudinary URLs, which cannot be
 *  resized — the caller's plain `src` still applies. */
export function fullBleedSrcSet(url: string): string {
  if (!url.includes('/image/upload/')) return '';
  return FULL_BLEED_WIDTHS.map((w) => `${optimizeUrl(url, w)} ${w}w`).join(', ');
}
