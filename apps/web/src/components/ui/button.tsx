import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-base font-semibold leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--brand-teal-light)_28%,transparent)] disabled:pointer-events-none disabled:opacity-50 bg-[var(--brand-teal)] text-white shadow-sm hover:-translate-y-0.5 hover:bg-[var(--brand-teal-light)] hover:shadow-brand dark:bg-[var(--brand-teal-light)] dark:text-[var(--brand-teal)] dark:hover:bg-[var(--brand-teal-lighter)]",
  {
    variants: {
      variant: {
        default: "",
        outline:
          "border border-[color-mix(in_srgb,var(--brand-teal-light)_28%,transparent)] bg-white/85 text-[var(--brand-teal)] shadow-none hover:bg-[var(--teal-60)] dark:border-[color-mix(in_srgb,var(--brand-teal)_35%,transparent)] dark:bg-slate-900/80 dark:text-[var(--brand-teal)] dark:hover:bg-[var(--teal-80)]"
      },
      size: {
        default: "h-12 min-h-[3rem] px-5 py-2.5",
        sm: "h-11 min-h-[2.75rem] rounded-lg px-4 text-base",
        lg: "h-[3.25rem] min-h-[3.25rem] px-8 text-lg"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
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
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
