# DESIGN.md — AnamnezAl

Source of truth: `src/app/globals.css` (Tailwind v4 CSS-first, no config file), shadcn/ui on @base-ui/react.

## Color (OKLCH, light theme primary)

| Token | Value | Role |
|-------|-------|------|
| --background | oklch(0.984 0.004 235) | porcelain ivory |
| --foreground | oklch(0.180 0.024 240) | deep cool ink |
| --card | oklch(1 0 0) | white, slight elevation |
| --primary / --accent / --ring | oklch(0.420 0.080 218) | deep ocean, quiet trust |
| --secondary / --muted | oklch(0.952 0.008 235) | tinted neutral |
| --muted-foreground | oklch(0.452 0.020 240) | |
| --destructive | oklch(0.535 0.180 26) | |
| --success | oklch(0.555 0.110 165) | moss-jade, success only |
| --border / --input | oklch(0.900 0.010 235) | hairline |

Dark variants defined in `.dark`. Strategy: **Restrained** — tinted neutrals, single ocean accent. Module accents (teal/blue/purple) appear only as small identity marks (module cards, PDF headers), never as surface floods.

## Typography

- Display/heading: Instrument (`font-display`, serif) — page titles, stat numbers, often with an italic `<em class="text-primary">` word.
- Body/UI: Inter (`font-sans`). Mono: Geist.
- Micro-labels: `text-[11px] uppercase tracking-[0.22em] text-muted-foreground`.
- Page titles: `font-display text-[clamp(...)] leading-[1.02..1.05] tracking-tight`.

## Layout & rhythm

- Page shell: `TopBar` (h-14, max-w-5xl) + `main` `mx-auto max-w-5xl px-6 py-14 lg:py-20` (working screens may widen to max-w-6xl, tighten to py-10).
- Editorial blocks divided by hairline `border-border`, not boxed; hover rows use `hover:bg-secondary/40`.
- Panels that hold form controls: `rounded-lg border border-border bg-card p-5`.
- Radius scale from `--radius: 0.5rem`.

## Components & patterns

- shadcn/ui: button, input, label, card, table, badge, sonner, dropdown-menu, alert, separator, dialog, form. `cn()` from `src/lib/utils.ts`.
- Toasts: sonner (`toast.error/success/warning`), Turkish messages.
- Destructive/warning banners: `border-destructive/40 bg-destructive/5` + AlertTriangle icon.
- Buttons: lucide icon (h-4 w-4) + label, `gap-2`; primary actions `size="lg"`, tall CTAs `h-11`.
- Confidence/status: Badge with Yüksek/Orta/Düşük labels.
- Kicker pattern: `h-px w-7 bg-primary` line + tracked uppercase label above page titles.

## Motion

- Transitions: `transition-colors`, `duration-300 ease-out`; arrow nudge on hover (`group-hover:translate-x-1 -translate-y-1`).
- Spinners: `Loader2 animate-spin`. No bounce/elastic.

## PDF

- pdfmake, A4, Roboto. Section headers: dental teal `#0f766e`, hospital blue `#1e40af`. Footer: brand line + page numbers.
