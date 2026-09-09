"use client";

import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";

let offlineArt: Promise<Record<string, string>> | undefined;
function artIndex() {
  return offlineArt ??= fetch("/art-map.json").then(r => r.ok ? r.json() : {}).catch(() => ({}));
}

const foilRarities = new Set(["OSR", "S", "SR", "SY", "UR", "HR", "OUR", "SEC", "P"]);

export function isFoilRarity(rarity?: string | null) {
  return foilRarities.has(String(rarity || "").toUpperCase());
}

type FoilCardImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src: string;
  alt: string;
  rarity?: string | null;
  className?: string;
  fallbackSrc?: string | string[];
};

export default function FoilCardImage({ src, alt, rarity, className = "", loading = "lazy", fallbackSrc, onError, onLoad, ...imageProps }: FoilCardImageProps) {
  const foil = isFoilRarity(rarity);
  const [art, setArt] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState({ src, value: "loading" });
  useEffect(() => { let alive = true; artIndex().then(map => { if (alive) setArt(map); }); return () => { alive = false; }; }, []);
  const thumbnail = art[src];
  const fallbackKey = (Array.isArray(fallbackSrc) ? fallbackSrc : [fallbackSrc]).filter(Boolean).join("\u0000");
  const sources = useMemo(() => [...new Set([src, ...fallbackKey.split("\u0000"), thumbnail].filter(Boolean))], [fallbackKey, src, thumbnail]);
  const sourceKey = `${src}\u0000${fallbackKey}`;
  const [failedSource, setFailedSource] = useState({ key: sourceKey, index: 0 });
  const sourceIndex = failedSource.key === sourceKey ? failedSource.index : 0;

  return (
    <span
      className={`foil-card-surface ${foil ? "is-foil" : ""} ${className}`.trim()}
      data-foil-rarity={foil ? String(rarity || "").toUpperCase() : undefined}
      data-image-quality={quality.src === src ? quality.value : "loading"}
      style={thumbnail ? { backgroundImage: `url("${thumbnail}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imageProps}
        className="foil-card-image"
        src={window.HoloNative?.artUrl?.(sources[Math.min(sourceIndex, sources.length - 1)] || src) ?? (sources[Math.min(sourceIndex, sources.length - 1)] || src)}
        alt={alt}
        loading={loading}
        onLoad={(event) => {
          setQuality({ src, value: event.currentTarget.naturalWidth > 335 ? "original" : "preview" });
          onLoad?.(event);
        }}
        onError={(event) => {
          if (sourceIndex >= sources.length - 1) onError?.(event);
          setFailedSource((current) => {
            const index = current.key === sourceKey ? current.index : 0;
            return index < sources.length - 1 ? { key: sourceKey, index: index + 1 } : { key: sourceKey, index };
          });
        }}
      />
    </span>
  );
}
