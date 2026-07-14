import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--glow-focus)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color:var(--bg-elev-3)] text-[color:var(--text-muted)] hover:bg-[color:var(--bg-elev-2)]",
        success:
          "border-transparent bg-[color:var(--emerald-600)]/20 text-[color:var(--emerald-400)]",
        warning:
          "border-transparent bg-[color:var(--amber-500)]/15 text-[color:var(--amber-400)]",
        danger: "border-transparent bg-[color:var(--red-600)]/20 text-[color:var(--red-400)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
