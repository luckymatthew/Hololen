"use client";

import { useMemo, useState, type ImgHTMLAttributes } from "react";

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

export default function FoilCardImage({ src, alt, rarity, className = "", loading = "lazy", fallbackSrc, onError, ...imageProps }: FoilCardImageProps) {
  const foil = isFoilRarity(rarity);
  const fallbackKey = (Array.isArray(fallbackSrc) ? fallbackSrc : [fallbackSrc]).filter(Boolean).join("\u0000");
  const sources = useMemo(() => [...new Set([src, ...fallbackKey.split("\u0000")].filter(Boolean))], [fallbackKey, src]);
  const sourceKey = `${src}\u0000${fallbackKey}`;
  const [failedSource, setFailedSource] = useState({ key: sourceKey, index: 0 });
  const sourceIndex = failedSource.key === sourceKey ? failedSource.index : 0;

  return (
    <span
      className={`foil-card-surface ${foil ? "is-foil" : ""} ${className}`.trim()}
      data-foil-rarity={foil ? String(rarity || "").toUpperCase() : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        {...imageProps}
        className="foil-card-image"
        src={sources[Math.min(sourceIndex, sources.length - 1)] || src}
        alt={alt}
        loading={loading}
        onError={(event) => {
          onError?.(event);
          setFailedSource((current) => {
            const index = current.key === sourceKey ? current.index : 0;
            return index < sources.length - 1 ? { key: sourceKey, index: index + 1 } : { key: sourceKey, index };
          });
        }}
      />
    </span>
  );
}
