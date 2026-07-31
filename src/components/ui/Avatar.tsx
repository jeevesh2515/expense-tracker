import { cn, formatCentsCompact } from "@/lib/utils";

export type AvatarProps = {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({ name, color, size = "md", className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0 shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md select-none",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}
