'use client'

import * as React from 'react'
import * as ResizablePrimitive from 'react-resizable-panels'
import { cn } from '../../lib/utils'
import IconComponent from '../global/icon-component'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      data-slot="resizable-panel-group"
      {...props}
    />
  )
}

const ResizablePanel = React.forwardRef<
  ResizablePrimitive.ImperativePanelHandle,
  React.ComponentProps<typeof ResizablePrimitive.Panel>
>(({ ...props }, ref) => (
  <ResizablePrimitive.Panel data-slot="resizable-panel" ref={ref} {...props} />
))
ResizablePanel.displayName = 'ResizablePanel'

function ResizableHandle({
  withHandle,
  handle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
  handle?: React.ReactNode
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      className={cn(
        'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className,
      )}
      data-slot="resizable-handle"
      {...props}
    >
      {withHandle &&
        (handle ?? (
          <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
            <IconComponent className="size-2.5" icon="GripVertical" />
          </div>
        ))}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
