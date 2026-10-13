import { characterThemes, type CharacterTheme } from './characterTheme';

export const themeTagLimit = 8;
export const themeTagMaxLength = 20;
// 候補は入力の手助けで、選べる語彙を縛るものではない。
export const suggestedThemeTags: readonly string[] = ['初音ミク', '和風', '北欧', '韓国風', 'ボタニカル', 'モノトーン', 'ホテルライク', 'レトロ'];

const tagLine = /(?:^|\n)テーマ: (.+)$/u;

export function normalizeThemeTag(value: string): string {
  return value.replace(/[\s、,]+/gu, ' ').trim().replace(/^[#＃]+\s*/u, '').slice(0, themeTagMaxLength).trim();
}

export function addThemeTag(tags: readonly string[], value: string): readonly string[] {
  const tag = normalizeThemeTag(value);
  return !tag || tags.includes(tag) || tags.length >= themeTagLimit ? tags : [...tags, tag];
}

/** カタログにある名前のタグは、色やモチーフを持つキャラクターテーマとしても扱う。 */
export function characterThemeForTags(tags: readonly string[]): CharacterTheme | undefined {
  return characterThemes.find(theme => tags.includes(theme.name));
}

/** キャラクターテーマは character_theme_id で送るので、文章に足すのは自由入力のタグだけにする。 */
export function requestWithThemeTags(text: string, tags: readonly string[]): string {
  const body = text.trim();
  if (!tags.length) return body;
  if (!body) return `${tags.join('、')}をイメージした部屋にしたい。`;
  const themeName = characterThemeForTags(tags)?.name;
  const free = tags.filter(tag => tag !== themeName);
  return free.length ? `${body}\nテーマ: ${free.join('、')}` : body;
}

export function splitThemeTags(request: string): { text: string; tags: readonly string[] } {
  const match = tagLine.exec(request);
  if (!match) return { text: request, tags: [] };
  return { text: request.slice(0, match.index), tags: match[1].split('、').reduce<readonly string[]>(addThemeTag, []) };
}
