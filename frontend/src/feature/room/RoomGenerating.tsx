import { useEffect, useRef } from 'react';
import type { RoomGenerationPhase } from '../../domain/roomRepository';
import ReferenceSvg from './ReferenceSvg';
import './generating.css';

type RoomGeneratingProps = {
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

export default function RoomGenerating({ phase = 'analyzing', prompt, photos, sample, dimensions = false, coordination = true, onCancel }: RoomGeneratingProps) {
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
        <div className="room-generating-user">
          <div className="room-generating-photos">
            {photos.length > 0 ? photos.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`}><PhotoPreview file={file} /></div>) : sample && !dimensions && [2, 3, 4, 5].map(index => <div key={index}><ReferenceSvg page={4} index={index} /></div>)}
          </div>
          <p>{prompt}</p>
          <span>{sample ? 'サンプル' : '送信済み'}</span>
        </div>
        <div className="room-generating-assistant">
          <span className="room-generating-assistant-icon"><ReferenceSvg page={4} index={6} /></span>
          <div className="room-generating-assistant-content">
            <span className="room-generating-assistant-name">へやいろ</span>
            <ol aria-live="polite" className="room-generating-steps" aria-label={sample ? 'サンプルの準備状況' : 'APIへのリクエスト状況'}>
              {steps.map((step, index) => <li key={step.title} aria-current={step.state==='active'?'step':undefined} className={`room-generating-step room-generating-step-${step.state}`}>
                <span className="room-generating-step-icon">{step.state === 'done' && <ReferenceSvg page={4} index={index === 0 ? 7 : 8} />}</span>
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
        <span><ReferenceSvg page={4} index={10} />{sample ? 'サンプルルーム' : 'プレビュー例'}</span>
      </div>
      <div className="room-generating-scene-wrap">
        <div className="room-generating-scene">
          <ReferenceSvg page={4} index={11} />
          {sample && !dimensions && <>
            <div className="room-generating-scan" />
            {furnitureLabels.map(label => <span key={label.name} className="room-generating-furniture" style={{ left: label.left, top: label.top }}><span />{label.name}（例）</span>)}
          </>}
        </div>
      </div>
      <div className="room-generating-status" role="status" aria-live="polite">
        <div><span>{sample ? 'サンプル準備中' : '生成中'}</span><span><><strong>{activeIndex+1}</strong> / {steps.length} ステップ</></span></div>
        <div className="room-generating-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={activeIndex} aria-label={sample ? 'サンプルの準備状況' : 'APIからの応答待ち'}><div style={{width:`${activeIndex/steps.length*100}%`}} /></div>
      </div>
    </section>
  </>;
}
