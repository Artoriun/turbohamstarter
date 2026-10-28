import { localise } from '@hamstarter/shared';
import { HamsterCoding } from '../components/HamsterCoding';
import { Item } from '../components/PageTransition';
import { ProjectCarousel } from '../components/ProjectCarousel';
import { usePageSections } from '../context/ContentContext';
import { useLang } from '../i18n';
import { optimizeUrl } from '../lib/images';

export default function About() {
  const sections = usePageSections('about');
  const { lang } = useLang();
  // The h1 goes to the first *text* section — a carousel section can sort ahead of it
  // without displacing which one gets it. See the matching note in Home.tsx.
  const heroSection = sections.find((s) => s.kind !== 'carousel');
  const numbered = sections.filter((s) => s.kind !== 'carousel');

  return (
    <div className="page">
      <HamsterCoding />
      {sections.map((section) => {
        if (section.kind === 'carousel') {
          return (
            <Item key={section.id}>
              <ProjectCarousel slides={section.slides ?? []} />
            </Item>
          );
        }

        const i = numbered.indexOf(section);
        return (
          <Item key={section.id}>
            <section className="content-section">
              <p className="eyebrow">{String(i + 1).padStart(2, '0')}</p>
              {section.image && (
                <img
                  className="section-image"
                  src={optimizeUrl(section.image, 800)}
                  alt=""
                  loading={section === heroSection ? 'eager' : 'lazy'}
                  decoding="async"
                />
              )}
              {/* The first text section carries the page's h1; the rest are subsections. */}
              {section === heroSection ? (
                <h1>{localise(section, lang).heading}</h1>
              ) : (
                <h2>{localise(section, lang).heading}</h2>
              )}
              <p>{localise(section, lang).body}</p>
            </section>
          </Item>
        );
      })}
    </div>
  );
}
