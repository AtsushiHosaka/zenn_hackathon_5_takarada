import type { ModelCredit } from '../../domain/roomRepository';

// ピアプロなどのガイドラインが求めるクレジットと注意書きを、モデルの近くに表示する。
export default function ModelCredits({ credits }: { credits: ModelCredit[] }) {
  const unique = credits.filter((credit, index) => credits.findIndex(other => other.franchise === credit.franchise) === index && (credit.credit || credit.notice || credit.licenseUrl));
  if (!unique.length) return null;
  return <div className="rc-model-credits" aria-label="権利表記">
    {unique.map(credit => <p key={credit.franchise}>
      {credit.credit && <span>{credit.credit}</span>}
      {credit.notice && <span>{credit.notice}</span>}
      {credit.licenseUrl && <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">利用ガイドラインを見る</a>}
    </p>)}
  </div>;
}
