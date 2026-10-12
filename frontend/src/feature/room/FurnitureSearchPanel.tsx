import { useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRepositories } from '../../core/repositories';
import { furnitureCategories, type RoomDesign, type RoomItem } from '../../domain/room';
import type { FurnitureDetailChoice, FurnitureSearchInterpretation, FurnitureSearchProduct, SearchModel } from '../../domain/roomRepository';
import ErrorText from '../shared/ErrorText';
import ModelCredits from './ModelCredits';
import { furniturePositionInRoom } from './roomBounds';
import { productReplacementPosition } from './productReplacement';

const colors = [['white','ホワイト・アイボリー'],['black','ブラック'],['gray','グレー'],['brown','ブラウン'],['beige','ベージュ・ナチュラル'],['green','グリーン'],['blue','ブルー'],['purple','パープル'],['pink','ピンク'],['red','レッド'],['orange','オレンジ'],['yellow','イエロー']] as const;
function ProductPhoto({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? <img className={className} src={src} alt={name} loading="lazy" onError={() => setFailed(true)} /> : <span className="rc-planner-note">商品写真なし</span>;
}

const categories = ['ソファ','ベッド','デスク','椅子','収納棚','テーブル'];

export default function FurnitureSearchPanel({ design, disabled, onAddItem, replacementTarget }: { design: RoomDesign; disabled: boolean; onAddItem: (item: RoomItem) => void; replacementTarget?: RoomItem }) {
  const { rooms } = useRepositories();
  const formId = useId();
  const aliases: Record<string, string> = { lamp: 'floor_lamp', artwork: 'wall_art', cover: 'bed_cover' };
  const targetCategory = replacementTarget ? aliases[replacementTarget.category] ?? replacementTarget.category : '';
  const [query, setQuery] = useState(replacementTarget ? replacementTarget.name : '');
  const [color, setColor] = useState('');
  const [category, setCategory] = useState(targetCategory);
  const [selectedId, setSelectedId] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const search = useMutation({ mutationFn: (input: { query: string; color?: string; category?: string }) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    return rooms.searchFurniture(input, controller.signal);
  } });
  const currentResults = search.variables?.query === query.trim() && search.variables?.color === (color || undefined) && search.variables?.category === (category || undefined);
  const selected = search.data?.products.find(product => product.item.furnitureDetailId === selectedId);
  return <div className="rc-furniture-search">
    <form className="rc-furniture-link-form" onSubmit={event => { event.preventDefault(); setSelectedId(undefined); if (!disabled && query.trim()) search.mutate({ query: query.trim(), color: color || undefined, category: category || undefined }); }}>
      <label htmlFor={`${formId}-query`}>家具を検索</label>
      <input id={`${formId}-query`} value={query} onChange={event => setQuery(event.target.value)} maxLength={200} placeholder="例：丸いサイドテーブル" required disabled={disabled || search.isPending}/>
      <label htmlFor={`${formId}-color`}>商品の色で絞り込む</label>
      <select id={`${formId}-color`} value={color} onChange={event => setColor(event.target.value)} disabled={disabled || search.isPending}><option value="">すべての色</option>{colors.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor={`${formId}-category`}>家具の種類</label>
      <select id={`${formId}-category`} value={category} onChange={event => setCategory(event.target.value)} disabled={disabled || search.isPending || Boolean(replacementTarget)}>{replacementTarget && !furnitureCategories.some(value => value === targetCategory) && <option value={targetCategory}>{replacementTarget.name}と同じカテゴリ</option>}<option value="">すべての種類</option>{furnitureCategories.map((value,index) => <option key={value} value={value}>{categories[index]}</option>)}</select>
      <button type="submit" disabled={disabled || search.isPending || !query.trim()}>{search.isPending ? '検索中…' : 'この条件で検索'}</button>
    </form>
    {search.isError && <ErrorText error={search.error}/>}
    {search.data && currentResults && !search.isPending && <>
      <SearchInterpretation interpretation={search.data.interpretation}/>
      {!!search.data.models.length && <SearchModels models={search.data.models} interpretation={search.data.interpretation}/>}
      <p role="status" className="rc-planner-note">{search.data.products.length ? `${search.data.products.length}件の商品` : search.data.models.length ? 'この条件で購入できる商品はまだ登録されていません。' : 'この条件の商品は見つかりませんでした。検索語や色を変えてお試しください。'}</p>
      <div className="rc-furniture-search-results">{search.data.products.map(({ item, colorName, variants, characters }) => <button key={item.furnitureDetailId} type="button" className="rc-furniture-search-card" aria-pressed={selectedId === item.furnitureDetailId} disabled={disabled} onClick={() => setSelectedId(item.furnitureDetailId)}>
        <ProductPhoto key={item.imageUrl} src={item.imageUrl} name={item.name}/><span>{item.name}</span><CharacterChips ids={characters} interpretation={search.data!.interpretation}/><span>{colorName ?? '色の掲載なし'} · ¥{item.price?.toLocaleString('ja-JP')}{variants.length > 1 ? ` · 他${variants.length - 1}件` : ''}</span>
      </button>)}</div>
      {selected && <FurnitureSearchSelection key={selected.item.furnitureDetailId} product={selected} design={design} disabled={disabled} onAddItem={onAddItem} replacementTarget={replacementTarget}/>}
    </>}
  </div>;
}

function characterNames(ids: string[], interpretation: FurnitureSearchInterpretation): string[] {
  return ids.flatMap(id => interpretation.characters.find(character => character.id === id)?.name ?? []);
}

// 自然言語の検索語をどう解釈したかを示す。家具検索(source=none)では何も出さない。
function SearchInterpretation({ interpretation }: { interpretation: FurnitureSearchInterpretation }) {
  const characterFranchises = new Set(interpretation.characters.map(character => character.franchise));
  const labels = [...interpretation.characters.map(character => character.name), ...interpretation.franchises.filter(franchise => !characterFranchises.has(franchise.id)).map(franchise => franchise.name), ...interpretation.categories.map(category => category.name)];
  if (interpretation.source === 'none' || !labels.length) return null;
  return <div className="rc-search-interpretation">
    <span className="rc-planner-note">{interpretation.source === 'llm' ? 'AIが読み取った条件' : '読み取った条件'}</span>
    <ul className="rc-search-chips" aria-label="検索語から読み取った条件">{labels.map(label => <li key={label}>{label}</li>)}</ul>
  </div>;
}

function CharacterChips({ ids, interpretation }: { ids: string[]; interpretation: FurnitureSearchInterpretation }) {
  const names = characterNames(ids, interpretation);
  if (!names.length) return null;
  return <span className="rc-search-chips rc-search-chips-compact" aria-label="キャラクター">{names.map(name => <span key={name}>{name}</span>)}</span>;
}

// 推し活グッズの3Dモデル。購入できる商品が無くても表示する。
function SearchModels({ models, interpretation }: { models: SearchModel[]; interpretation: FurnitureSearchInterpretation }) {
  const headingId = useId();
  return <section className="rc-search-models" aria-labelledby={headingId}>
    <h4 id={headingId}>3Dモデル</h4>
    <ul>{models.map(model => {
      const category = interpretation.categories.find(value => value.id === model.category)?.name;
      const characters = characterNames(model.characters, interpretation);
      return <li key={model.id} className="rc-search-model">
        <span className="rc-search-model-name">{model.name}</span>
        {(category || !!characters.length) && <span className="rc-search-chips rc-search-chips-compact">{category && <span>{category}</span>}{characters.map(name => <span key={name}>{name}</span>)}</span>}
        <span className="rc-planner-note">幅{Math.round(model.size.w*100)} × 高さ{Math.round(model.size.h*100)} × 奥行き{Math.round(model.size.d*100)}cm</span>
        <ModelCredits credits={model.credits}/>
      </li>;
    })}</ul>
  </section>;
}

const sizeLabel = (size: RoomItem['size']) => `幅${Math.round(size[0]*100)} × 高さ${Math.round(size[1]*100)} × 奥行き${Math.round(size[2]*100)}cm`;

function variantLabel(variant: FurnitureDetailChoice, variants: FurnitureDetailChoice[]) {
  const { item } = variant;
  // 同じ家具 (3Dモデル) には別の商品も並ぶので、商品名を必ず出す。色名は商品名に無いときだけ足す
  const parts = [item.name];
  if (variant.colorName && !item.name.includes(variant.colorName)) parts.push(variant.colorName);
  if (new Set(variants.map(value => sizeLabel(value.item.size))).size > 1) parts.push(`${Math.round(item.size[0]*100)}×${Math.round(item.size[1]*100)}×${Math.round(item.size[2]*100)}cm`);
  if (new Set(variants.map(value => value.item.price)).size > 1) parts.push(`¥${item.price?.toLocaleString('ja-JP')}`);
  if (new Set(variants.map(value => value.item.shop)).size > 1 && item.shop) parts.push(item.shop);
  return parts.join(' · ');
}

function FurnitureSearchSelection({ product, design, disabled, onAddItem, replacementTarget }: { product: FurnitureSearchProduct; design: RoomDesign; disabled: boolean; onAddItem: (item: RoomItem) => void; replacementTarget?: RoomItem }) {
  const [choiceId, setChoiceId] = useState(product.item.furnitureDetailId);
  const variants = product.variants;
  const chosen = variants.find(variant => variant.item.furnitureDetailId === choiceId) ?? product;
  const item = chosen.item;
  const aliases: Record<string, string> = { lamp: "floor_lamp", artwork: "wall_art", cover: "bed_cover" };
  const sameCategory = !replacementTarget || item.category === (aliases[replacementTarget.category] ?? replacementTarget.category);
  const fits = sameCategory && Boolean(replacementTarget ? productReplacementPosition(item, replacementTarget, design) : furniturePositionInRoom(item, item.position, design));
  return <div className="rc-furniture-imported">
    <h4>{product.item.name}</h4>
    {variants.length > 1 && <fieldset className="rc-furniture-variants" disabled={disabled}><legend>色・サイズ・購入先を選ぶ</legend>{variants.map(variant => <button key={variant.item.furnitureDetailId} type="button" aria-pressed={choiceId === variant.item.furnitureDetailId} onClick={() => setChoiceId(variant.item.furnitureDetailId)}>{variantLabel(variant, variants)}</button>)}</fieldset>}
    <ProductPhoto key={item.imageUrl} className="rc-furniture-variant-photo" src={item.imageUrl} name={item.name}/>
    <p>{item.name} · {chosen.colorName ?? '色の掲載なし'} · ¥{item.price?.toLocaleString('ja-JP')}{item.shop ? ` · ${item.shop}` : ''}</p>
    <p className="rc-planner-note">{sizeLabel(item.size)}</p>
    <ModelCredits credits={chosen.credits}/>
    {item.productUrl && <a className="rc-furniture-product-link" href={item.productUrl} target="_blank" rel="noopener noreferrer">選んだ商品のページを見る</a>}
    {!sameCategory && <p role="alert" className="rc-planner-input-error">選んだ商品のカテゴリが元の家具と一致しません。</p>}
    {!fits && sameCategory && <p role="status" className="rc-planner-input-error">この家具は部屋の寸法に収まりません。</p>}
    <button type="button" className="rc-furniture-add" disabled={disabled || !fits} onClick={() => onAddItem(item)}>{replacementTarget ? '選んだ商品で置き換える' : '＋ 選んだ商品を部屋に追加'}</button>
  </div>;
}
