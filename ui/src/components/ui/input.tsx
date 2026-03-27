import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-white/5 bg-[#1C1C1E] px-3 py-2.5 text-[14px] font-medium text-white shadow-xs transition-colors outline-none placeholder:text-white/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 md:text-[14px]",
        "focus:border-[#0A84FF]/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
