'use client'

// Hook que retorna o tamanho atual da tela e o breakpoint ativo
// Usado para adaptar componentes ao mobile, tablet e desktop
import { useState, useEffect } from 'react'

interface WindowSize {
  width: number
  isMobile:  boolean // < 640px
  isTablet:  boolean // 640px – 1023px
  isDesktop: boolean // >= 1024px
}

export function useWindowSize(): WindowSize {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  return {
    width,
    isMobile:  width > 0 && width < 640,
    isTablet:  width >= 640 && width < 1024,
    isDesktop: width >= 1024,
  }
}
