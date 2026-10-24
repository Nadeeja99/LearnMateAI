import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconBadgeProps {
  icon: LucideIcon;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "primary";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 rounded-md [&>svg]:h-4 [&>svg]:w-4",
  md: "h-10 w-10 rounded-lg [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-12 w-12 rounded-xl [&>svg]:h-6 [&>svg]:w-6",
};

const tones = {
  neutral: "border bg-muted/60 text-foreground/80",
  primary: "border border-primary/20 bg-primary/10 text-primary",
};

/** Flat icon tile used in place of gradient circles. */
const IconBadge = ({ icon: Icon, size = "md", tone = "neutral", className }: IconBadgeProps) => (
  <div className={cn("flex shrink-0 items-center justify-center", sizes[size], tones[tone], className)}>
    <Icon />
  </div>
);

export default IconBadge;
