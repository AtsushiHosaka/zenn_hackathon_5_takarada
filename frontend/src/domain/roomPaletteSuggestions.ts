import { characterThemes } from "./characterTheme";
import { roomColor, roomPalette, roomPalettes, type RoomPalette } from "./roomPalette";

export const roomPaletteSuggestionCount = 4;

type Preference = {
  terms: readonly string[];
  palettes: readonly string[];
  weight: number;
  color?: boolean;
  genericBlue?: boolean;
};

const lightBlueTerms = ["light blue", "pale blue", "sky blue", "水色", "ライトブルー", "ペールブルー", "パステルブルー", "スカイブルー"];
const darkBlueTerms = ["navy", "dark blue", "ネイビー", "紺", "濃い青", "ダークブルー"];

// Explicit colors carry more weight than atmosphere. Ranked examples also keep
// suggestions useful when a description mentions more than one preference.
const preferences: readonly Preference[] = [
  { terms: ["white", "白", "ホワイト"], palettes: ["snow-graphite", "porcelain", "monochrome-gallery", "botanical-white", "sky-white", "warm-ivory"], weight: 12, color: true },
  { terms: ["gray", "grey", "グレー", "グレイ", "灰色", "monochrome", "モノトーン"], palettes: ["stone-gray", "silver-line", "mist-smoke", "snow-graphite", "monochrome-gallery", "charcoal-silver"], weight: 12, color: true },
  { terms: ["beige", "ivory", "ベージュ", "アイボリー", "cream", "クリーム"], palettes: ["warm-ivory", "oatmeal", "mushroom-taupe", "linen-ink", "desert-sand", "coffee-cream"], weight: 12, color: true },
  { terms: ["brown", "茶色", "ブラウン"], palettes: ["coffee-cream", "espresso-copper", "desert-sand", "oatmeal", "mushroom-taupe", "denim-wood"], weight: 12, color: true },
  { terms: ["green", "緑", "グリーン", "sage", "セージ", "olive", "オリーブ"], palettes: ["sage-clay", "celadon", "olive-linen", "moss-oak", "botanical-white", "forest-night", "mint-cloud", "seafoam"], weight: 12, color: true },
  { terms: ["cyan", "シアン", "teal", "turquoise", "ターコイズ", "ティール", "mint", "ミント"], palettes: ["seafoam", "mint-cloud", "teal-studio", "turquoise-pop", "lagoon-dusk", "mint-strawberry"], weight: 12, color: true },
  { terms: lightBlueTerms, palettes: ["sky-white", "powder-blue", "mint-cloud", "seafoam"], weight: 13, color: true },
  { terms: ["blue", "青", "ブルー"], palettes: ["sky-white", "powder-blue", "coastal-blue", "denim-wood", "cobalt-gallery"], weight: 12, color: true, genericBlue: true },
  { terms: darkBlueTerms, palettes: ["midnight-brass", "ice-navy", "denim-wood"], weight: 13, color: true },
  { terms: ["purple", "lavender", "lilac", "紫", "パープル", "ラベンダー"], palettes: ["lavender-milk", "lilac-garden", "mauve-taupe", "amethyst", "orchid-gold", "violet-pop", "plum-velvet"], weight: 12, color: true },
  { terms: ["pink", "rose", "ピンク", "桃色"], palettes: ["blush-linen", "rose-quartz", "dusty-rose", "peach-pink", "cherry-blossom", "fuchsia-pop", "mint-strawberry"], weight: 12, color: true },
  { terms: ["red", "赤", "レッド", "burgundy", "ボルドー"], palettes: ["brick-cream", "scarlet-pop", "burgundy-lounge", "primary-play"], weight: 12, color: true },
  { terms: ["orange", "オレンジ", "橙", "terracotta", "テラコッタ"], palettes: ["apricot", "tangerine-studio", "terracotta-fern", "tropical-pop"], weight: 12, color: true },
  { terms: ["yellow", "黄色", "イエロー"], palettes: ["butter-yellow", "sunflower", "lavender-lemon", "orchid-gold"], weight: 12, color: true },
  { terms: ["black", "黒", "ブラック"], palettes: ["charcoal-silver", "monochrome-gallery", "midnight-brass", "linen-ink"], weight: 12, color: true },
  { terms: ["natural", "nature", "botanical", "wood", "ナチュラル", "自然", "木", "植物", "北欧", "scandinavian", "japandi", "和風"], palettes: ["sage-clay", "warm-ivory", "olive-linen", "oatmeal", "moss-oak", "celadon", "linen-ink"], weight: 5 },
  { terms: ["warm", "cozy", "cosy", "cafe", "café", "暖か", "温か", "あたたか", "ぬくもり", "温もり", "カフェ", "居心地"], palettes: ["warm-ivory", "coffee-cream", "oatmeal", "apricot", "mushroom-taupe", "sage-clay"], weight: 5 },
  { terms: ["calm", "relax", "relaxing", "peaceful", "quiet", "落ち着", "くつろ", "リラックス", "穏やか", "静か", "安ら", "癒し"], palettes: ["celadon", "mushroom-taupe", "powder-blue", "sage-clay", "seafoam", "lavender-milk"], weight: 5 },
  { terms: ["bright", "airy", "light", "爽やか", "さわやか", "明る", "開放", "軽やか", "清潔"], palettes: ["sky-white", "mint-cloud", "porcelain", "butter-yellow", "snow-graphite", "warm-ivory"], weight: 5 },
  { terms: ["modern", "minimal", "minimalist", "simple", "モダン", "ミニマル", "シンプル", "洗練", "スタイリッシュ"], palettes: ["monochrome-gallery", "linen-ink", "silver-line", "stone-gray", "ice-navy", "mushroom-taupe"], weight: 5 },
  { terms: ["dark", "moody", "luxury", "luxurious", "elegant", "hotel", "暗い", "ダーク", "重厚", "シック", "高級", "ホテル", "大人", "上品"], palettes: ["midnight-brass", "espresso-copper", "forest-night", "plum-velvet", "charcoal-silver", "burgundy-lounge"], weight: 5 },
  { terms: ["cute", "soft", "pastel", "romantic", "かわいい", "可愛い", "柔らか", "やわらか", "パステル", "ロマンチック"], palettes: ["blush-linen", "lavender-milk", "candy-pastel", "mint-strawberry", "peach-pink", "powder-blue"], weight: 5 },
  { terms: ["colorful", "colourful", "playful", "vibrant", "pop", "カラフル", "ポップ", "鮮やか", "元気", "楽しい", "個性的"], palettes: ["tropical-pop", "primary-play", "festival", "turquoise-pop", "cobalt-gallery", "sunflower", "violet-pop"], weight: 5 },
  { terms: ["coastal", "ocean", "beach", "sea", "海", "ビーチ", "リゾート", "涼し", "cool"], palettes: ["coastal-blue", "seafoam", "sky-white", "lagoon-dusk", "ice-navy", "mint-cloud"], weight: 5 },
  { terms: ["vintage", "retro", "industrial", "ヴィンテージ", "ビンテージ", "レトロ", "インダストリアル"], palettes: ["coffee-cream", "denim-wood", "brick-cream", "espresso-copper", "olive-linen", "stone-gray"], weight: 5 },
];

