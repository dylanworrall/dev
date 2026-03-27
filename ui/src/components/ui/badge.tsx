import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[12px] font-medium whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-[#0A84FF] text-white [a&]:hover:bg-[#0A84FF]/90",
        secondary:
          "bg-[#2A2A2C] text-white/70 border-white/5 [a&]:hover:bg-[#3A3A3C]",
        destructive:
          "bg-[#FF453A]/10 text-[#FF453A] [a&]:hover:bg-[#FF453A]/20",
        outline:
          "border-white/5 text-white/70 [a&]:hover:bg-[#2A2A2C]",
        ghost: "[a&]:hover:bg-white/10 [a&]:hover:text-white",
        link: "text-[#0A84FF] underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
