import { findSlide, localise } from '@hamstarter/shared';
import { useParams } from 'react-router-dom';
import { Item } from '../components/PageTransition';
import { useContent } from '../context/ContentContext';
import { useLang } from '../i18n';
import { optimizeUrl } from '../lib/images';
import { DEFAULT_PROJECT_IMAGES } from '../lib/projectAssets';
import NotFound from './NotFound';

/**
 * The "project explanation page" a carousel slide links to. One route, `:id` looked up
 * across every carousel-kind section's `slides` — wherever the carousel itself lives, its
 * slides all resolve here the same way. See the note on `Section.slides` in
 * packages/shared.
 */
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { sections } = useContent();
  const { lang } = useLang();

  const slide = id ? findSlide(id, sections) : undefined;
  // A deleted slide, or one not yet reached by a rebuild (see the ROUTES comment in
  // packages/shared), reads the same as any other missing page rather than a broken one.
  if (!slide) return <NotFound />;

  const { heading, body } = localise(slide, lang);
  // The bundled default is pixel art and wants image-rendering: pixelated so it stays crisp
  // at display size; an admin-uploaded photo replacing it should scale normally.
  const isDefaultImage = !slide.image;
  const image = slide.image || DEFAULT_PROJECT_IMAGES[slide.id] || '';

  return (
    <div className="page">
      <Item>
        <section className="content-section">
          {image && (
            <img
              className={isDefaultImage ? 'section-image pixel-img' : 'section-image'}
              src={optimizeUrl(image, 900)}
              alt=""
              loading="eager"
              decoding="async"
            />
          )}
          <h1 className="title-accent">{heading}</h1>
          <p>{body}</p>
        </section>
      </Item>
    </div>
  );
}
