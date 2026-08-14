'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'

// Achado real, 14/08/2026: o projeto Supabase que hospedava banner/avatar
// morreu (domínio nem resolve DNS mais) — qualquer `cover_url`/`image_url`
// gravado antes da migração pro storage próprio do VPS quebra em runtime,
// não em build (o campo no banco não é null, só a URL não carrega). `<Image
// unoptimized>` não tem prop de fallback nativa — sem isso, cai no ícone de
// "imagem quebrada" do navegador em vez de degradar bem.
//
// Ajuste de estado durante a própria renderização (padrão recomendado pelo
// React pra "resetar estado quando uma prop muda", sem Effect — o mesmo
// componente pode trocar de `src` sem remontar, ex: troca de item no
// carrossel reaproveitando a mesma posição) em vez de useEffect: evita o
// re-render em cascata que setState dentro de Effect causaria.
const FALLBACK_SRC = '/banner-placeholder.svg'

export function ImageWithFallback(props: ImageProps) {
  const [renderedSrc, setRenderedSrc] = useState(props.src)
  const [src, setSrc] = useState(props.src)

  if (props.src !== renderedSrc) {
    setRenderedSrc(props.src)
    setSrc(props.src)
  }

  return <Image {...props} src={src} onError={() => setSrc(FALLBACK_SRC)} />
}
