import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FurnitureSize } from "../../domain/furnitureAdmin";
import { renderModelThumbnail } from "./thumbnailRenderer";

/** 一覧に出す 3D モデルの小さな画像。画面に入ってから作り、同じ見た目は使い回す。作れないときは代表色の四角 */
export default function ModelThumbnail({ modelUrl, size, colors, fallbackColor, label }: {
  modelUrl: string | null; size: FurnitureSize; colors: Record<string, string>; fallbackColor: string; label: string;
}) {
  const frame = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (!element || seen) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) setSeen(true); }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);
  const thumbnail = useQuery({
    queryKey: ["admin", "model_thumbnail", modelUrl, size.w, size.h, size.d, JSON.stringify(colors)],
    queryFn: () => renderModelThumbnail({ modelUrl: modelUrl ?? "", size, colors }),
    enabled: seen && modelUrl !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return <span ref={frame} className="grid h-12 w-12 place-items-center overflow-hidden rounded bg-gradient-to-b from-white to-[#ECE9F5]">
    {thumbnail.data
      ? <img src={thumbnail.data} alt={`${label}の3Dモデル`} className="h-full w-full object-contain" />
      : <span className="h-5 w-5 rounded-sm" style={{ backgroundColor: fallbackColor }} title={thumbnail.isError ? "3Dモデルを読み込めませんでした" : modelUrl ? "3Dモデルを準備中" : "3Dモデルなし"} />}
  </span>;
}
