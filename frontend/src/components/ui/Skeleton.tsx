import { cn } from "@/lib/utils/cn";

/**
 * Shimmer placeholder, shaped like the content being loaded. Hidden from screen
 * readers; the container being loaded should carry `aria-busy`.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden="true" role="presentation" />;
}
