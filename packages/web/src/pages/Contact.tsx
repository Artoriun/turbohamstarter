import { type FormEvent, useState } from 'react';
import { HamsterWriting } from '../components/HamsterWriting';
import { useT } from '../i18n';
import { apiSendContact } from '../lib/api';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'unavailable';

export default function Contact() {
  const t = useT();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    website: '', // honeypot
  });

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      setError(t.contact.required);
      return;
    }
    // Deliberately loose. The server validates properly; this only catches typos early,
    // and a stricter pattern here would reject addresses that are actually valid.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t.contact.invalidEmail);
      return;
    }

    setStatus('sending');
    try {
      await apiSendContact(form);
      setStatus('sent');
      setForm({ name: '', email: '', subject: '', message: '', website: '' });
    } catch (err) {
      setStatus(err instanceof Error && err.message === 'unavailable' ? 'unavailable' : 'error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="page prose">
        <h1 className="title-accent">{t.contact.title}</h1>
        {/* role=status so a screen reader announces the outcome without moving focus. */}
        <p className="form-success" role="status">
          {t.contact.success}
        </p>
      </div>
    );
  }

  return (
    <div className="page prose">
      <h1 className="title-accent">{t.contact.title}</h1>
      <p>{t.contact.intro}</p>

      <form className="contact-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">{t.contact.name}</label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={set('name')}
            autoComplete="name"
          />
        </div>

        <div className="field">
          <label htmlFor="email">{t.contact.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="subject">{t.contact.subject}</label>
          <input id="subject" name="subject" value={form.subject} onChange={set('subject')} />
        </div>

        <div className="field field-wide">
          <label htmlFor="message">{t.contact.message}</label>
          <textarea
            id="message"
            name="message"
            rows={6}
            value={form.message}
            onChange={set('message')}
          />
        </div>

        {/* Honeypot: hidden from people, tempting to naive bots. Not display:none, which
            some bots detect — off-screen with aria-hidden and tabIndex -1 instead. */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={set('website')}
          />
        </div>

        {error && (
          <p className="form-error field-wide" role="alert">
            {error}
          </p>
        )}
        {status === 'error' && (
          <p className="form-error field-wide" role="alert">
            {t.contact.errorGeneric}
          </p>
        )}
        {status === 'unavailable' && (
          <p className="form-error field-wide" role="alert">
            {t.contact.errorUnavailable}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-primary field-wide"
          disabled={status === 'sending'}
        >
          {status === 'sending' ? t.contact.sending : t.contact.send}
        </button>
      </form>

      <HamsterWriting />
    </div>
  );
}
