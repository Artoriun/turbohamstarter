/**
 * NOTE ON IMPORTS
 *
 * This package deliberately has no relative imports, and everything lives in this one
 * file because of it. `main` points at src/index.ts — the package ships raw TypeScript,
 * because the API runs on a Node that strips types on load rather than compiling first.
 * Node's ESM resolver does no extension guessing, so `from './thing'` fails at runtime
 * with ERR_MODULE_NOT_FOUND, and `from './thing.ts'` needs allowImportingTsExtensions,
 * which TypeScript refuses in a package that emits — which the API does.
 *
 * Bundlers resolve either form, so the breakage appears only where this file is loaded
 * directly: the prerenderer. Add a sibling file here and the build passes while the
 * prerender dies.
 */

/**
 * An optional profanity check for content written in the admin portal.
 *
 * Lives in `shared` because it has to run in two places for two different reasons: the
 * portal runs it as you type so you find out before you press save, and the API runs it on
 * the write because that is the only place it is actually enforced. A check that exists
 * only in the browser is a suggestion — anything with `curl` and a token walks past it.
 *
 * Off by default. A starter that rejects your text before you have asked it to is worse
 * than one that waits to be switched on.
 */

/**
 * Deliberately short and mild. It is a starting point, not an attempt at coverage: a
 * serious list is context- and language-specific, ages badly, and belongs in your
 * repository rather than in a template. Extend `blocklist` in the admin portal, or replace
 * this array outright.
 */
export const DEFAULT_BLOCKLIST = [
  'arse',
  'bastard',
  'bollocks',
  'crap',
  'damn',
  'dickhead',
  'shit',
  'piss',
  'prick',
  'twat',
  'wanker',
];

/** Escapes a word so a stray regex character in a custom list cannot break the match. */
const escapeWord = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ProfanityMatch {
  /** The blocklist entry that matched. */
  word: string;
  /** Where it appears, so the caller can point at it. */
  index: number;
}

/**
 * Finds blocklisted words in `text`.
 *
 * Matching is on word boundaries, never substrings. This is the whole difficulty of the
 * problem: a substring check flags Scunthorpe, Penistone, classic, assess, cockatoo and
 * hundreds of ordinary words, and the failure is invisible until someone cannot save a
 * legitimate sentence. Word boundaries make false positives rare at the cost of missing
 * deliberate obfuscation (`sh1t`, `s h i t`), which is the right trade for a tool whose
 * job is to catch an accident rather than to defeat an adversary — the person typing is
 * signed in as the site owner.
 */
