import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRepositories } from '../../core/repositories';
import { furnitureCategories, type ProductColorVariant, type RoomDesign, type RoomItem } from '../../domain/room';
import ErrorText from '../shared/ErrorText';
import { furniturePositionInRoom } from './roomBounds';

const colors = [['white','ホワイト・アイボリー'],['black','ブラック'],['gray','グレー'],['brown','ブラウン'],['beige','ベージュ・ナチュラル'],['green','グリーン'],['blue','ブルー'],['purple','パープル'],['pink','ピンク'],['red','レッド'],['orange','オレンジ'],['yellow','イエロー']] as const;
const categories = ['ソファ','ベッド','デスク','椅子','収納棚','テーブル'];

export default function FurnitureSearchPanel({ design, disabled, onAddItem }: { design: RoomDesign; disabled: boolean; onAddItem: (item: RoomItem) => void }) {
  const { rooms } = useRepositories();
  const [query, setQuery] = useState('');
  const [color, setColor] = useState('');
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const search = useMutation({ mutationFn: (input: { query: string; color?: string; category?: string }) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    return rooms.searchFurniture(input, controller.signal);
  } });
  const currentResults = search.variables?.query === query.trim() && search.variables?.color === (color || undefined) && search.variables?.category === (category || undefined);
  const selected = search.data?.products.find(item => item.ecProductId === selectedId);
  return <div className="rc-furniture-search">
    <form className="rc-furniture-link-form" onSubmit={event => { event.preventDefault(); setSelectedId(undefined); if (!disabled && query.trim()) search.mutate({ query: query.trim(), color: color || undefined, category: category || undefined }); }}>
      <label htmlFor="furniture-search-query">家具を検索</label>
      <input id="furniture-search-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} placeholder="例：丸いサイドテーブル" required disabled={disabled || search.isPending}/>
      <label htmlFor="furniture-search-color">商品の色で絞り込む</label>
      <select id="furniture-search-color" value={color} onChange={event => setColor(event.target.value)} disabled={disabled || search.isPending}><option value="">すべての色</option>{colors.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="furniture-search-category">家具の種類</label>
      <select id="furniture-search-category" value={category} onChange={event => setCategory(event.target.value)} disabled={disabled || search.isPending}><option value="">すべての種類</option>{furnitureCategories.map((value,index) => <option key={value} value={value}>{categories[index]}</option>)}</select>
      <button type="submit" disabled={disabled || search.isPending || !query.trim()}>{search.isPending ? '検索中…' : 'この条件で検索'}</button>
    </form>
    {search.isPending && <p role="status" className="rc-planner-note">公式の商品ページで色・価格・寸法を確認しています。</p>}
    {search.isError && <ErrorText error={search.error}/>}
    {search.data && currentResults && !search.isPending && <>
      <p role="status" className="rc-planner-note">{search.data.products.length ? `${search.data.products.length}件の商品` : 'この条件の商品は見つかりませんでした。検索語や色を変えてお試しください。'}</p>
      {!!search.data.failures && <p className="rc-planner-note">取得できなかった商品ページがあります。</p>}
      <div className="rc-furniture-search-results">{search.data.products.map(item => <button key={item.ecProductId} type="button" className="rc-furniture-search-card" aria-pressed={selectedId === item.ecProductId} disabled={disabled} onClick={() => setSelectedId(item.ecProductId)}>
        {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy"/>}<span>{item.name}</span><span>{item.productMetadata?.officialColor ?? '色の掲載なし'} · ¥{item.price?.toLocaleString('ja-JP')}</span>
      </button>)}</div>
      {selected && <FurnitureSearchSelection key={selected.ecProductId} product={selected} design={design} disabled={disabled} onAddItem={onAddItem}/>}
      {search.data.searchEntryPoints.map((html,index) => <iframe key={html} title={`家具検索のGoogle検索候補 ${index+1}`} srcDoc={`<base target="_blank">${html}`} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" className="rc-furniture-search-attribution"/>) }
    </>}
  </div>;
}

function FurnitureSearchSelection({ product, design, disabled, onAddItem }: { product: RoomItem; design: RoomDesign; disabled: boolean; onAddItem: (item: RoomItem) => void }) {
  const { rooms } = useRepositories();
  const sku = (value?: string) => product.productMetadata?.provider === 'ikea' ? value?.replace(/\./g, '') : value;
  const initial = { url: product.productUrl!, variantId: product.productMetadata?.colorVariants?.find(variant => variant.url === product.productUrl && sku(variant.variantId) === sku(product.productMetadata?.providerProductId))?.variantId };
  const [choice, setChoice] = useState<{url: string; variantId?: string}>(initial);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const imported = useMutation({ mutationFn: (variant: {url: string; variantId?: string}) => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    return rooms.importFurniture(variant.url, controller.signal, variant.variantId);
  } });
  const matching = imported.data && imported.variables?.url === choice.url && imported.variables?.variantId === choice.variantId;
  const item = matching ? imported.data : undefined;
  const fits = item && Boolean(furniturePositionInRoom(item, item.position, design));
  const variants = product.productMetadata?.colorVariants ?? [];
  function selectVariant(variant: Pick<ProductColorVariant, 'url' | 'variantId'>) { setChoice(variant); imported.mutate(variant); }
  return <div className="rc-furniture-imported">
    <h4>{product.name}</h4>
    {!!variants.length && <fieldset className="rc-furniture-variants" disabled={disabled || imported.isPending}><legend>商品のカラーバリエーション</legend>{variants.map(variant => <button key={`${variant.url}:${variant.variantId ?? ''}`} type="button" aria-pressed={choice.url === variant.url && choice.variantId === variant.variantId} onClick={() => selectVariant(variant)}>{variant.colorName}</button>)}</fieldset>}
    {variants.length === 0 && <p className="rc-planner-note">この商品には確認できた色違いの情報がありません。</p>}
    {imported.isPending && <p role="status" className="rc-planner-note">選んだ商品の情報を確認しています。</p>}
    {imported.isError && <ErrorText error={imported.error}/>}
    {!item && !imported.isPending && <button type="button" className="rc-furniture-add" disabled={disabled} onClick={() => imported.mutate(choice)}>選んだ商品を確認</button>}
    {item && !imported.isPending && <>
      {item.imageUrl && <img className="rc-furniture-variant-photo" src={item.imageUrl} alt={item.name}/>}
      <p>{item.name} · {item.productMetadata?.officialColor ?? '色の掲載なし'} · ¥{item.price?.toLocaleString('ja-JP')}</p>
      <p className="rc-planner-note">幅{Math.round(item.size[0]*100)} × 高さ{Math.round(item.size[1]*100)} × 奥行き{Math.round(item.size[2]*100)}cm</p>
      <a className="rc-furniture-product-link" href={item.productUrl} target="_blank" rel="noopener noreferrer">選んだ商品のページを見る</a>
      {!fits && <p role="status" className="rc-planner-input-error">この家具は部屋の寸法に収まりません。</p>}
      <button type="button" className="rc-furniture-add" disabled={disabled || !fits} onClick={() => onAddItem(item)}>＋ 選んだ色の商品を部屋に追加</button>
    </>}
  </div>;
}
