# DESIGN SYSTEM — TIPO7

Documentação técnica completa da interface do produto.  
Data de geração: 2026-07-08

---

## 1. Design System

**Design system proprietário custom** — sem uso de shadcn/ui, Radix UI, Mantine, Chakra, MUI ou qualquer biblioteca de componentes pré-construída.

Todos os componentes (botões, cards, modais, dropdowns, tabs, tabelas, sidebars) foram construídos do zero usando Tailwind CSS v4.

---

## 2. Estilo Visual

**"Midnight Minimal with Gold Accent"**

| Atributo | Descrição |
|----------|-----------|
| Tema | Dark Mode premium (preto profundo) |
| Personalidade | Minimalista, limpo, geométrico |
| Destaque | Dourado brilhante como único accent |
| Inspiração | Stripe, Linear, Vercel |
| Filosofia | Máxima clareza com mínimo de ruído visual |

---

## 3. Framework CSS

- **Tailwind CSS v4** (`^4`)
- Plugin: `@tailwindcss/postcss` (`^4`)
- Integração: PostCSS via `postcss.config.mjs`
- **Não usa**: CSS Modules, styled-components, Sass, Less

---

## 4. Biblioteca de Componentes

**Nenhuma.** 100% custom-built.

| Biblioteca | Utilizada? |
|------------|-----------|
| shadcn/ui | ❌ |
| Radix UI | ❌ |
| Headless UI | ❌ |
| Material UI | ❌ |
| Chakra UI | ❌ |
| Mantine | ❌ |

---

## 5. Biblioteca de Ícones

**Lucide React** (`^1.18.0`)

Ícones utilizados na plataforma:

| Categoria | Ícones |
|-----------|--------|
| Navegação | `LayoutDashboard`, `Menu`, `X`, `ChevronDown`, `ChevronLeft`, `ChevronRight` |
| Usuários | `UsersRound`, `Users`, `UserCheck`, `User`, `Briefcase` |
| Financeiro | `DollarSign`, `ReceiptText`, `Landmark` |
| Eventos | `Calendar`, `CalendarRange`, `Ticket`, `Building2`, `Clapperboard`, `Megaphone` |
| Utilidade | `Copy`, `Check`, `Trash2`, `Plus`, `ArrowRight`, `MapPin`, `Navigation`, `Loader2`, `FolderPlus`, `ImageIcon`, `Lightbulb`, `FileText`, `Shield`, `Layers`, `Settings2` |

Tamanhos típicos: `12px` a `28px` via prop `size`.

---

## 6. Biblioteca de Gráficos

**Nenhuma.** O dashboard usa:
- Cards com métricas numéricas (counters animados)
- Barras de progresso simples via `div` com background

Sem Chart.js, Recharts, Visx, Victory, Nivo ou similares.

---

## 7. Fontes

Carregadas via `next/font/google` no `layout.tsx` raiz (zero CLS, display swap):

| Fonte | Uso | Pesos | CSS Variable |
|-------|-----|-------|-------------|
| **Syne** | Logo, branding, números de destaque | 600, 700, 800 | `--font-syne` / `--font-display` |
| **Outfit** | Títulos, headings, nomes de eventos | 300, 400, 500, 600 | `--font-outfit` / `--font-heading` |
| **DM Sans** | Corpo, UI geral, textos de interface | 400, 500, 600 | `--font-dm-sans` / `--font-body` |

```css
--font-display: var(--font-syne);
--font-heading: var(--font-outfit);
--font-body:    var(--font-dm-sans);
```

---

## 8. Paleta Completa de Cores

### Tokens raiz (`:root` em `globals.css`)

| Token | HEX | Uso |
|-------|-----|-----|
| `--background` | `#070707` | Fundo principal da aplicação |
| `--surface` | `#111111` | Superfície de cards e containers |
| `--surface-hover` | `#1a1a1a` | Estado hover de cards |
| `--border` | `#222222` | Bordas de elementos |
| `--gold` | `#E8B84B` | Cor primária de marca (accent) |
| `--gold-hover` | `#F0C96A` | Estado hover do gold |
| `--gold-muted` | `rgba(232,184,75,0.15)` | Overlay/fundo suave do gold |
| `--text-primary` | `#F5F5F5` | Texto principal |
| `--text-secondary` | `#888888` | Texto secundário |
| `--text-muted` | `#444444` | Texto desabilitado/muted |

