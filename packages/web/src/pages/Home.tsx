import { localise } from '@hamstarter/shared';
import { Link } from 'react-router-dom';
import { withMascot } from '../components/MascotMention';
import { Item } from '../components/PageTransition';
import { ProjectCarousel } from '../components/ProjectCarousel';
import { usePageSections } from '../context/ContentContext';
import { useLang, useT } from '../i18n';
import { optimizeUrl } from '../lib/images';

/**
 * Wraps the part of a heading that carries the accent.
 *
 * Two shapes, checked in this order:
 *
 * 1. **A leading label** — `Name: the rest of it`. The label is accented and the remainder
 *    is plain, so the heading reads as a name being declared.
 * 2. **A trailing clause** — everything after the first sentence break, which is the older
 *    device and still what a two-sentence heading gets.
 *
 * Both are derived from punctuation rather than from any particular words, so an
 * admin-written heading in either shape gets the treatment without the code knowing what it
 * says. The label case is length-capped: without that, a colon deep inside a long sentence
 * would accent most of the heading.
 *
 * Matches the Japanese colon and full stop alongside the Latin ones. A split on ". " alone
 * silently skipped every Japanese heading — 。 is not followed by a space — so the accent
 * device that defines the hero simply did not appear on half the site.
 */
function splitHeading(heading: string) {
  const label = heading.match(/^([^\s:：][^:：]{0,28}[:：])\s*(.+)$/s);
  if (label) {
    const [, name, rest] = label;
    // The full-width colon carries its own trailing space, so adding one doubles the gap.
    // Keyed on the punctuation rather than on the label's script: this label is
    // "TurboHamstarter：" — Latin letters and a Japanese colon — so a test for Japanese
    // characters in the label finds none and wrongly adds the space.
    const wideColon = name.endsWith('：');
    // The space rides with the following expression, never as a bare text node between an
    // element and an expression — that is a separate text node, which breaks hydration under
    // this project's DOM-capture prerendering.
    return (
      <>
        <em>{name}</em>
        {wideColon ? rest : ` ${rest}`}
      </>
    );
  }

  const match = heading.match(/^(.*?[.。…])\s*(.+)$/s);
  if (!match) return heading;
  const [, first, rest] = match;
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
                <p className="lead">{withMascot(localise(section, lang).body)}</p>
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
