import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type ChipProps = {
  selected?: boolean;
  color?: string;
  icon?: ReactNode;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color" | "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationEnd">;

/** Botão-pílula de seleção (empresa, prazo...). Alto o bastante para o dedo: 40px. */
export function Chip({ selected, color, icon, children, className, ...props }: ChipProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={SPRING_PRESS}
      {...props}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary-soft text-accent-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
    >
      {color ? <span className="size-2 rounded-full" style={{ background: color }} /> : null}
      {icon}
      {children}
    </motion.button>
  );
}