const fallbackIds = ["warm-ivory", "snow-graphite", "sage-clay", "sky-white"];

// Use the existing selectable colors so the suggested swatch and API palette agree.
const themePaletteIds: Readonly<Record<string, readonly string[]>> = {
  "hatsune-miku": ["sky-white", "mint-cloud", "snow-graphite", "charcoal-silver"],
  sanrio: ["blush-linen", "sky-white", "lavender-milk", "snow-graphite"],
  "hello-kitty": ["brick-cream", "snow-graphite", "blush-linen", "warm-ivory"],
  "my-melody": ["blush-linen", "snow-graphite", "lavender-milk", "warm-ivory"],
  kuromi: ["lavender-milk", "charcoal-silver", "snow-graphite", "blush-linen"],
  cinnamoroll: ["sky-white", "snow-graphite", "mint-cloud", "lavender-milk"],
  pompompurin: ["butter-yellow", "coffee-cream", "warm-ivory", "snow-graphite"],
  pochacco: ["sage-clay", "snow-graphite", "charcoal-silver", "mint-cloud"],
};

function termOccurrences(description: string, term: string): number[] {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Latin word boundaries prevent e.g. "red" matching "hundred". Japanese
  // expressions intentionally match stems such as 落ち着いた and 明るく.
  const pattern = /^[a-z]/.test(term) ? `\\b${escaped}\\b` : escaped;
  return [...description.matchAll(new RegExp(pattern, "gu"))].map(match => match.index);
}