### Variantes inline usadas em componentes

| HEX | Uso |
|-----|-----|
| `#0a0a0a` | Background do sidebar admin |
| `#0d0d0d` | Background de cards do admin |
| `#111111` | Surface padrão |
| `#1a1a1a` | Hover de items de lista |
| `#2a2a2a` | Hover de cards públicos |
| `#222222` | Bordas sutis |
| `#333333` | Subtextos de cards |
| `#444444` | Texto muted |
| `#555555` | Labels uppercase |
| `#888888` | Texto secundário |
| `#d4a73e` | Variante hover do gold |
| `#E8B84B` | Gold padrão |
| `#F0C96A` | Gold claro (hover) |

### Cores de status (hardcoded em componentes)

| Cor | HEX | Uso |
|-----|-----|-----|
| Verde | `#4ade80` | Aprovado, ativo, gratuito |
| Vermelho | `#f87171` / `#ef4444` | Cancelado, erro |
| Azul | `#60a5fa` | Informativo |
| Roxo | `#a855f7` | Accent secundário |
| Laranja | `#f97316` | Accent terciário |
| Rosa | `#ec4899` | Accent quaternário |
| Ciano | `#06b6d4` | Accent quinto |
| Amarelo | `#eab308` | Accent sexto |

### Opacidades do gold utilizadas

`#E8B84B` com sufixos Tailwind: `/8`, `/10`, `/12`, `/15`, `/20`, `/25`, `/30`, `/40`

---

## 9. Espaçamentos

### Padding mais utilizados

| Classe Tailwind | Valor px | Contexto |
|-----------------|----------|---------|
| `p-3` | 12px | Itens de nav, chips |
| `p-4` | 16px | Cards menores |
| `p-5` | 20px | Cards padrão |
| `p-6` | 24px | Cards do admin |
| `p-8` | 32px | Seções de conteúdo |
| `px-3 py-2` | 12/8px | Inputs e botões pequenos |
| `px-3 py-2.5` | 12/10px | Inputs padrão |
| `px-4 py-2.5` | 16/10px | Botões padrão |
| `px-4 py-3` | 16/12px | Botões grandes |
| `px-5` / `py-5` | 20px | Logo/header sections |

### Gap mais utilizados

| Classe | Valor | Contexto |
|--------|-------|---------|
| `gap-0.5` | 2px | Items muito próximos (nav) |
| `gap-1` | 4px | Micro-gaps |
| `gap-2` | 8px | Labels + ícones |
| `gap-3` | 12px | Items de lista |
| `gap-4` | 16px | Grid de cards |
| `gap-5` | 20px | Seções |
| `gap-8` | 32px | Grupos grandes |
| `gap-10` | 40px | Seções amplas |

---

## 10. Border Radius

| Classe | Valor | Uso |
|--------|-------|-----|
| `rounded-lg` | 8px | Inputs pequenos, elementos menores |
| `rounded-xl` | 12px | Botões, cards pequenos, dropdowns |
| `rounded-2xl` | 16px | Cards principais, containers, modais |
| `rounded-3xl` | 24px | Grandes seções (PromoterCTA) |
| `rounded-full` | 9999px | Chips, avatares, botões circulares, dots do carrossel |

---

## 11. Sombras

| Contexto | Classe / CSS | Descrição |
|----------|-------------|-----------|
| Dropdown / menus | `shadow-xl shadow-black/50` | Sombra profunda preta 50% |
| Overlay | `shadow-black/60` | Overlay escuro |
| Efeito glow dourado | `radial-gradient(circle, #E8B84B18, transparent 65%)` | Background blur, não shadow |
| Cards | Sem shadow | Usam apenas `border` (1px) |

---

## 12. Tipografia

### Escala de tamanhos

