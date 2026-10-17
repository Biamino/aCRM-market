# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** ASDEM
**Generated:** 2026-08-08 10:51:35
**Category:** E-commerce Luxury

---

## Global Rules

### Color Palette

Ключевой цвет — dusty lavender из лого ASDEM (`#B0A0C8`). Система собрана через 21st MCP theme **[Lavender Glass](https://21st.dev/community/themes/lavender-glass)** + ui-ux-pro-max (calm lavender / soft editorial).

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Brand (logo lavender) | `#B0A0C8` | `--color-brand` |
| Brand deep (CTA) | `#534D73` | `--color-brand-deep` |
| Lavender mid (CTA hover) | `#6B5FA8` | — |
| Theme primary | `#7D6EB7` | — |
| Brand soft | `#E8E5F9` | `--color-brand-soft` |
| On brand | `#FFFFFF` | `--color-on-brand` |
| Background / paper | `#F7F7FD` | `--color-paper` |
| Foreground / ink | `#303044` | `--color-ink` |
| Muted surface | `#F2F2F8` | `--color-muted` |
| Dim text | `#727284` | `--color-dim` |
| Border | `#E3E3ED` | `--color-line` |
| Destructive | `#DC2626` | — |

**Color Notes:** Cool lavender editorial — не peach/teal, не neon purple gradient. CTA на `brand-deep` (AA). Футер: lavender (`brand`) на ink.

### Typography

- **Heading Font:** Cormorant (luxury serif, близко к лого)
- **Body Font:** Montserrat
- **Mood:** luxury, fashion, refined, editorial
- **Google Fonts:** [Cormorant + Montserrat](https://fonts.google.com/share?selection.family=Cormorant:wght@400;500;600;700|Montserrat:wght@300;400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #534D73;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #6B5FA8;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #534D73;
  border: 2px solid #534D73;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #ECEBFF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E3E3ED;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #534D73;
  outline: none;
  box-shadow: 0 0 0 3px #534D7320;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Liquid Glass

**Keywords:** Flowing glass, morphing, smooth transitions, fluid effects, translucent, animated blur, iridescent, chromatic aberration

**Best For:** Premium SaaS, high-end e-commerce, creative platforms, branding experiences, luxury portfolios

**Key Effects:** Morphing elements (SVG/CSS), fluid animations (400-600ms curves), dynamic blur (backdrop-filter), color transitions

### Page Pattern

**Pattern Name:** Zara Editorial / Hero-Centric (ASDEM)

- **Conversion Strategy:** Brand-first full-bleed campaign screen, then product grid. Minimal chrome. Mobile-first.
- **CTA Placement:** Hero bottom-left — «Смотреть коллекцию» + secondary «Стать партнёром»
- **Section Order:** 1. Logo preloader (session), 2. Sticky centered-logo header + category rail, 3. Full-bleed hero (ASDEM + one headline + one line + CTA), 4. Catalog «New in», 5. Footer
- **Preloader:** Ink field + `asdem-logo.png`, mauve hairline, slide-up exit (~2.3s, once per session)
- **Hero budget:** Brand wordmark-level typography, one headline, one sentence, one CTA group — no cards/stats/overlays

---

## Anti-Patterns (Do NOT Use)

- ❌ Vibrant & Block-based
- ❌ Playful colors

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
