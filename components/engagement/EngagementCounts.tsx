export function EngagementCounts({
  likes,
  comments,
  inverse = false,
}: {
  likes: number;
  comments: number;
  inverse?: boolean;
}) {
  return (
    <span className={`block text-xs ${inverse ? "text-white/70" : "text-muted"}`}>
      <span>{likes === 1 ? "1 like" : `${likes} likes`}</span>
      <span aria-hidden="true"> · </span>
      <span>{comments === 1 ? "1 comment" : `${comments} comments`}</span>
    </span>
  );
}
