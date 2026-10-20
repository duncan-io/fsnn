import type { Reporter } from "@/lib/types";
import { RelativeTime } from "@/components/ui/RelativeTime";

type ReporterBylineProps = {
  reporter: Reporter;
  publishedAt: string;
  readTimeMinutes?: number;
  tone?: "default" | "inverse";
  dense?: boolean;
};

export function ReporterByline({
  reporter,
  publishedAt,
  readTimeMinutes,
  tone = "default",
  dense = false,
}: ReporterBylineProps) {
  const inverse = tone === "inverse";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
        inverse ? "text-white/75" : "text-muted"
      }`}
    >
      <span
        className={`grid size-6 place-items-center rounded-full font-display text-[10px] font-bold ${
          inverse ? "bg-white/15 text-white" : "bg-surface-raised text-accent"
        }`}
        aria-hidden="true"
      >
        {reporter.initials}
      </span>
      <span className={inverse ? "font-medium text-white" : "font-medium text-foreground"}>
        {reporter.name}
      </span>
      {dense ? null : (
        <>
          <span aria-hidden="true">·</span>
          <span>{reporter.beat}</span>
        </>
      )}
      <span aria-hidden="true">·</span>
      <RelativeTime iso={publishedAt} />
      {readTimeMinutes ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{readTimeMinutes} min</span>
        </>
      ) : null}
    </div>
  );
}
