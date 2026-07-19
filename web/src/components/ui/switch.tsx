"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // Checked = solid brand fill + matching border; unchecked = muted track
        // with a visible outline so the off state still reads as a control.
        // Both the boolean (data-checked) and stateful (data-[state=checked])
        // attribute conventions are covered so the fill always shows.
        "data-checked:bg-primary data-[state=checked]:bg-primary data-checked:border-primary data-[state=checked]:border-primary",
        "data-unchecked:bg-input data-[state=unchecked]:bg-input dark:data-unchecked:bg-input/60 dark:data-[state=unchecked]:bg-input/60 border-border",
        "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50",
        "shrink-0 rounded-full border focus-visible:ring-[3px] aria-invalid:ring-[3px]",
        "data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-[18px] data-[size=sm]:w-8",
        "peer group/switch relative inline-flex items-center transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-0 transition-transform",
          "group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3.5",
          "translate-x-0.5",
          "group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=default]/switch:data-[state=checked]:translate-x-4",
          "group-data-[size=sm]/switch:data-checked:translate-x-[14px] group-data-[size=sm]/switch:data-[state=checked]:translate-x-[14px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
