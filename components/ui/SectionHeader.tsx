import Link from "next/link";

type SectionHeaderProps = {
  title: string;
  id?: string;
  href?: string;
  action?: string;
};

export function SectionHeader({ title, id, href, action = "See all" }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-2">
      <h2 id={id} className="font-display text-2xl font-extrabold uppercase tracking-wide">
        {title}
      </h2>
      {href ? (
        <Link
          href={href}
          className="font-display text-xs font-bold uppercase tracking-wider text-accent hover:underline"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}