| Classe | px | Uso |
|--------|-----|-----|
| `text-[10px]` | 10 | Labels ultra-pequenos, badges |
| `text-[11px]` | 11 | Labels uppercase, meta info |
| `text-xs` | 12 | Descrições, texto secundário |
| `text-sm` | 14 | UI geral, subtítulos, tabelas |
| `text-base` | 16 | Corpo padrão |
| `text-lg` | 18 | Headings pequenos |
| `text-xl` | 20 | Títulos médios |
| `text-2xl` | 24 | Headings de cards |
| `text-3xl` | 28–30 | Números de destaque (counters) |
| `text-4xl` | 36 | Headings XL |
| `text-[44px]` | 44 | Heading principal da landing |

### Pesos

| Classe | Valor | Uso |
|--------|-------|-----|
| `font-normal` | 400 | Corpo de texto |
| `font-medium` | 500 | Ênfase moderada, nav items |
| `font-semibold` | 600 | Títulos, botões, labels |
| `font-bold` | 700 | Números grandes |
| `font-extrabold` | 800 | Logo "tipo7", headings XL |

### Line Height

| Classe | Valor | Uso |
|--------|-------|-----|
| `leading-snug` | ~1.275 | Titles, cards |
| `leading-normal` | ~1.5 | Padrão |
| `leading-relaxed` | ~1.625 | Textos explicativos |
| `leading-loose` | 1.8 | Prosa longa, textos legais |

### Letter Spacing

| Classe | Valor | Uso |
|--------|-------|-----|
| `tracking-normal` | 0 | Padrão |
| `tracking-wide` | 0.05em | Títulos, labels |
| `tracking-widest` | 0.1em | Labels UPPERCASE, badges de status |

---

## 13. Grid / Layout

### Estrutura do Admin

```
<div class="flex h-screen">
  <aside class="w-52 shrink-0">  ← AdminSidebar
  <main class="flex-1 overflow-y-auto">
    <div class="p-8 max-w-4xl">  ← Conteúdo das páginas
```

### Estrutura do Promotor

```
<div class="flex flex-col min-h-screen">
  <Header />                           ← h-[60px], fixed
  <div class="flex flex-1 pt-[60px]">
    <PromoterSidebar />                ← hidden md:flex, w-52, sticky
    <main class="flex-1 p-8">
      <TabsMobile />                   ← md:hidden
```

### Grid de Cards

| Contexto | Grid | Colunas |
|----------|------|---------|
| Cards admin | `grid grid-cols-2 gap-4` | 2 |
| Cards promotor | `grid sm:grid-cols-2 lg:grid-cols-3 gap-4` | 1→2→3 |
| Eventos público | `grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` | 1→2→3→4 |

### Breakpoints (Tailwind defaults)

| Token | Largura |
|-------|---------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

### Max Widths utilizados

| Classe | Valor | Contexto |
|--------|-------|---------|
| `max-w-3xl` | ~48rem | Landing, páginas simples |
| `max-w-4xl` | ~56rem | Painel admin/promotor |
| `max-w-6xl` | ~72rem | Listagem pública |
| `max-w-7xl` | ~80rem | Layout full-width |

---

## 14. Tokens de Design

### CSS Variables completas (`:root`)

```css
/* Fundo */
--background:    #070707;
--surface:       #111111;
--surface-hover: #1a1a1a;
--border:        #222222;

/* Marca */
--gold:          #E8B84B;
--gold-hover:    #F0C96A;
--gold-muted:    rgba(232, 184, 75, 0.15);

/* Texto */
--text-primary:   #F5F5F5;
--text-secondary: #888888;
--text-muted:     #444444;

/* Tipografia */
--font-display: var(--font-syne);
--font-heading: var(--font-outfit);
--font-body:    var(--font-dm-sans);
```

### @theme inline (Tailwind v4)

```css
@theme inline {
  --color-background:  var(--background);
  --color-foreground:  var(--text-primary);
  --color-gold:        var(--gold);
  --color-gold-hover:  var(--gold-hover);
  --color-gold-muted:  var(--gold-muted);
  --color-surface:     var(--surface);
  --color-border:      var(--border);
  --font-sans:         var(--font-body);
  --font-display:      var(--font-display);
}
```

