/* eslint-disable @next/next/no-img-element -- bucket objects are served by /media, not from public/ */

export function BucketImage({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={className ?? "absolute inset-0 h-full w-full object-cover"} />;
}
