import React, { useRef, useCallback, useEffect } from "react"

export interface UseDragScrollOptions {
  enableWheel?: boolean
  speed?: number
}

/**
 * Hook providing smooth mouse drag-to-scroll and mouse wheel scrolling
 * for horizontally scrollable containers on desktop.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseDragScrollOptions = {}
) {
  const { enableWheel = true, speed = 1 } = options
  const ref = useRef<T | null>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const hasMovedRef = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only handle primary (left) mouse button click
    if (e.button !== 0 || !ref.current) return
    isDraggingRef.current = true
    hasMovedRef.current = false
    startXRef.current = e.pageX
    scrollLeftRef.current = ref.current.scrollLeft
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !ref.current) return
      const deltaX = e.pageX - startXRef.current
      if (Math.abs(deltaX) > 4) {
        hasMovedRef.current = true
      }
      ref.current.scrollLeft = scrollLeftRef.current - deltaX * speed
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setTimeout(() => {
          hasMovedRef.current = false
        }, 60)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [speed])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!enableWheel || !ref.current) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        ref.current.scrollLeft += e.deltaY
      }
    },
    [enableWheel]
  )

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return {
    ref,
    events: {
      onMouseDown,
      onWheel,
      onClickCapture,
      onDragStart,
    },
  }
}

