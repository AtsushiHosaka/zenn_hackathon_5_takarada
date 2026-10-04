import { useEffect, useRef } from 'react';
import ReferenceSvg from './ReferenceSvg';
import './generating.css';

type RoomGeneratingProps = {
  prompt: string;
  photos: File[];
  sample: boolean;
  dimensions?: boolean;
  coordination?: boolean;
  onCancel: () => void;
};

const sampleSteps = [
  { title: 'サンプルの部屋モデルを準備', detail: '約6畳の洋室の配置例', state: 'done' },
  { title: 'サンプルの家具を準備', detail: 'ベッド、デスク、チェア、モニター、ローテーブルの配置例', state: 'done' },
  { title: 'サンプルの表示を準備しています', detail: '「推し活 × パープル」のコーディネート例', state: 'active' },
  { title: '商品リンクの例を表示', state: 'pending' },
  { title: 'サンプルの3Dプレビューを表示', state: 'pending' },
];

const apiSteps = [
  { title: 'APIからの応答を待っています', detail: '処理状況はまだ届いていません', state: 'active' },
  { title: '部屋と家具の解析結果を受信', state: 'pending' },
  { title: 'コーディネート結果を受信', state: 'pending' },
  { title: '3Dモデルと商品リンクを受信', state: 'pending' },
  { title: 'プレビューを表示', state: 'pending' },
];

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

export default function RoomGenerating({ prompt, photos, sample, dimensions = false, coordination = true, onCancel }: RoomGeneratingProps) {
  const steps = dimensions ? [
    { title: sample ? '部屋のモックを準備しています' : '部屋の解析結果を待っています', detail: '畳数と部屋の形から、実寸のシーンを作ります', state: 'active' },
    ...(coordination ? [{ title: '希望と予算に合わせた提案を受信', detail: '商品選定はモックです', state: 'pending' }] : []),
    { title: '家具と窓を3Dプレビューに表示', detail: '写真の解析は行いません', state: 'pending' },
  ] : sample ? sampleSteps : apiSteps;
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
            <span className="room-generating-assistant-name">ルームコーディネーター</span>
            <p>{dimensions ? sample ? '畳数と形から、部屋のモックを準備しています。' : '部屋の広さと形を送信しました。APIからの結果を待っています。' : sample ? 'サンプルルームを準備しています。写真の解析は行っていません。' : 'リクエストを送信しました。APIからの結果を待っています。'}</p>
            <ol className="room-generating-steps" aria-label={sample ? 'サンプルの準備状況' : 'APIへのリクエスト状況'}>
              {steps.map((step, index) => <li key={step.title} className={`room-generating-step room-generating-step-${step.state}`}>
                <span className="room-generating-step-icon">{step.state === 'done' && <ReferenceSvg page={4} index={index === 0 ? 7 : 8} />}</span>
                <div><span>{step.title}</span>{step.detail && <span>{step.detail}</span>}</div>
              </li>)}
            </ol>
          </div>
        </div>
      </div>
      <form className="room-generating-composer" onSubmit={event => event.preventDefault()}>
        <div>
          <label htmlFor="gen-msg">メッセージ</label>
          <textarea id="gen-msg" rows={1} disabled placeholder={sample ? '準備が終わると、続けて相談できます' : '生成が終わると、続けて相談できます'} />
          <button type="button" onClick={onCancel}><ReferenceSvg page={4} index={9} />停止</button>
        </div>
      </form>
    </section>
    <section aria-label="3Dプレビュー" className="room-generating-stage">
      <div className="room-generating-stage-tags">
        <span><ReferenceSvg page={4} index={10} />{sample ? 'サンプルルーム' : 'プレビュー例'}</span>
        {sample && !dimensions && <span>家具5点の配置例</span>}
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
        <div><span>{sample ? 'サンプル準備中' : 'APIの応答を待っています'}</span><span>{sample && !dimensions ? <><strong>3</strong> / 5 ステップ</> : '処理状況を確認中'}</span></div>
        <div className="room-generating-progress" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={sample && !dimensions ? 3 : undefined} aria-label={sample ? 'サンプルの準備状況' : 'APIからの応答待ち'}><div className={sample && !dimensions ? undefined : 'room-generating-progress-waiting'} /></div>
      </div>
    </section>
  </>;
}
