import { useEffect, useRef, useState } from 'react';
import type { RoomDesign } from '../../domain/room';
import type { RoomGenerationPhase } from '../../domain/roomRepository';
import ReferenceSvg from './ReferenceSvg';
import RoomPreview from './RoomPreview';
import './room-list.css';
import './generating.css';

type RoomGeneratingProps = {
  // 作り直す元の部屋。あれば例の絵の代わりに、その3Dモデルを見せる。
  design?: RoomDesign;
  phase?: RoomGenerationPhase;
  prompt: string;
  photos: File[];
  sample: boolean;
  dimensions?: boolean;
  coordination?: boolean;
  onCancel: () => void;
};

const furnitureLabels = [
  { name: 'ベッド', left: '44.23%', top: '40.98%' },
  { name: 'デスク', left: '74.54%', top: '47.8%' },
  { name: 'チェア', left: '62.45%', top: '45%' },
  { name: 'モニター', left: '73.45%', top: '34.15%' },
  { name: 'ローテーブル', left: '51.8%', top: '60%' },
];

// 待っている間に順に見せる、使い方のヒント。
const hints = [
  '家具はドラッグで動かせます。',
  '家具を選ぶと、色違いや別の商品に入れ替えられます。',
  '「真上」の視点にすると、配置を調整しやすくなります。',
  'できあがった部屋は、Before / After で見比べられます。',
  '気になる商品は、アイテム一覧から商品ページを開けます。',
  '仕上がりが違うときは、変えたいところを言葉で伝えると作り直せます。',
];
const hintInterval = 6000;

function Hint() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex(value => (value + 1) % hints.length), hintInterval);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="room-generating-hint"><span>ヒント</span><span key={index} className="motion-fade">{hints[index]}</span></p>;
}

function PhotoPreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const node = image.current;
    if (node) node.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <img ref={image} alt={file.name} />;
}

export default function RoomGenerating({ design, phase = 'analyzing', prompt, photos, sample, dimensions = false, coordination = true, onCancel }: RoomGeneratingProps) {
  const stages: {phase:RoomGenerationPhase;title:string}[] = [
    ...(photos.length && dimensions && !sample ? [{phase:'uploading' as const,title:'写真を送信'}] : []),
    {phase:'analyzing',title:sample?'部屋を準備':dimensions?'部屋を解析':'生成結果を待機'},
    ...(coordination && dimensions && !sample ? [{phase:'coordinating' as const,title:'コーディネートを受信'}] : []),
    {phase:'preview',title:'3Dプレビューを準備'},
  ];
  const activeIndex = Math.max(0, stages.findIndex(stage => stage.phase === phase));
  const steps = stages.map((stage,index)=>({...stage,state:index<activeIndex?'done':index===activeIndex?'active':'pending'}));
  return <>
    <section aria-label="チャット" className="room-generating-chat">
      <div className="room-generating-chat-scroll">
        <div className="room-generating-user motion-enter">
          <div className="room-generating-photos">
            {photos.length > 0 ? photos.map(file => <div key={`${file.name}-${file.size}-${file.lastModified}`}><PhotoPreview file={file} /></div>) : sample && !dimensions && [2, 3, 4, 5].map(index => <div key={index}><ReferenceSvg page={4} index={index} /></div>)}
          </div>
          <p>{prompt}</p>
          <span>{sample ? 'サンプル' : '送信済み'}</span>
        </div>
        <div className="room-generating-assistant motion-enter">
          <span className="room-generating-assistant-icon"><ReferenceSvg page={4} index={6} /></span>
          <div className="room-generating-assistant-content">
            <span className="room-generating-assistant-name">へやいろ</span>
            <ol className="room-generating-steps" aria-label={sample ? 'サンプルの準備状況' : 'APIへのリクエスト状況'}>
              {steps.map((step, index) => <li key={step.title} aria-current={step.state==='active'?'step':undefined} className={`room-generating-step room-generating-step-${step.state}`}>
                <span aria-hidden="true" className="room-generating-step-icon">{step.state === 'done' && <ReferenceSvg page={4} index={index === 0 ? 7 : 8} />}</span>
                <div><span>{step.title}</span></div>
              </li>)}
            </ol>
          </div>
        </div>
      </div>
      <form className="room-generating-composer" onSubmit={event => event.preventDefault()}>
        <div>
          <label htmlFor="gen-msg">メッセージ</label>
          <textarea id="gen-msg" rows={1} disabled placeholder="生成中" />
          <button type="button" onClick={onCancel}><ReferenceSvg page={4} index={9} />停止</button>
        </div>
      </form>
    </section>
    <section aria-label="3Dプレビュー" className="room-generating-stage">
      <div className="room-generating-stage-tags">
        <span><ReferenceSvg page={4} index={10} />{design ? '今の部屋' : sample ? 'サンプルルーム' : 'プレビュー例'}</span>
      </div>
      {design ? <div className="room-generating-room"><RoomPreview design={design}/></div> : <div className="room-generating-scene-wrap">
        <div className="room-generating-scene">
          <ReferenceSvg page={4} index={11} />
          {sample && !dimensions && <>
            <div className="room-generating-scan" />
            {furnitureLabels.map(label => <span key={label.name} className="room-generating-furniture" style={{ left: label.left, top: label.top }}><span />{label.name}（例）</span>)}
          </>}
        </div>
      </div>}
      <div className="room-generating-status motion-fade" role="status" aria-live="polite">
        <div><span>{sample ? 'サンプル準備中' : '生成中'} · {stages[activeIndex].title}</span><span><><strong>{activeIndex+1}</strong> / {steps.length} ステップ</></span></div>
        <div className="room-generating-progress" role="progressbar" aria-label={sample ? 'サンプルの準備状況' : 'APIからの応答待ち'}><div className="room-generating-progress-waiting" /></div>
        <Hint/>
      </div>
    </section>
  </>;
}
