import React, { useId } from 'react'

import { cn } from '../../lib/utils'

export interface OrbitingCirclesProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  children?: React.ReactNode
  reverse?: boolean
  duration?: number
  delay?: number
  radius?: number
  path?: boolean
  iconSize?: number
  speed?: number
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed
  const gradientId = useId()
  return (
    <>
      {path && (
        <svg
          className="pointer-events-none absolute inset-0 size-full"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-border)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--color-background)" stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            className="stroke-1"
            cx="50%"
            cy="50%"
            fill="none"
            r={radius}
            stroke={`url(#${gradientId})`}
          />
        </svg>
      )}
      {React.Children.map(children, (child, index) => {
        const angle = (360 / React.Children.count(children)) * index
        return (
          <div
            className={cn(
              'absolute flex size-[var(--icon-size)] transform-gpu animate-orbit items-center justify-center rounded-full',
              { '[animation-direction:reverse]': reverse },
              className,
            )}
            style={
              {
                '--duration': calculatedDuration,
                '--radius': radius,
                '--angle': angle,
                '--icon-size': `${iconSize}px`,
              } as React.CSSProperties
            }
            {...props}
          >
            {child}
          </div>
        )
      })}
    </>
  )
}