> Espaçamentos, border-radius e breakpoints usam os defaults do Tailwind (sem extensão custom).

---

## 15. Animações

### Transições

| Propriedade | Duração | Uso |
|------------|---------|-----|
| `transition-all duration-150` | 150ms | Hover de cores |
| `transition-all duration-200` | 200ms | Interações rápidas (hover, toggle, rotação) |
| `transition-all duration-300` | 300ms | Header scroll, dropdowns, fade |
| `transition-all duration-500` | 500ms | Carrossel, slides |
| `transition-colors duration-200` | 200ms | Hover de links e botões |
| `transition-opacity duration-300` | 300ms | Fade de overlays |
| `transition-transform duration-200` | 200ms | Rotação de chevrons, ícones |

### Transformações CSS (hover)

| Classe | Efeito |
|--------|--------|
| `hover:rotate-12` | Rotação do ícone de ingresso na logo |
| `hover:translate-x-0.5` | Seta deslizando em botões |
| `hover:-translate-y-0.5` | Card subindo sutilmente |
| `group-hover:opacity-100` (de `opacity-0`) | Fade in de botões delete |
| `group-hover:rotate-180` | Chevron rotaciona em menus expansíveis |

### Animações nativas Tailwind

| Classe | Uso |
|--------|-----|
| `animate-spin` | Ícone `Loader2` (loading states) |
| `animate-pulse` | Skeleton loading do header |

### Animação custom (JS)

```typescript
// Counter animado em StatsBar.tsx
const ease = 1 - Math.pow(1 - progress, 3); // Ease out cúbico
const duration = 1400; // 1,4 segundos
```

### Scroll

```css
html { scroll-behavior: smooth; }
```

---

## 16. Estrutura dos Componentes Principais

### A. AdminSidebar (`AdminSidebar.tsx`) — CUSTOM

```
aside (w-52, bg-#0a0a0a, border-right #1a1a1a)
├── Logo section (px-5 py-5, border-bottom)
├── Nav (flex-1, p-3, gap-0.5)
│   ├── Links simples (Dashboard, Roadmap)
│   ├── Grupo "Players" (expansível via useState)
│   │   ├── Usuários
│   │   ├── Promotores
│   │   └── Estabelecimentos
│   ├── Grupo "Entretenimento" (expansível)
│   │   ├── Eventos
│   │   ├── Marketing
│   │   ├── Atributos
│   │   └── Funções
│   └── Grupo "Financeiro" (expansível)
│       ├── Tarifas
│       └── Bancos
└── User info (p-4, border-top)
```

- Ícones: Lucide React (12–14px)
- Estado: `useState` para expand/collapse
- Cor ativa: `#E8B84B` (gold) em texto e ícone

---

### B. Header (`Header.tsx`) — CUSTOM

```
header (fixed top-0, h-[60px], z-50, backdrop-blur-md ao rolar)
├── Logo "tipo7" (Syne 800, hover glow dourado)
│   └── Ticket icon (rotate-12 no hover)
├── LocationChip (center, oculto no mobile)
│   └── MapPin icon + cidade detectada
└── Auth area (right)
    ├── Não logado: botão "Entrar" (bg-gold, rounded-xl)
    └── Logado: User menu
        ├── Avatar (w-7 h-7, rounded-full, bg-gold)
        ├── Seta ChevronDown (rotate-180 no open)
        └── Dropdown (w-52, bg-#0d0d0d, rounded-2xl)
            ├── Área do comprador
            ├── Área do promotor
            └── Sair
```

- Mobile: hamburger menu (`Menu` icon) → overlay full-screen
- Backdrop: `backdrop-blur-sm` (normal) / `backdrop-blur-md` (scrolled)

---

### C. EventCard (`EventGrid.tsx`) — CUSTOM

