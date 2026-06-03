import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "liquid-input glass-field flex h-10 w-full rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg-strong))] px-3 py-2 text-sm shadow-[inset_0_1px_0_hsl(0_0%_100%/0.16)] ring-offset-background transition-[border-color,background-color,box-shadow,transform] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:border-[hsl(var(--glass-border-accent))] focus-visible:border-[hsl(var(--glass-border-accent))] focus-visible:bg-[hsl(var(--card)/0.76)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 [[type=date]&]:pr-10 [[type=date]&]:appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
