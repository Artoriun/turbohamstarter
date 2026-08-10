import PoemCarousel from '../components/PoemCarousel';
import { useT } from '../i18n';

export default function Home() {
  const t = useT();

  return (
    <div className="home-page">
      {/* The design is a full-bleed carousel with no room for a visible heading, so this page
          shipped with no headings at all — not just no h1. That leaves a screen reader with
          nothing to announce the page as, and a crawler with a document whose only text is
          poem fragments. Visually hidden rather than styled away with `display: none`, which
          would take it out of the accessibility tree along with the pixels.

          The poem titles in the carousel stay as they are: only one is on screen at a time
          and the slides are duplicated for looping, so promoting them to headings would put
          several competing ones in the document. */}
      <h1 className="visually-hidden">{t.home.heading}</h1>
      <section className="carousel-section" id="carousel">
        <PoemCarousel />
      </section>
    </div>
  );
}