export function findProfanity(text: string, blocklist?: string[]): ProfanityMatch[] {
  // An empty list means "use the default", not "match nothing" — which is what the stored
  // settings mean by it, and what the portal sends once someone clears the field. Treating
  // [] as an explicit empty list left the filter switched on and silently inert: the toggle
  // read On, the API accepted everything, and nothing anywhere said why.
  // Turning the filter off is what expresses "match nothing".
  const list = blocklist?.length ? blocklist : DEFAULT_BLOCKLIST;
  if (!text) return [];

  const matches: ProfanityMatch[] = [];
  for (const word of list) {
    const clean = word.trim().toLowerCase();
    if (!clean) continue;
    // \b would not fire next to an apostrophe or a hyphen, so the boundary is expressed as
    // "not preceded/followed by a letter" instead.
    const re = new RegExp(`(?<![\\p{L}])${escapeWord(clean)}(?![\\p{L}])`, 'giu');
    for (const m of text.matchAll(re)) {
      matches.push({ word: clean, index: m.index ?? 0 });
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

/** Convenience for the API, which only needs to know whether to refuse the write. */
export function hasProfanity(text: string, blocklist?: string[]): boolean {
  return findProfanity(text, blocklist).length > 0;
}

/** Site-wide settings, stored alongside the content. */
export interface Settings {
  profanityFilter: boolean;
  /** Empty means "use DEFAULT_BLOCKLIST". */
  blocklist?: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  /**
   * On by default, and the portal hides the control for it (see SHOW_PROFANITY_SETTING in
   * packages/web/src/pages/Admin.tsx). The reasoning is that the person who most needs
   * this is the one who did not go looking for it — a client editing their own copy —
   * whereas whoever wants it off is already comfortable editing the code.
   */
  profanityFilter: true,
};

/**
 * The one place the site's content model and its SEO metadata live.
 *
 * Both the browser and the prerenderer import from here, which is the point: the
 * static HTML a crawler reads and the title a client-side navigation lands on are
 * produced by the same function, so they cannot drift.
 *
 * `SECTIONS` below is a bundled fallback. The API serves Firestore overrides merged
 * over it, so the site renders correctly before the API answers — and keeps rendering
 * if the API is asleep or gone. Edit these to change the shipped defaults.
 */

/**
 * The languages the site is built in. The first is the default and lives at the root; the
 * rest get a path prefix — /ja/about rather than /about?lang=ja.
 *
 * A path, not a query, because the pages are prerendered: static hosting serves one file
 * per path and ignores the query, so ?lang=ja would hand a Japanese visitor the English
 * HTML and then swap it after hydration — which loses the markup and the Largest
 * Contentful Paint candidate with it. A prefix gets its own prerendered file.
 */
export const LANGS = ['en', 'ja'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = LANGS[0];

/** Route labels, needed here because the prerenderer builds titles without the web app. */
const ROUTE_LABELS: Record<Lang, Record<string, string>> = {
  en: { about: 'About', contact: 'Contact', privacy: 'Privacy', admin: 'Admin' },
  ja: { about: '概要', contact: 'お問い合わせ', privacy: 'プライバシー', admin: '管理' },
};

const CONTACT_BLURB: Record<Lang, (author: string) => string> = {
  en: (author) => `Send a message to ${author}.`,
  ja: () => 'メッセージをお送りください。',
};

const PRIVACY_BLURB: Record<Lang, string> = {
  en: 'What this site stores, and what happens to a message sent through the form.',
  ja: '当サイトが保存する情報と、フォームから送信されたメッセージの取り扱いについて。',
};

/**
 * One slide of a `kind: 'carousel'` section: its own overlay caption, write-up, image and
 * translations, plus an id that doubles as its `/projects/:id` route — same shape as
 * `Section`'s own content fields, deliberately, so `localise()` works on either.
 */
export interface CarouselSlide {
  id: string;
  heading: string;
  body: string;
  /** Optional illustration. Cloudinary URLs get resized automatically; others pass through. */
  image?: string;
  translations?: Partial<Record<Lang, { heading?: string; body?: string }>>;
}

/** A block of editable content. One row in the admin portal, one section on a page. */
export interface Section {
  id: string;
  /**
   * Which page it belongs to. Add your own keys as you add pages.
   *
   * 'footer' is not a route — it is the site chrome, modelled as a page so the footer text
   * is editable through the same CRUD, admin UI and fallback machinery as everything else
   * rather than needing a parallel mechanism for one string.
   */
  page: 'home' | 'about' | 'footer';
  /**
   * Absent (equivalently 'text') is an ordinary heading/body block. 'carousel' turns this
   * one row into the whole auto-cycling, drag-swipeable project carousel — see `slides`
   * below. Modelling it as a section rather than a component wired into one page's JSX is
   * the point: it is then just as placeable and reorderable as any other content, via the
   * same admin portal, same `page` field and same `order`.
   */
  kind?: 'carousel';
  heading: string;
  body: string;
  /** Optional illustration. Cloudinary URLs get resized automatically; others pass through. */
  image?: string;
  /** Ascending. The admin portal writes this when you drag to reorder. */
  order?: number;
  /** Soft delete, so a removed section can be restored from the portal. */
  deleted?: boolean;
  /**
   * Per-language overrides, keyed by language code. Anything missing falls back to the
   * fields above, so a half-translated site shows the default language rather than a gap.
   */
  translations?: Partial<Record<Lang, { heading?: string; body?: string }>>;
  /**
   * Only meaningful when `kind === 'carousel'`; `heading`/`body`/`image` above are unused
   * then; heading serves only as this row's label in the admin list.
   */
  slides?: CarouselSlide[];
}

/**
 * Splits body copy on the mascot's name, so the renderer can make each mention pressable.
 *
 * Returned as alternating text: the caller puts a mention between every pair. Matching the
 * name in the text rather than marking it up in the content means it works for copy written
 * in the admin portal and for every translation, without anyone learning a syntax.
 *
 * The word boundaries are what keep the product name out of it. `TurboHamstarter` continues
 * with a word character, so `\b` does not match after `TurboHam` and the brand is left
 * alone — no lookahead needed, which is worth stating because the obvious first instinct is
 * to add one and then believe it is doing the work.
 *
 * Lives here rather than beside either component so React and Vue share one definition, and
 * so the rule can be tested without a browser.
 */
export function splitOnMascot(text: string): string[] {
  return text.split(/\bTurboHam\b/g);
}

/** The heading and body for one language, falling back to the item's own fields. Takes a
 *  Section or a CarouselSlide — anything with the same three fields. */
export function localise(
  item: { heading: string; body: string; translations?: Section['translations'] },
  lang: Lang,
): { heading: string; body: string } {
  const t = item.translations?.[lang];
  return { heading: t?.heading || item.heading, body: t?.body || item.body };
}

/** Every non-deleted slide across every non-deleted carousel section, wherever it lives. */
export function allSlides(sections: Section[] = SECTIONS): CarouselSlide[] {
  return sections.filter((s) => s.kind === 'carousel' && !s.deleted).flatMap((s) => s.slides ?? []);
}

/** The slide with this id, wherever its carousel section lives, or undefined. */
export function findSlide(id: string, sections: Section[] = SECTIONS): CarouselSlide | undefined {
  return allSlides(sections).find((slide) => slide.id === id);
}

/** Prefixes a path with the language, except for the default which lives at the root. */
export function langPath(path: string, lang: Lang): string {
  const clean = path === '/' ? '' : path;
  return lang === DEFAULT_LANG ? path : `/${lang}${clean}` || `/${lang}`;
}

export const SITE_TITLE = 'TurboHamstarter';
export const SITE_DESCRIPTION =
  'A TurboRepo starter for a prerendered React site with an admin portal, running entirely on free-tier services.';
export const SITE_AUTHOR = 'Your Name';

export const SECTIONS: Section[] = [
  {
    id: 'hero',
    page: 'home',
    heading: 'TurboHamstarter: the whole CI/CD chain, already stuffed in its cheeks.',
    body: 'A TurboRepo starter with a complete CI/CD chain already wired: lint, typecheck, unit and layout tests and a bundle budget, gating a prerendered deploy to GitHub Pages that refuses to publish if any of it fails. Firebase, Cloudinary, Render and UptimeRobot are plumbed in on their free tiers, so a TypeScript app is live in an afternoon. Like TurboHam, it turns up with everything already stuffed in its cheeks and runs on almost nothing.',
    order: 0,
    translations: {
      ja: {
        heading: 'TurboHamstarter：CI/CD チェーンは、まるごとほおぶくろの中。',
        body: 'CI/CDチェーンがあらかじめ組み込まれた Turborepo スターターキット。\nLint、型チェック、単体テスト・レイアウトテスト、バンドルサイズ制限のどれか1つでも落とせば、GitHub Pages へのプリレンダリングデプロイは自動で停止します。\nFirebase、Cloudinary、Render、UptimeRobot もすべて無料枠で連携済み。TypeScript アプリをたった半日で公開できます。\nTurboHam のように、必要なものはすべて「頬袋」に詰め込んで準備万端。ごくわずかなリソースで動き出します！',
      },
    },
  },
  {
    id: 'what-this-is',
    page: 'home',
    heading: 'What you are looking at',
    body: 'A TypeScript front end prerendered to static HTML, an Express API with a Firestore-backed admin portal, and a CI pipeline that refuses to deploy if anything fails. Every service it touches has a free tier. Plenty of running, none of it on a wheel.',
    order: 1,
    translations: {
      ja: {
        heading: 'これが何なのか',
        body: '静的HTMLにプリレンダリングされたTypeScriptのフロントエンド、Firestoreを使う管理画面付きのExpress API、そして何か失敗すればデプロイを拒否するCIパイプライン。利用するサービスはすべて無料枠があります。よく走りますが、回し車の上ではありません。',
      },
    },
  },
  {
    id: 'make-it-yours',
    page: 'home',
    heading: 'Make it yours',
    body: 'Replace this text, add sections from the admin portal, drop your own pages into packages/web/src/pages, and push. The deploy runs itself. Rearrange the bedding as often as you like — the tests will tell you if you have buried something load-bearing.',
    order: 2,
    translations: {
      ja: {
        heading: '自分のものにする',
        body: 'この文章を書き換え、管理画面からセクションを追加し、packages/web/src/pagesに自分のページを置いてpushするだけ。デプロイは自動で走ります。巣材は好きなだけ組み替えてください。大事なものを埋めてしまったら、テストが教えてくれます。',
      },
    },
  },
  {
    id: 'footer-text',
    page: 'footer',
    heading: 'Footer',
    body: '© Your Name. All rights reserved.',
    order: 0,
    translations: { ja: { body: '© Your Name. 無断転載を禁じます。' } },
  },
  {
    id: 'about-intro',
    page: 'about',
    heading: 'What the starter includes',
    body: 'Most starters hand you a folder and wish you luck. The interesting work — making the thing fast, keeping it accessible, wiring a deploy that can be trusted, finding somewhere free to run it — is left as an exercise, and it is the part that takes the weekend. This one arrives with all of it done and, like any self-respecting hamster, carries far more than looks structurally advisable.',
    order: 0,
    translations: {
      ja: {
        heading: 'このスターターに入っているもの',
        body: '多くのスターターはフォルダを渡して「あとは頑張って」で終わります。速くすること、アクセシビリティを保つこと、信頼できるデプロイを組むこと、無料で動かせる場所を見つけること — 週末が丸ごと消えるのはその部分です。このスターターはそこまで済ませた状態で届きます。ハムスターらしく、どう見ても入らない量を詰め込んで。',
      },
    },
  },
  {
    id: 'about-stack',
    page: 'about',
    heading: "What's in the cheeks",
    body: 'A Turborepo with three workspaces. The front end is TypeScript on Vite — React or Vue, depending which of the two starters you cloned — prerendered to a real HTML file per route so a visitor and a crawler both get content on the first response rather than an empty div. The API is Express with a Firestore-backed admin portal for editing every piece of copy on the site, including the footer. A shared package holds the content model both sides agree on, so a change to it breaks the build rather than the page.',
    order: 1,
    translations: {
      ja: {
        heading: '頬袋の中身',
        body: 'ワークスペース3つの Turborepo です。フロントエンドは Vite 上の TypeScript。クローンしたスターターに応じて React か Vue。ルートごとに実際の HTML ファイルへプリレンダリングするので、訪問者にもクローラーにも空の div ではなく中身が最初のレスポンスで届きます。API は Express で、サイト上のすべての文章 — フッターも含めて — を編集できる Firestore 連携の管理画面付き。共有パッケージが両者の合意するコンテンツモデルを持つため、変更するとページではなくビルドが壊れます。',
      },
    },
  },
  {
    id: 'about-pipeline',
    page: 'about',
    heading: 'A pipeline that will not let you ship a mess',
    body: 'Every push runs the linter, the typechecker, an API suite, a unit suite and a set of layout tests across four projects — three viewports plus one with real touch, because a desktop browser shrunk to a phone fires no touch events and will cheerfully pass a bug a thumb would find in seconds. Then axe sweeps every page in both themes, the gzipped bundle is checked against a budget with a ceiling on each lazy chunk so nothing sneaks in behind a route split, and the whole suite runs again against the built output at the base path the host will actually serve it from. The prerenderer adds gates of its own: that every route hydrates without the framework throwing the markup away, that each carries its own content, that none of them rewrite it after load, and that the first paint and the hydrated page agree — a heading that quietly changes size once the JavaScript lands throws no error at all and still costs you the layout shift. None of this is slow, either: the browser every check needs is cached across pushes rather than re-downloaded from scratch, and you can run the entire pipeline locally with one command before you push anything. Fail any of it and the deploy simply does not happen. The tests are the cage bars, and they are there for the same reason.',
    order: 2,
    translations: {
      ja: {
        heading: '雑なものを出させないパイプライン',
        body: 'push のたびに Lint、型チェック、API テスト、ユニットテスト、そして4つのプロジェクトでのレイアウトテストが走ります。ビューポート3つに加え、実際のタッチを備えたものが1つ。スマホサイズに縮めただけのデスクトップブラウザはタッチイベントを発火しないので、指なら数秒で見つけるバグを平気で通してしまうからです。さらに axe が全ページを両テーマで検査し、gzip 後のバンドルサイズを予算と照合し（遅延チャンクごとの上限つき）、ビルド結果に対して実際の base path で同じテスト一式をもう一度走らせます。プリレンダラーはさらに3つの検査を持ちます。各ルートがフレームワークにマークアップを捨てられずにハイドレートすること、それぞれが自分のコンテンツを持っていること、読み込み後にそれを書き換えないこと、そして初回描画とハイドレート後の表示が一致すること。JavaScript が読み込まれた途端に見出しのサイズが変わっても、エラーは何も出ないままレイアウトシフトだけが残るからです。ここも遅くはありません——各チェックに必要なブラウザは push のたびに再ダウンロードされず、キャッシュされます。パイプラインの時間はチェックそのものに使われます。どれか1つでも落ちればデプロイは実行されません。テストはケージの柵です。理由も同じです。',
      },
    },
  },
  {
    id: 'about-free',
    page: 'about',
    heading: 'Free tier, all the way down',
    body: 'GitHub Pages serves the site, Render runs the API, Firestore stores the content, Cloudinary handles and optimises the images, Resend delivers the contact form, and UptimeRobot pings the API often enough that a sleeping free instance is awake when someone actually arrives. None of it asks for a card. The running total is a hamster-appropriate zero.',
    order: 3,
    translations: {
      ja: {
        heading: '端から端まで無料枠',
        body: 'サイトの配信は GitHub Pages、API は Render、コンテンツの保存は Firestore、画像の処理と最適化は Cloudinary、お問い合わせフォームの送信は Resend。そして UptimeRobot が十分な頻度で API を叩くので、無料インスタンスが眠っていても人が来たときには起きています。どれもカード番号を要求しません。合計はハムスターにふさわしく0円です。',
      },
    },
  },
  {
    id: 'about-fast',
    page: 'about',
    heading: 'Fast on purpose, not by luck',
    body: 'The performance work is the part that is genuinely tedious to redo, so it is already here: content in the first response, fonts self-hosted and subset to the glyphs actually used, images requested at the size they are displayed, page transitions kept clear of the first paint so they never delay it, and a bundle budget that fails the build rather than letting a stray import creep in. A hamster covers something like nine kilometres a night. This is the same energy, aimed at a Lighthouse score: 99 on mobile, 100 on desktop, accessibility and SEO a flat 100 either way.',
    order: 4,
    translations: {
      ja: {
        heading: '偶然ではなく意図的に速い',
        body: 'パフォーマンス改善は、やり直すのが本当に面倒な部分です。だから最初から入っています。最初のレスポンスにコンテンツを含め、フォントはセルフホストして実際に使う文字だけに絞り、画像は表示サイズで要求し、ページ遷移は初回描画に触れないようにして遅延させず、バンドル予算は余計な import が紛れ込めばビルドを落とします。ハムスターは一晩で9キロほど走るそうです。同じ熱量を Lighthouse のスコアに向けました——モバイルで99、デスクトップで100。アクセシビリティと SEO はどちらも常に100です。',
      },
    },
  },
  {
    id: 'about-included',
    page: 'about',
    heading: 'Things you would otherwise build twice',
    body: "Two languages on real paths with their own prerendered pages and hreflang, rather than a query string a crawler will ignore. A dark mode that persists. A project carousel that is a real, reorderable section with its own slide editor in the portal, not a page wired in by hand — it drags, slides and fades between projects without an animation library, because it has to survive being the first thing a prerendered page paints. An admin portal with image upload, a filter to jump straight to a page's sections, and an optional profanity filter on the way in. A contact form with a honeypot and server-side validation. Sitemap and robots generated at build. Cookie-less visitor analytics, opt-in and compiled away entirely until you hand it a token, so a fork that never asked for it never ships a byte of it. Every one of these is a small job, and all of them together are a fortnight.",
    order: 5,
    translations: {
      ja: {
        heading: '普通なら二度作るもの',
        body: 'クエリ文字列ではなく実際のパスで動く2言語対応。それぞれ専用のプリレンダリング済みページと hreflang を持つので、クローラーに無視されません。状態が保持されるダークモード。プロジェクトカルーセルは手作業で組み込んだページではなく、管理画面に専用のスライド編集機能を持つ本物の並べ替え可能なセクションです――アニメーションライブラリを使わずにドラッグ・スライド・フェードで切り替わります。プリレンダリングされたページが最初に描画するものになっても壊れないようにするためです。画像アップロード、ページのセクションへすぐ絞り込めるフィルター、任意の不適切語フィルターを備えた管理画面。ハニーポットとサーバー側検証つきのお問い合わせフォーム。ビルド時に生成されるサイトマップと robots。クッキー不要の来訪者分析はオプトインで、トークンを渡すまではビルドから完全に消え去ります――使わないフォークには1バイトも含まれません。ひとつひとつは小さな作業ですが、全部合わせると2週間です。',
      },
    },
  },
  {
    id: 'about-why',
    page: 'about',
    heading: 'Why bother with any of this',
    body: 'Because the gap between a site that works on your machine and one you are willing to put your name on is mostly unglamorous infrastructure, and doing it again for every project is how projects stop getting started. Clone this, replace the copy, push, and the boring half is behind you. Then go and hoard something of your own.',
    order: 6,
    translations: {
      ja: {
        heading: 'なぜここまでやるのか',
        body: '自分の環境で動くサイトと、自分の名前を出せるサイトとの差は、その大半が地味なインフラ作業だからです。そしてプロジェクトごとにそれをやり直すことこそが、プロジェクトが始まらなくなる原因です。クローンして、文章を差し替えて、push する。退屈な半分はそれで終わりです。あとは自分の巣に好きなものを溜め込んでください。',
      },
    },
  },
  /**
   * The home carousel, kind: 'carousel'. One row, one admin card, three placeholder
   * slides — fictional hamster-lore case studies rather than lorem ipsum, so a fresh clone
   * looks like a real portfolio mid-edit rather than an obviously unfinished template.
   * `order: -1` sorts it above `hero`; move it from the admin portal like any other
   * section. Replace the slides with your own, or delete them — see README.
   */
  {
    id: 'home-carousel',
    page: 'home',
    kind: 'carousel',
    heading: 'Projects carousel',
    body: '',
    order: -1,
    slides: [
      {
        id: 'project-bedding-uprising',
        heading: 'The Great Bedding Uprising',
        body: "Q3 initiative to renegotiate cage terms after the sole stakeholder judged the aspen shavings unfit for tunnel work. Scope crept from a bedding audit to a three-day strike on the wheel — which backfired once it turned out the wheel's squeak was the only white noise anyone in the house had learned to sleep through. Resolved with a new vendor, a bigger hideout, and a peace treaty nobody else knew had been a war.",
        translations: {
          ja: {
            heading: '寝床大蜂起',
            body: '既存の床材がトンネル作業に不適格と判断した唯一の利害関係者により、ケージの条件を再交渉する第3四半期の取り組み。床材監査のはずが、回し車での三日間のストライキへと拡大。だがその車輪のきしみこそ、家族全員がいつしか子守唄にしていた夜の唯一の物音だったと判明し、逆効果に終わる。新しい床材、より広い隠れ家、そして誰も開戦に気づいていなかった和平条約で解決した。',
          },
        },
      },
      {
        id: 'project-wheel-prophecy',
        heading: 'The Prophecy of the Ever-Turning Wheel',
        body: 'An ancient text, found behind the hideout during a cage clean, foretells a wheel that never squeaks, never needs oil, and never stops turning even unwatched. Prototypes still squeak, if a little quieter each generation. Roadmap: a ball-bearing hub, a nightly-distance readout, and a rumoured final form so silent its existence can only be confirmed by the shrinking pile of sunflower seeds. Skeptics note the prophecy was written by its biggest beneficiary.',
        translations: {
          ja: {
            heading: '回り続ける車輪の預言',
            body: 'ケージ清掃中、隠れ家の裏から発見された古文書。きしまず、油もいらず、誰も見ていなくても回り続ける車輪を予言する。試作品は今もきしむが、世代を追うごとに少しずつ静かになっている。ロードマップにはボールベアリングハブ、毎晩の走行距離表示、そして完璧な静寂に達しひまわりの種の減り具合でしか存在を確認できなくなるという噂の最終形態。懐疑派は、この預言を書いたのが一番得をする本人だと指摘する。',
          },
        },
      },
      {
        id: 'project-cheek-pouch-ledger',
        heading: 'The Cheek-Pouch Ledger Audit',
        body: "A reconciliation of declared versus actual sunflower seed reserves, prompted by a gap between the quarterly estimate and what turned up at bedding-change time. Findings: nothing missing, just spread across four undisclosed sub-hoards — one in the hideout, one technically inside another hamster's hoard, and one a single seed counted with tremendous confidence. Recommended: one source of truth for hoard location, and the acknowledgement that an audit run by the auditee's own cheeks was never going anywhere else.",
        translations: {
          ja: {
            heading: '頬袋台帳監査',
            body: '四半期の見積もりと床材交換時の実測に食い違いが生じ、申告済みひまわりの種備蓄の全面照合を実施。判明したのは、紛失ではなく非公開の4つの副蓄えへの分散――1つは隠れ家の中、1つは厳密には別のハムスターの蓄えの中、そしてもう1つは驚くほどの自信を持って数えられていた種一粒。推奨事項は蓄え場所の一元管理、そして被監査者自身の頬袋が行う監査がそれ以外の結末を迎えるはずがなかったという受け入れ。',
          },
        },
      },
    ],
  },
];

/** Live sections for a page, deleted ones removed, in display order. */
export function sectionsForPage(page: Section['page'], sections: Section[] = SECTIONS): Section[] {
  return sections
    .filter((s) => s.page === page && !s.deleted)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** First ~155 characters of the text, roughly what a search result displays. */
export function describe(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length <= 155 ? clean : `${clean.slice(0, 152).trimEnd()}…`;
}

/**
 * `path` is the app-relative pathname, e.g. `/about`. Trailing slashes are ignored
 * because that is the form the prerenderer writes.
 */
export function metaForRoute(
  path: string,
  sections: Section[] = SECTIONS,
  lang: Lang = DEFAULT_LANG,
): { title: string; description: string } {
  // Strip any language prefix first, so /ja/about and /about resolve to the same route.
  const withoutLang = path.replace(new RegExp(`^/(${LANGS.join('|')})(?=/|$)`), '') || '/';
  const clean = withoutLang.replace(/\/+$/, '') || '/';
  const label = ROUTE_LABELS[lang];
  // Skips carousel-kind sections: they have no meaningful body of their own (see the note
  // on Section.slides), so the first *text* section is what should describe the page.
  const first = (page: Section['page']) => {
    const s0 = sectionsForPage(page, sections).find((s) => s.kind !== 'carousel');
    return s0 ? describe(localise(s0, lang).body, SITE_DESCRIPTION) : SITE_DESCRIPTION;
  };

  if (clean === '/') return { title: SITE_TITLE, description: first('home') };
  if (clean === '/about')
    return { title: `${label.about} | ${SITE_TITLE}`, description: first('about') };
  if (clean === '/contact') {
    return {
      title: `${label.contact} | ${SITE_TITLE}`,
      description: CONTACT_BLURB[lang](SITE_AUTHOR),
    };
  }
  if (clean === '/privacy') {
    return { title: `${label.privacy} | ${SITE_TITLE}`, description: PRIVACY_BLURB[lang] };
  }
  // Deliberately no description: the admin portal is noindex and should not be presented
  // as a landing page in search results.
  if (clean === '/admin') return { title: `${label.admin} | ${SITE_TITLE}`, description: '' };

  const projectId = clean.match(/^\/projects\/([^/]+)$/)?.[1];
  if (projectId) {
    const slide = findSlide(projectId, sections);
    if (slide) {
      const loc = localise(slide, lang);
      return {
        title: `${loc.heading} | ${SITE_TITLE}`,
        description: describe(loc.body, SITE_DESCRIPTION),
      };
    }
    // A slide deleted, or not yet reached by a rebuild — same fallback as any other
    // unknown route, rather than a broken title for a page NotFound is about to render.
  }

  return { title: SITE_TITLE, description: SITE_DESCRIPTION };
}

/**
 * Routes the prerenderer writes static HTML for. Add a page here and it gets indexed.
 *
 * The project detail routes are derived from the bundled carousel's slides rather than
 * listed by hand, so a slide added in `SECTIONS` above is prerendered without a second
 * place to remember it. One consequence: a slide added *from the admin portal* has no
 * bundled counterpart, so it has no route here either — it renders fine for a visitor (the
 * client fetches it like any other content) but is not in the static HTML or the sitemap
 * until the next full rebuild, same as any other admin edit.
 */
export const ROUTES: readonly string[] = [
  '/',
  '/about',
  '/contact',
  '/privacy',
  ...allSlides().map((slide) => `/projects/${slide.id}`),
];
