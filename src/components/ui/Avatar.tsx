import { cn, formatCentsCompact } from "@/lib/utils";

export type AvatarProps = {
  name: string;
  color: string;
  size?: "sm" | "md" | "lg";
};

export function Avatar({ name, color, size = "md" }: AvatarProps) {
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
        "rounded-full flex items-center justify-center font-semibold text-white shrink-0",
        sizes[size],
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials || "?"}
    </div>
  );
}