```
a (rounded-2xl, border-#1a1a1a, hover:border-#2a2a2a)
├── Image container (aspect-video, bg gradient fallback)
│   └── img ou ImageIcon placeholder
└── Info (p-4, gap-3)
    ├── Title (text-sm, line-clamp-2, font-outfit)
    ├── Meta (Calendar + MapPin, text-[11px], #888)
    └── Price badge (rounded-xl, font-syne)
        ├── Verde: "Gratuito"
        ├── Cinza: "Sem preço"
        └── Gold: "R$ X,00"
```

---

### D. Admin Dashboard Cards — CUSTOM

```
div (rounded-2xl, p-6, bg-#0d0d0d, border-#1a1a1a)
├── Header (flex justify-between, mb-4)
│   ├── Label (text-xs, uppercase, letter-spacing-widest, #555)
│   └── Icon badge (w-8 h-8, rounded-xl, cor temática)
├── Value (text-3xl, font-syne, font-bold)
└── Subtitle (text-xs, #333)
```

Grid: `grid-cols-2 gap-4`

---

### E. Tabelas Admin — CUSTOM

```
div (rounded-2xl, overflow-hidden, border-#1a1a1a)
└── table (w-full)
    ├── thead (bg-#0d0d0d, border-bottom)
    │   └── th (px-4 py-3, text-xs, uppercase, #444)
    └── tbody
        └── tr (bg-#070707, border-bottom #111)
            └── td (px-4 py-3)
                ├── Texto: cores por tipo
                └── Status badges: span com cor + bg correspondentes
```

---

### F. PromoterLayout — CUSTOM

```
div (flex flex-1)
├── Sidebar desktop (hidden md:flex, w-52, sticky top-[60px])
│   ├── Links: Dashboard, Eventos (expansível), Marketing, Configurar
│   └── Mesma lógica expand/collapse que AdminSidebar
└── Main
    ├── Tab bar mobile (md:hidden, border-bottom, overflow-x-auto)
    │   ├── Dashboard
    │   ├── Eventos
    │   └── Configurar
    └── {children}
```

---

### G. Carousel (`Carousel.tsx`) — CUSTOM

```
section (relative, overflow-visible)
├── Título (text-xs, uppercase, tracking-widest)
├── Container (relative, flex, items-center)
│   └── Cards com transform 3D
│       ├── Centro: full-size (scale 1.0)
│       ├── Laterais: scale reduzida
│       └── Botões nav (rounded-full, backdrop-blur)
├── Info do evento (mt-5, text-center)
│   ├── Título
│   ├── Local + data
│   └── CTA "Ver evento" (border-gold, rounded-xl)
└── Dots (flex gap-2, rounded-full, bg-gold ativo)
```

- Responsive: config muda por breakpoint (`sm`, `lg`)
- Touch: event listeners para swipe
- Auto-play: `setInterval` com pause no hover

---

## Resumo: Custom vs. Biblioteca

| Componente | Origem | Nota |
|-----------|--------|------|
| Todos os componentes UI | **100% Custom** | Zero bibliotecas de componentes |
| Ícones | **Lucide React** `^1.18.0` | Biblioteca |
| Gráficos | **Nenhuma** | Cards + barras custom |
| Fontes | **Google Fonts** via `next/font` | Next.js built-in |
| CSS | **Tailwind CSS v4** | Framework |
| Animações | **CSS nativo + JS** | Custom |
| Tokens | **CSS Variables** + **Tailwind @theme** | Custom |

---

## Arquivos Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/app/globals.css` | CSS variables, fonte base, scrollbar, scroll behavior |
| `src/app/layout.tsx` | Carregamento das 3 fontes Google, providers globais |
| `postcss.config.mjs` | Tailwind v4 via PostCSS |
| `src/app/admin/layout.tsx` | Estrutura do painel admin (sidebar + content) |
| `src/components/AdminSidebar.tsx` | Sidebar admin com menus expansíveis |
| `src/components/PromoterLayout.tsx` | Layout do painel do promotor com sidebar + tabs mobile |
| `src/components/Header.tsx` | Header global com nav, auth e mobile menu |
| `src/components/Carousel.tsx` | Carrossel de destaque da landing page |
| `src/components/EventGrid.tsx` | Grid de cards de eventos |
| `package.json` | Dependências: Tailwind v4, Lucide React, etc. |
