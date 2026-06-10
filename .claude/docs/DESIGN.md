---
name: Memory Tree Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424754'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#924700'
  on-tertiary: '#ffffff'
  tertiary-container: '#b75b00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  space-xs: 4px
  space-sm: 8px
  space-md: 16px
  space-lg: 24px
  space-xl: 40px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 16px
---

## Brand & Style
The design system is rooted in **Productivity-focused Minimalism**. It is designed for a desktop-first knowledge memorization environment where cognitive load must be minimized to facilitate deep learning. The aesthetic is clean, professional, and lightweight, prioritizing content clarity over decorative elements.

The UI evokes a sense of organization and calm, utilizing vast whitespace and a restrained color palette to create a "digital sanctuary" for information. The experience should feel fast, systematic, and intentional, mirroring the structured nature of memory and knowledge mapping.

## Colors
The palette is intentionally restrained to keep the focus on user-generated content.
- **Primary Blue (#3B82F6):** Used exclusively for high-priority actions, active states, and progress indicators. It serves as a visual "pathfinder" in a sea of neutrals.
- **Neutral Foundation:** We use a range of Slate grays for typography and borders. The background is pure white (#FFFFFF), with soft grays (#F8FAFC) used for structural grouping like sidebars or card containers.
- **Semantic Accents:** Success, warning, and error states should use desaturated versions of green, amber, and red to maintain the professional, understated tone.

## Typography
This design system utilizes **Inter** for its exceptional legibility and systematic feel.
- **Headlines:** Use semi-bold weights with tighter letter spacing to create a strong visual anchor for modules and nodes.
- **Body Text:** Set with generous line height (1.5 - 1.6) to ensure long-form notes are readable and reduce eye strain during study sessions.
- **Labels:** Used for metadata, tags, and small UI controls. These are slightly tracked out and use medium weights to maintain legibility at small sizes.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The main navigation and sidebar are fixed-width to ensure tool accessibility, while the central workspace (the "Tree") expands fluidly up to a maximum container width of 1280px.

- **Grid:** A 12-column grid is used for dashboard views. For the knowledge editor, a single centered column with wide margins is preferred to promote focus.
- **Spacing Rhythm:** Based on a 4px baseline. Most components use 16px (md) or 24px (lg) padding to maintain an open, airy feel.
- **Mobile Adaptivity:** On smaller screens, sidebars transition into off-canvas drawers, and horizontal margins shrink to 16px.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Low-Contrast Outlines** rather than heavy shadows.
- **Level 0 (Base):** Pure white background.
- **Level 1 (Surface):** Soft gray (#F8FAFC) used for sidebars or secondary content blocks.
- **Level 2 (Float):** Cards and modals use a subtle 1px border (#E2E8F0). A very soft, diffused shadow (0px 4px 12px rgba(0,0,0,0.03)) is used only for elements that require immediate user interaction, such as dropdowns or active modals.
- **Focus States:** Elements being edited receive a 2px Primary Blue border to denote "active" status in the knowledge graph.

## Shapes
The shape language is modern and approachable.
- **Standard UI (Buttons, Inputs, Cards):** Use a 0.5rem (8px) radius. This provides a soft, professional look that isn't overly "bubbly."
- **Interactive Nodes:** Elements representing "Memory Nodes" use the `rounded-lg` (16px) setting to distinguish them from standard UI containers.
- **Search & Badges:** Use "Pill" shapes (999px) for search bars and status chips to suggest fluid movement and quick categorization.

## Components
- **Buttons:** Primary buttons are solid Blue (#3B82F6) with white text. Secondary buttons use a subtle gray border with Primary Blue text. Interaction states (hover) should involve a slight darkening of the color.
- **Input Fields:** Minimalist design with a 1px Slate-200 border. Upon focus, the border transitions to Primary Blue with a soft 2px blue outer glow.
- **Chips/Tags:** Small, rounded-full containers with light gray backgrounds and dark gray text. Used for categorizing memory nodes.
- **Cards:** White background with a 1px Slate-200 border. No shadow in rest state; subtle shadow on hover to indicate interactivity.
- **Tree Nodes:** Specialized components for this system. They should feature a left-aligned blue accent bar when selected, reinforcing the "Tree" metaphor.
- **Progress Bars:** Thin, 4px height bars using Primary Blue to show memorization strength or deck completion.

## Canvas Node Color Coding

Canvas nodes are color-coded based on the most recent test attempt result. This provides instant visual feedback on learning progress without requiring the user to open any panel.

| State | Color | Hex |
|-------|-------|-----|
| Success | Green | `#22c55e` |
| Fail | Red | `#ef4444` |
| Partial | Orange | `#f97316` |
| Not attempted | Gray | Default surface color |

- **QA nodes** reflect their own latest attempt result directly.
- **Category nodes** display a representative color derived from the aggregated results of their descendant QA nodes (e.g., majority-rule or worst-case coloring).
- Color fills should be applied as a semi-transparent tint on the node body, keeping the label readable. Use `opacity: 0.85` on the fill and ensure the node label text uses a contrasting dark color.

## Color Contrast & Accessibility

All UI elements must pass a minimum contrast ratio of 4.5:1 (WCAG AA) for normal text.

Known rules:
- **"Hide Answer" / "정답 가리기" button**: Must use a clearly distinct background and text color. Do not use the same primary blue for both the button fill and label. Recommended: white label on solid blue, or outlined button with blue label on white.
- **Floating panel buttons (e.g., View Card)**: Panel buttons rendered on white or light backgrounds must use a visible border (`#E2E8F0` or darker) — never white-on-white.
- Before shipping any UI change, visually verify that no text, icon, or border disappears into the background.

## Design Language Consistency — All Screens

The main canvas explorer screen sets the visual baseline. All other screens must align with it.

### Shared Visual Tokens (apply to all three screens)
- **Background:** `#f7f9fb` (surface) with the subtle radial-grid texture used in the canvas (optional on non-canvas screens but the tone must match).
- **Surface Cards:** Light glassmorphism-lite style — `background: rgba(255,255,255,0.85)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(226,232,240,0.8)`, `border-radius: 12px`.
- **Typography:** Inter throughout; headlines use `font-weight: 600`, body uses `font-weight: 400`, labels use `font-weight: 500`.
- **Button Style:** Consistent primary (solid blue), secondary (outlined gray), and destructive (red outlined) variants across all screens.

### Q&A List Screen
The list screen should feel like a "reading surface" that extends from the same design space as the canvas.
- Use the same background color and card elevation as the canvas floating panels.
- Category path breadcrumb and sort/filter controls should use the same chip and dropdown styles as the canvas toolbar.
- Q&A cards use the shared card style above; the result emoji and last-attempt date are displayed as muted labels below the answer.

### Test (Flashcard) Screen
The test screen should feel immersive yet consistent with the rest of the app.
- The flashcard container uses the shared card style with a slightly larger `border-radius: 16px` and a gentle drop shadow to give it a "lifted" feel.
- Progress bar at the bottom uses Primary Blue (`#3B82F6`), height 4px, matching the canvas progress indicators.
- Self-evaluation buttons (Fail / Partial / Success) use semantic colors (red / orange / green) with white labels, matching the canvas node color palette.