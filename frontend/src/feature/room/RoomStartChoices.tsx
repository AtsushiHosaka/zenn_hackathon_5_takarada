import { useQuery } from '@tanstack/react-query';
import { useRepositories } from '../../core/repositories';
import { quickStartPrompt, starterRoomTemplates } from '../../domain/starterRoomTemplates';
import ErrorText from '../shared/ErrorText';
import { roomPlanKeys } from './plans';
import { useCreateRoomFromTemplate } from './templates';

export default function RoomStartChoices({ onPersonal }: { onPersonal: () => void }) {
  const create = useCreateRoomFromTemplate(true);
  const { rooms } = useRepositories();
  const capability = useQuery({ queryKey: roomPlanKeys.capabilities, queryFn: () => rooms.capabilities(), staleTime: Infinity });
  return <section className="rc-start-choices" aria-labelledby="room-start-heading">
    <h2 id="room-start-heading">どちらから始めますか？</h2>
    <article><h3>すぐ試す <small>目安 1〜2分</small></h3>
      <p>写真の準備は不要。家具付きの6畳の部屋から始めます。</p>
      <ol><li>テンプレートの3Dの部屋を開く</li><li>「{quickStartPrompt}」と伝える</li><li>部屋の変化と、提案された商品を見る</li></ol>
      <button type="button" className="rc-primary" disabled={create.isPending || !capability.data?.coordination} onClick={() => create.mutate(starterRoomTemplates[0].design)}>{create.isPending ? '部屋を作成中…' : '写真なしですぐ試す'}</button>
      {capability.data && !capability.data.coordination && <p>商品付きの提案は、コーディネート対応のAPI接続で試せます。</p>}
      <ErrorText error={create.error}/><ErrorText error={capability.error}/>
    </article>
    <article><h3>自分の部屋で試す</h3><p>写真があれば、Geminiによる部屋の解析から試せます。</p>
      <button type="button" className="rc-secondary" disabled={create.isPending} onClick={onPersonal}>自分の部屋を入力する</button>
    </article>
  </section>;
}
