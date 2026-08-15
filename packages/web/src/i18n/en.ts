/**
 * The reference locale. Every other locale is type-checked against this shape, so adding a
 * key here and forgetting it elsewhere is a build error rather than a blank string in
 * production. See ./index.tsx for how to add a language.
 */
export const en = {
  /** Shown in the language switcher. Written in the language itself, as is conventional. */
  label: 'English',
  nav: {
    home: 'Home',
    about: 'About',
    contact: 'Contact',
    admin: 'Admin',
    skipToContent: 'Skip to content',
    menu: 'Menu',
  },
  home: {
    eyebrow: 'Intro',
    ctaContact: 'Get in touch',
    // Not 'Learn more': a link's text is its accessible name and its anchor text, and
    // on its own it describes nothing to a screen reader listing links or to a crawler.
    ctaAbout: 'What the starter includes',
    // The sprite is decorative and aria-hidden, so the popover needs words of its own or it
    // announces nothing at all.
    mascotHint: 'TurboHam, the mascot',
    mascotShow: 'Show TurboHam, the mascot',
  },
  carousel: {
    label: 'Projects',
    viewProject: 'View project',
    prev: 'Previous project',
    next: 'Next project',
    pause: 'Pause slideshow',
    play: 'Play slideshow',
    goTo: 'Go to project',
    loading: 'Loading…',
  },
  contact: {
    title: 'Contact',
    intro: 'Send a message and TurboHam will get back to you.',
    name: 'Name',
    email: 'Email',
    subject: 'Subject',
    message: 'Message',
    send: 'Send message',
    sending: 'Sending…',
    success: 'Thank you for your message. TurboHam will get back to you as soon as he can.',
    errorGeneric: 'Something went wrong. Please try again.',
    errorUnavailable: 'The contact form is not available right now. Please try again later.',
    required: 'Please fill in every field.',
    invalidEmail: 'Please enter a valid email address.',
  },
  privacy: {
    title: 'Privacy',
    body: 'This site stores no cookies. If analytics is configured, it is Cloudflare Web Analytics — cookie-less, and it does not collect personal data. If a page errors, the error message, stack trace and URL are sent to this site for diagnostics. A message sent through the contact form is delivered by email and is not stored on this site. Your address is used only to reply.',
  },
  notFound: {
    title: 'Page not found',
    body: 'That page does not exist.',
    back: 'Back to home',
  },
  error: {
    title: 'Something went wrong',
    body: 'The page failed to load. Reloading usually fixes it.',
    reload: 'Reload',
    home: 'Back to home',
  },
  theme: {
    toDark: 'Switch to dark mode',
    toLight: 'Switch to light mode',
  },
  language: {
    label: 'Language',
  },
  admin: {
    title: 'Admin',
    password: 'Password',
    signIn: 'Sign in',
    signOut: 'Sign out',
    wrongPassword: 'Incorrect password.',
    sessionExpired: 'Your session expired. Please sign in again.',
    unavailable: 'The admin API is unreachable.',
    loading: 'Loading…',
    sections: 'Sections',
    addSection: 'Add section',
    addCarousel: 'Add carousel',
    page: 'Page',
    filterAll: 'All',
    heading: 'Heading',
    body: 'Body',
    image: 'Image',
    upload: 'Upload image',
    uploading: 'Uploading…',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    delete: 'Delete',
    confirmDelete: 'Delete this section?',
    slides: 'Slides',
    addSlide: 'Add slide',
    deleteSlide: 'Delete slide',
    confirmDeleteSlide: 'Delete this slide?',
    cancel: 'Cancel',
    moveUp: 'Move up',
    moveDown: 'Move down',
    filterTitle: 'Profanity filter',
    filterHint:
      'Refuses to save content containing a blocked word. Enforced by the API, not just here.',
    filterOn: 'On',
    filterOff: 'Off',
    blocklist: 'Blocked words',
    blocklistHint: 'Comma separated. Leave empty to use the built-in list.',
    blockedWarning: 'Contains a blocked word:',
    blockedSave: 'Not saved — the filter blocked:',
    saveFailed: 'Could not save. Check the API is running.',
  },
  footer: {
    rights: 'All rights reserved.',
    privacy: 'Privacy',
  },
};

/**
 * The shape every locale must satisfy. Deliberately not `as const`: that would freeze each
 * value to its literal English string, and a translation would then fail to type-check
 * because "Inicio" is not "Home". What has to match is the set of keys, not the text.
 */
export type Dictionary = typeof en;
