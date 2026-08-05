import { localise } from '@hamstarter/shared';
import { Link } from 'react-router-dom';
import { Item } from '../components/PageTransition';
import { ProjectCarousel } from '../components/ProjectCarousel';
import { usePageSections } from '../context/ContentContext';
import { useLang, useT } from '../i18n';
import { optimizeUrl } from '../lib/images';

/**
 * Splits on the first sentence break so the remainder can be emphasised.
 *
 * Matches the Japanese full stop and an ellipsis alongside the Latin period. A split on
 * ". " alone silently skipped every Japanese heading — 。 is not followed by a space — so
 * the accent device that defines the hero simply did not appear on half the site.
 */
function splitHeading(heading: string) {
  const match = heading.match(/^(.*?[.。…])\s*(.+)$/s);
  if (!match) return heading;
  const [, first, rest] = match;
  // One expression for the leading text, never `{first} <em>`: a literal space between an
  // expression and an element is a separate text node, which breaks hydration under this
  // project's DOM-capture prerendering. Whether a space belongs there depends on the
  // heading's language, not on which mark it happens to end with — an ellipsis is spaced
  // in the Latin heading but not in the Japanese one, same as the full stop already was.
  const isJapanese = /[぀-ヿ一-鿿]/.test(first);
  return (
    <>
      {isJapanese ? first : `${first} `}
      <em>{rest}</em>
    </>
  );
}

export default function Home() {
  const sections = usePageSections('home');
  const t = useT();
  const { lang } = useLang();
  // The hero is the first *text* section — a carousel section can sort ahead of it (the
  // bundled one does, order: -1) without displacing which section gets the h1 treatment.
  const hero = sections.find((s) => s.kind !== 'carousel');
  const numbered = sections.filter((s) => s.kind !== 'carousel' && s !== hero);

  return (
    <div className="page">
      {sections.map((section) => {
        if (section.kind === 'carousel') {
          return (
            <Item key={section.id}>
              <ProjectCarousel slides={section.slides ?? []} />
            </Item>
          );
        }

        if (section === hero) {
          return (
            <Item key={section.id}>
              <section className="hero">
                <p className="eyebrow">{t.home.eyebrow}</p>
                {/* A heading of the form "Something. So we built it." renders its second
                    sentence italic and in the accent colour, which is the source's signature
                    device. Headings without a second sentence are unaffected. */}
                <h1>{splitHeading(localise(section, lang).heading)}</h1>
                <p className="lead">{localise(section, lang).body}</p>
                <div className="hero-actions">
                  <Link className="btn btn-primary" to="/contact">
                    {t.home.ctaContact}
                  </Link>
                  <Link className="btn" to="/about">
                    {t.home.ctaAbout}
                  </Link>
                </div>
              </section>
            </Item>
          );
        }

        return (
          <Item key={section.id}>
            <section className="content-section">
              <p className="eyebrow">{String(numbered.indexOf(section) + 1).padStart(2, '0')}</p>
              {section.image && (
                <img
                  className="section-image"
                  src={optimizeUrl(section.image, 800)}
                  alt=""
                  // Below the fold by definition — the hero is above it — so this never
                  // competes with the Largest Contentful Paint.
                  loading="lazy"
                  decoding="async"
                />
              )}
              <h2>{localise(section, lang).heading}</h2>
              <p>{localise(section, lang).body}</p>
            </section>
          </Item>
        );
      })}
    </div>
  );
}
