import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "glass-control inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary/25 bg-primary/[0.88] text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.18),inset_0_1px_0_hsl(0_0%_100%/0.20)] hover:border-primary/[0.45] hover:bg-primary/[0.82]",
        destructive: "border border-destructive/25 bg-destructive/[0.88] text-destructive-foreground shadow-[var(--glass-shadow)] hover:bg-destructive/80",
        outline: "border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] text-foreground shadow-[var(--glass-shadow)] hover:border-[hsl(var(--glass-border-accent))] hover:bg-[hsl(var(--glass-bg-strong))]",
        secondary: "border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg-strong))] text-secondary-foreground shadow-[var(--glass-shadow)] hover:border-[hsl(var(--glass-border-accent))] hover:bg-[hsl(var(--glass-bg-solid))]",
        ghost: "border border-transparent bg-transparent hover:border-[hsl(var(--glass-border-accent))] hover:bg-[hsl(var(--glass-bg))] hover:text-primary hover:shadow-[var(--glass-shadow)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
