import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-white/5 bg-transparent px-3 py-2 text-[15px] font-medium text-white leading-relaxed shadow-xs transition-colors outline-none placeholder:text-white/20 focus:border-[#0A84FF]/50 disabled:cursor-not-allowed disabled:opacity-40 md:text-[15px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
