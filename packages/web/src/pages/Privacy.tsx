import { useT } from '../i18n';

/**
 * Describes what the contact form does with a visitor's details, which is the only place
 * this site collects personal data. Written from the actual behaviour of
 * packages/api/src/routes/contact.ts — messages are emailed and never stored, and the only
 * browser storage is a theme preference.
 *
 * Not legal advice: the wording should be reviewed before the site is handed over.
 */
export default function Privacy() {
  const t = useT();
  return (
    <div className="page legal-page">
      <h1>{t.privacy.title}</h1>
      <p className="legal-updated">{t.privacy.updated}</p>

      <h2>{t.privacy.collectTitle}</h2>
      <p>{t.privacy.collectBody}</p>

      <h2>{t.privacy.useTitle}</h2>
      <p>{t.privacy.useBody}</p>

      <h2>{t.privacy.sharingTitle}</h2>
      <p>{t.privacy.sharingBody}</p>

      <h2>{t.privacy.retentionTitle}</h2>
      <p>{t.privacy.retentionBody}</p>

      <h2>{t.privacy.cookiesTitle}</h2>
      <p>{t.privacy.cookiesBody}</p>

      <h2>{t.privacy.rightsTitle}</h2>
      <p>{t.privacy.rightsBody}</p>
    </div>
  );
}