function isNegated(description: string, index: number, termLength: number): boolean {
  const before = description.slice(Math.max(0, index - 28), index);
  const after = description.slice(index + termLength, index + termLength + 18);
  return /\b(?:no|not|without|avoid|exclude|don't like|do not like)\s+(?:(?:very|too|dark|light)\s+)?$/.test(before)
    || /^\s+(?:isn't|is not|is unwanted)\b/.test(after)
    || /^(?:(?:系|色|っぽい|な|い)?(?:は|を|が|の)?)(?:ではなく|じゃなく|くない|以外|なし|抜き|不要|いらない|避け|使わ|使いたくない|好きじゃない|好きではない)/.test(after);
}

export function hasExplicitRoomColorPreference(atmosphere: string): boolean {
  const description = atmosphere.normalize("NFKC").toLowerCase();
  return preferences.some(preference => preference.color && preference.terms.some(term =>
    termOccurrences(description, term).length > 0));
}

/** A local keyword shortlist, not an AI-generated interpretation of prose. */
export function suggestRoomPalettes(atmosphere: string, preferredId?: string, characterThemeId?: string): readonly RoomPalette[] {
  const description = atmosphere.normalize("NFKC").toLowerCase().trim();
  const inferredThemeId = /(?:初音\s*ミク|\bhatsune\s*miku\b|\bmiku\b)/u.test(description)
    ? "hatsune-miku"
    : characterThemes.find(theme => description.includes(theme.name.normalize("NFKC").toLowerCase()))?.id;
  const themeIds = themePaletteIds[characterThemeId ?? inferredThemeId ?? ""] ?? [];
  if (!description && !themeIds.length && !roomPalette(preferredId)) return [];

  const scores = new Map<string, number>();
  const excluded = new Set<string>();
  let hasPositivePreference = false;
  let hasColorPreference = false;
  const specificBlueRanges = [...lightBlueTerms, ...darkBlueTerms].flatMap(term => termOccurrences(description, term).map(index => [index, index + term.length]));
  for (const preference of preferences) {
    let positive = false;
    let negative = false;
    for (const term of preference.terms) {
      for (const index of termOccurrences(description, term)) {
        if (preference.genericBlue && specificBlueRanges.some(([start, end]) => index >= start && index + term.length <= end)) continue;
        if (isNegated(description, index, term.length)) negative = true;
        else positive = true;
      }
    }
    if (negative && !positive && preference.color) {
      preference.palettes.forEach(id => excluded.add(id));
    }
    if (positive) {
      hasPositivePreference = true;
      hasColorPreference ||= preference.color === true;
      preference.palettes.forEach((id, rank) => {
        scores.set(id, (scores.get(id) ?? 0) + preference.weight - rank * 0.35);
      });
    }
  }

  // A character provides color direction even when the brief only names them.
  // Explicit color instructions keep precedence over that automatic direction.
  if (!hasColorPreference && themeIds.length) {
    hasPositivePreference = true;
    themeIds.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 18 - rank));
  }

  const selected: RoomPalette[] = [];
  const families = new Map<string, number>();
  // 提案するのは単色に割り当てた配色と、保存済みの部屋が使っている配色だけ。
  const candidates = roomPalettes.filter(palette => (roomColor(palette.id) || palette.id === preferredId) && (!excluded.has(palette.id) || palette.id === preferredId));
  while (selected.length < roomPaletteSuggestionCount && candidates.length) {
    const score = (palette: RoomPalette) => {
      const fallbackRank = fallbackIds.indexOf(palette.id);
      const fallback = !hasPositivePreference && palette.id === preferredId
        ? 1
        : fallbackRank < 0 ? 0 : 0.8 - fallbackRank * 0.1;
      const familyPenalty = hasColorPreference ? 0.15 : 0.6;
      return (scores.get(palette.id) ?? fallback) - (families.get(palette.family) ?? 0) * familyPenalty;
    };
    // Stable catalogue order breaks ties, so identical descriptions always
    // produce identical choices. Mild family penalties add useful variation.
    candidates.sort((a, b) => score(b) - score(a));
    const palette = candidates.shift()!;
    selected.push(palette);
    families.set(palette.family, (families.get(palette.family) ?? 0) + 1);
  }
  const preferred = roomPalette(preferredId);
  return preferred && !selected.some(palette => palette.id === preferred.id)
    ? [preferred, ...selected.slice(0, roomPaletteSuggestionCount - 1)]
    : selected;
}

export function suggestedRoomPaletteId(atmosphere: string, selectedId?: string, characterThemeId?: string): string | undefined {
  return roomPalette(selectedId)?.id ?? suggestRoomPalettes(atmosphere, undefined, characterThemeId)[0]?.id;
}
