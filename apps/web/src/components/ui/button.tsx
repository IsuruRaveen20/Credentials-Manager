import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-transform duration-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:var(--glow-focus)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[color:var(--brand-500)] text-white hover:brightness-110 border border-[color:var(--hairline-strong)]",
        secondary:
          "bg-[color:var(--bg-elev-2)] text-[color:var(--text)] border border-[color:var(--hairline)] hover:bg-[color:var(--bg-elev-3)]",
        ghost: "hover:bg-[color:var(--bg-elev-2)] text-[color:var(--text-muted)]",
        destructive: "bg-[color:var(--red-600)] text-white hover:brightness-110",
        outline:
          "border border-[color:var(--hairline)] bg-transparent hover:bg-[color:var(--bg-elev-2)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
