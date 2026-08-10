import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { apiSendContact } from '../lib/api';

export default function Contact() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    try {
      await apiSendContact({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        subject: String(data.get('subject') ?? ''),
        message: String(data.get('message') ?? ''),
        website: String(data.get('website') ?? ''),
      });
      setSubmitted(true);
    } catch (err) {
      const rateLimited = err instanceof Error && err.message === 'rate-limited';
      setError(rateLimited ? t.contact.tooMany : t.contact.error);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    // location.key is 'default' only for the entry the app was loaded on, so this
    // distinguishes "navigated here from another page" from "opened /contact directly or
    // refreshed" — where going back would leave the site entirely.
    const cameFromWithinSite = location.key !== 'default';
    return (
      <div className="page contact-page is-success">
        <h1>{t.contact.title}</h1>
        <p className="contact-success">{t.contact.success}</p>
        <button
          type="button"
          className="btn-submit contact-return-btn"
          onClick={() => (cameFromWithinSite ? navigate(-1) : navigate('/'))}
        >
          {t.contact.back}
        </button>
      </div>
    );
  }

  return (
    <div className="page contact-page">
      <h1>{t.contact.title}</h1>
      <form className="contact-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">{t.contact.name}</label>
          {/* Same reasoning as the email field: proper nouns get flagged constantly. */}
          <input
            type="text"
            id="name"
            name="name"
            maxLength={100}
            spellCheck={false}
            autoComplete="name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">{t.contact.email}</label>
          {/* An address is never a dictionary word, so autocorrect only gets in the way —
              and while a word is being marked, the browser paints it in its own colour,
              which showed as black text in dark mode. Turning the marking off fixes the
              cause rather than the symptom. */}
          <input
            type="email"
            id="email"
            name="email"
            maxLength={200}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">{t.contact.subject}</label>
          <input type="text" id="subject" name="subject" maxLength={150} required />
        </div>

        <div className="form-group">
          <label htmlFor="message">{t.contact.message}</label>
          <textarea id="message" name="message" rows={6} maxLength={5000} required />
        </div>

        {/* Honeypot: hidden from people and from assistive tech, but a bot that fills every
            field trips it and the message is dropped server-side. */}
        <input
          type="text"
          name="website"
          className="contact-hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        {error && (
          <p className="contact-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-submit" disabled={sending}>
          {sending ? t.contact.sending : t.contact.send}
        </button>
      </form>
    </div>
  );
}
