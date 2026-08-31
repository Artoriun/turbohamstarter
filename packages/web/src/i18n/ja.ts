import type { Dictionary } from './en';

/**
 * A second locale, included so the switcher has something to switch to and so the
 * type-checking is doing visible work. Delete it, rename it, or copy it — the annotation
 * below is what makes a missing key a build error rather than a blank string in
 * production.
 *
 * The file is `ja`, not `jp`: ISO 639-1 language codes are what `<html lang>`, hreflang and
 * every search engine expect, and `jp` is the *country* code. Naming it `jp` still works
 * as an object key but quietly makes the language metadata wrong.
 */
export const ja: Dictionary = {
  label: '日本語',
  nav: {
    home: 'ホーム',
    about: '概要',
    contact: 'お問い合わせ',
    admin: '管理',
    skipToContent: 'コンテンツへスキップ',
    menu: 'メニュー',
  },
  home: {
    eyebrow: 'イントロ',
    ctaContact: 'お問い合わせ',
    ctaAbout: 'スターターの内容を見る',
    mascotHint: 'マスコットの TurboHam',
    mascotShow: 'マスコットの TurboHam を表示',
  },
  carousel: {
    label: 'プロジェクト',
    viewProject: 'プロジェクトを見る',
    prev: '前のプロジェクト',
    next: '次のプロジェクト',
    pause: 'スライドショーを一時停止',
    play: 'スライドショーを再生',
    goTo: 'プロジェクトへ移動',
    loading: '読み込み中…',
  },
  contact: {
    title: 'お問い合わせ',
    intro: 'メッセージをお送りください。TurboHam が折り返しご連絡します。',
    name: 'お名前',
    email: 'メールアドレス',
    subject: '件名',
    message: 'メッセージ',
    send: '送信する',
    sending: '送信中…',
    success: 'メッセージをありがとうございます。TurboHam ができるだけ早くご返信します。',
    errorGeneric: '問題が発生しました。もう一度お試しください。',
    errorUnavailable:
      '現在お問い合わせフォームをご利用いただけません。しばらくしてからお試しください。',
    required: 'すべての項目を入力してください。',
    invalidEmail: '有効なメールアドレスを入力してください。',
  },
  privacy: {
    title: 'プライバシー',
    body: '当サイトはクッキーを使用しません。アクセス解析を設定している場合はCloudflare Web Analyticsを使用します。これはクッキーを使用せず、個人情報も収集しません。ページでエラーが発生した場合、エラーメッセージ、スタックトレース、URLが診断のため当サイトに送信されます。お問い合わせフォームから送信されたメッセージはメールで配信され、当サイトには保存されません。メールアドレスはご返信のためにのみ使用します。',
  },
  notFound: {
    title: 'ページが見つかりません',
    body: 'そのページは存在しません。',
    back: 'ホームに戻る',
  },
  error: {
    title: '問題が発生しました',
    body: 'ページを読み込めませんでした。再読み込みすると解決する場合があります。',
    reload: '再読み込み',
    home: 'ホームに戻る',
  },
  theme: {
    toDark: 'ダークモードに切り替える',
    toLight: 'ライトモードに切り替える',
  },
  language: {
    label: '言語',
  },
  admin: {
    title: '管理',
    password: 'パスワード',
    signIn: 'ログイン',
    signOut: 'ログアウト',
    wrongPassword: 'パスワードが正しくありません。',
    lockedOut: 'パスワードの誤りが多すぎます。{time} 後にもう一度お試しください。',
    tooManyAttempts: '試行回数が多すぎます。しばらくしてからもう一度お試しください。',
    sessionExpired: 'セッションの有効期限が切れました。もう一度サインインしてください。',
    unavailable: '管理APIに接続できません。',
    loading: '読み込み中…',
    sections: 'セクション',
    addSection: 'セクションを追加',
    addCarousel: 'カルーセルを追加',
    page: 'ページ',
    filterAll: 'すべて',
    heading: '見出し',
    body: '本文',
    image: '画像',
    upload: '画像をアップロード',
    uploading: 'アップロード中…',
    save: '保存',
    saving: '保存中…',
    saved: '保存しました',
    delete: '削除',
    confirmDelete: 'このセクションを削除しますか？',
    slides: 'スライド',
    addSlide: 'スライドを追加',
    deleteSlide: 'スライドを削除',
    confirmDeleteSlide: 'このスライドを削除しますか？',
    cancel: 'キャンセル',
    moveUp: '上へ移動',
    moveDown: '下へ移動',
    filterTitle: '不適切語フィルター',
    filterHint:
      'ブロック対象の語を含む内容の保存を拒否します。この画面だけでなくAPI側でも適用されます。',
    filterOn: 'オン',
    filterOff: 'オフ',
    blocklist: 'ブロックする語',
    blocklistHint: 'カンマ区切り。空欄の場合は既定のリストを使用します。',
    blockedWarning: 'ブロック対象の語が含まれています:',
    blockedSave: '保存されませんでした。ブロックされた語:',
    saveFailed: '保存できませんでした。APIが起動しているか確認してください。',
  },
  footer: {
    rights: '無断転載を禁じます。',
    privacy: 'プライバシー',
  },
};
