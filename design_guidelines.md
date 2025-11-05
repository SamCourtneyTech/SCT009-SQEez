# Design Guidelines: Digital Audio Sampling & Quantization Visualizer

## Design Approach
**System**: Custom technical/scientific interface inspired by audio engineering software (Pro Tools, Ableton) and data visualization tools (Observable, D3 dashboards). Prioritizing clarity, precision, and real-time responsiveness over aesthetic flourish.

**Core Principle**: Function-first educational tool where every pixel serves the learning experience.

## Layout System

### Grid Structure
- Full-screen application layout (no scrolling)
- Primary grid: 2-column layout on desktop (controls left 25%, visualizations right 75%)
- Stack to single column on mobile (controls top, visualizations below)
- Use Tailwind spacing: `p-4`, `gap-4`, `m-2` for tight, efficient spacing throughout

### Viewport Organization
```
Header Bar (h-16): Title + stats display
Main Area (remaining height):
  - Controls Panel (w-1/4): Sliders, numeric displays stacked vertically
  - Visualization Area (w-3/4): 3 stacked canvases of equal height
```

## Typography

**Font Stack**: 
- Primary: 'JetBrains Mono' or 'Roboto Mono' (monospace for technical precision)
- UI Labels: 'Inter' or 'system-ui' (sans-serif for controls)

**Hierarchy**:
- App Title: text-2xl font-bold
- Section Headers: text-sm font-semibold uppercase tracking-wide
- Numeric Displays: text-3xl font-mono tabular-nums (for sample rate, bit depth values)
- Labels: text-xs font-medium
- Binary Values: text-xs font-mono (scrolling display)

## Component Library

### Control Panel Components
**Sliders**: 
- Full-width range inputs with custom track styling
- Above each slider: Label (left) + Current value (right, large monospace)
- Below slider: Min/Max labels at extremes
- Spacing: `space-y-6` between slider groups

**Numeric Displays**:
- Calculated values (quantization levels) in bordered boxes
- Format: "Levels: 65,536" or "2^16"
- Box: `border rounded px-4 py-2`

**Playback Controls**:
- Single play/pause toggle button at bottom of controls
- Icon + label button style
- Width: full within panel

### Visualization Canvases

**Three Stacked Canvases** (equal height distribution):

1. **Original Waveform + Sample Points**
   - Continuous sine wave
   - Vertical lines at each sample point
   - Sample dots overlaid on waveform
   - Grid lines for amplitude reference

2. **Quantized Waveform**
   - Stepped/staircase waveform showing quantization levels
   - Horizontal lines showing each quantization level
   - Level count indicator overlay

3. **Binary Encoding Scroll**
   - Horizontal scrolling display of binary values
   - Each value in different hue (cycling through palette)
   - Monospace font for alignment
   - Recent values fade in from right

**Canvas Styling**:
- Bordered containers with subtle shadow
- Small padding: `p-2`
- Stack with `space-y-2`
- Each canvas labeled above with `text-xs font-semibold`

## Layout Specifications

### Header Bar
- Flex container: `flex items-center justify-between px-6 h-16`
- Left: App title + tagline
- Right: Real-time stats (sample rate, bit depth, file size estimate)

### Controls Panel (Left Sidebar)
- Fixed width on desktop: `w-80`
- Padding: `p-6`
- Vertical stack: `space-y-6`
- Sections:
  1. Sample Rate Slider + Display
  2. Bit Depth Slider + Display  
  3. Calculated Metrics (levels, Nyquist frequency)
  4. Playback Controls

### Visualization Area (Main)
- Flex-grow to fill remaining space
- Padding: `p-4`
- Three canvases in vertical stack
- Each canvas: `h-1/3` of parent, `w-full`

## Responsive Behavior

**Desktop (>1024px)**: Side-by-side layout as described
**Tablet (768-1024px)**: Reduce control panel to `w-64`, smaller text
**Mobile (<768px)**: 
- Stack vertically
- Controls become collapsible drawer or top section
- Canvases stack full-width
- Reduce canvas heights: each `h-48`

## Performance Optimizations (Layout Impact)

- Fixed canvas dimensions to avoid reflow
- Absolute positioning for overlay elements (sample points, grid lines)
- Minimize DOM updates: use canvas rendering, not HTML elements for waveforms
- Binary scroll container: `overflow-hidden` with transform-based animation

## Accessibility

- All sliders have `aria-label` with units
- Numeric displays use `aria-live="polite"` for screen readers
- Canvas elements have `aria-label` describing current state
- Keyboard controls: Space (play/pause), Arrow keys (adjust sliders)

## Key UX Patterns

**Immediate Feedback**: All slider changes instantly update all visualizations
**Visual Linking**: Use subtle connection lines or indicators showing how sample rate affects the waveform visualization
**Educational Annotations**: Small info icons (`i` in circles) next to technical terms with tooltips
**Value Precision**: Show both exponential (2^16) and decimal (65,536) for bit depth calculations

## No Hero Section
This is a utility application - launch directly into the working interface with header identification only.