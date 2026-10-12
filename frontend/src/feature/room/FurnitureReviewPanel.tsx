import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRepositories } from '../../core/repositories';
import type { RoomDesign, RoomItem } from '../../domain/room';
import type { FurnitureReview, FurnitureReviewInput } from '../../domain/roomRepository';
import ErrorText from '../shared/ErrorText';
import { getFurniturePlacementBounds } from './roomBounds';

const verdictLabels: Record<FurnitureReview['verdict'], string> = { good: '似合っています', fair: 'もう一歩です', poor: '合っていません' };

// 選んだ家具が今の部屋に合うかをAIに聞く。答えは保存せず、家具や配置を変えたら聞き直す
export default function FurnitureReviewPanel({ item, design }: { item: RoomItem; design: RoomDesign }) {
  const bounds = getFurniturePlacementBounds(design);
  const input: FurnitureReviewInput = {
    target: item,
    others: design.items.filter(other => other.id !== item.id),
    room: {
      width: design.room?.width ?? bounds.max[0] - bounds.min[0], depth: design.room?.depth ?? bounds.max[2] - bounds.min[2],
      wallColor: design.wallColor, floorColor: design.floorColor ?? design.room?.floorColor,
    },
    floor: bounds.floor,
    prompt: design.prompt,
  };
  const version = ({ id, name, category, color, size, position, supportObjectId, furnitureDetailId }: RoomItem) =>
    ({ id, name, category, color, size, position, supportObjectId, furnitureDetailId });
  const key = JSON.stringify({ ...input, target: version(input.target), others: input.others.map(version) });
  return <CurrentFurnitureReviewPanel key={key} input={input}/>;
}

function CurrentFurnitureReviewPanel({ input }: { input: FurnitureReviewInput }) {
  const { rooms } = useRepositories();
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const review = useMutation({ mutationFn: () => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    return rooms.reviewFurniture(input, controller.signal);
  } });
  const answer = review.data;
  return <section className="rc-review" aria-label="AIに聞く">
    <button type="button" className="rc-review-ask motion-control" disabled={review.isPending} onClick={() => review.mutate()}>
      {review.isPending ? 'AIが部屋を見ています…' : answer ? 'もう一度聞く' : 'この家具、似合ってる？'}
    </button>
    {review.isError && <ErrorText error={review.error}/>}
    {answer && !review.isPending && <div className="rc-review-answer" role="status" data-verdict={answer.verdict}>
      <p className="rc-review-verdict"><span>{verdictLabels[answer.verdict]}</span>{answer.summary}</p>
      <dl>
        <div><dt>色</dt><dd>{answer.color}</dd></div>
        <div><dt>大きさ</dt><dd>{answer.size}</dd></div>
        <div><dt>雰囲気</dt><dd>{answer.mood}</dd></div>
      </dl>
      {answer.suggestion && <p className="rc-review-suggestion">{answer.suggestion}</p>}
      {answer.reviewedBy === 'mock' && <p className="rc-planner-note">AIにつながっていないため、色と大きさだけから出した簡易な答えです。</p>}
    </div>}
  </section>;
}
