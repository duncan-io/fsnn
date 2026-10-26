import { BucketImage } from "@/components/ui/BucketImage";

export function ArticleLead({ src }: { src?: string }) {
  if (!src) return null;
  return (
    <div className="relative mb-6 aspect-[16/9] max-w-3xl overflow-hidden bg-surface">
      <BucketImage src={src} />
    </div>
  );
}
