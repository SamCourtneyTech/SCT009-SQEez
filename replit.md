# Digital Audio Sampling & Quantization Visualizer

## Overview
An interactive educational web application that visualizes digital audio sampling, quantization, and encoding processes in real-time. This tool demonstrates core DSP (Digital Signal Processing) concepts through three synchronized visualizations showing the original waveform with sample points, quantized/stepped waveform, and binary encoding stream.

## Purpose
Educational tool for understanding:
- How analog signals are converted to digital through sampling
- The effect of sample rate on signal capture
- Quantization and its impact on signal precision
- Binary encoding of audio data
- The relationship between bit depth and quantization levels

## Current State
**Phase**: Initial Development - Frontend Complete
- ✅ Schema and TypeScript interfaces defined
- ✅ All React components built with exceptional visual design
- ✅ Three canvas-based visualizations implemented
- ✅ Interactive control panel with sliders for sample rate and bit depth
- ✅ Real-time audio playback with Web Audio API
- ✅ Performance optimizations: requestAnimationFrame, canvas rendering
- ⏳ Backend (minimal - primarily frontend app)
- ⏳ Final integration and testing

## Recent Changes
- **2025-11-05**: Initial project setup
  - Created schema definitions for audio settings and quantization info
  - Built WaveformCanvas component with three visualization modes
  - Implemented ControlPanel with sliders and calculated metrics display
  - Created main Visualizer page with responsive layout
  - Configured design tokens and added SEO meta tags

## Features

### MVP Features (In Progress)
1. **Interactive Waveform Display**
   - Adjustable sample rate from 0.1 Hz to 88.2 kHz
   - Visual sample points overlaid on continuous sine wave
   - Vertical slice indicators showing sampling moments

2. **Quantization Visualization**
   - Bit depth control from 1-bit to 32-bit
   - Stepped waveform showing quantization levels
   - Visual representation of discrete levels

3. **Binary Encoding Display**
   - Real-time scrolling binary values
   - Color-coded by quantization value
   - Smooth animation showing encoding stream

4. **Audio Playback**
   - Play/pause control for hearing quantized audio
   - Web Audio API implementation
   - No anti-aliasing filters (educational demonstration)

5. **Calculated Metrics**
   - Quantization levels (2^n)
   - Nyquist frequency
   - Data rate estimation

### Technical Features
- Canvas-based rendering for 60fps performance
- requestAnimationFrame for smooth animations
- Responsive layout (desktop/tablet/mobile)
- Keyboard shortcuts (Space for play/pause)
- Accessibility features (ARIA labels, tooltips)

## Project Architecture

### Frontend Stack
- **React** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn UI** components (Button, Card, Slider, Tooltip)
- **Web Audio API** for audio generation and playback
- **Canvas API** for high-performance visualizations
- **Wouter** for routing

### Data Model
```typescript
interface AudioSettings {
  sampleRate: number;    // 0.1 Hz to 88.2 kHz
  bitDepth: number;      // 1-bit to 32-bit
  frequency: number;     // Audio frequency (440 Hz default)
  isPlaying: boolean;    // Playback state
}

interface QuantizationInfo {
  levels: number;              // 2^bitDepth
  nyquistFrequency: number;   // sampleRate / 2
  estimatedSize: number;      // bytes per second
}
```

### Component Structure
```
Visualizer (Main Page)
├── Header Bar (title, stats)
├── Control Panel (sidebar)
│   ├── Sample Rate Slider
│   ├── Bit Depth Slider
│   ├── Calculated Metrics Card
│   └── Play/Pause Button
└── Visualization Area
    ├── Original Waveform Canvas
    ├── Quantized Waveform Canvas
    └── Binary Encoding Canvas
```

### Key Files
- `client/src/pages/Visualizer.tsx` - Main application page
- `client/src/components/WaveformCanvas.tsx` - Canvas visualization component
- `client/src/components/ControlPanel.tsx` - Interactive controls
- `shared/schema.ts` - TypeScript interfaces and Zod schemas
- `design_guidelines.md` - Comprehensive design specifications

## Performance Optimizations
1. **Canvas Rendering**: All visualizations use Canvas API instead of DOM elements
2. **requestAnimationFrame**: Smooth 60fps animations
3. **Display Downsampling**: Adaptive sample display based on sample rate
4. **Efficient Redrawing**: Only redraw changed portions when possible
5. **Device Pixel Ratio**: Proper scaling for high-DPI displays

## Design System
- **Color Scheme**: Technical/scientific interface with subtle blues
- **Typography**: JetBrains Mono for code/numbers, Inter for UI
- **Layout**: Fixed full-screen, no scrolling
- **Spacing**: Consistent 4px base unit (Tailwind spacing)
- **Interactions**: Immediate feedback on all slider changes

## User Preferences
- Educational, function-first design
- Real-time responsiveness prioritized
- No anti-aliasing filters (to demonstrate aliasing)
- Clear visual distinction between sampling, quantization, and encoding

## Development Notes

### Performance Considerations
- Sample rates above 44.1 kHz may stress older hardware
- Binary encoding display adapts font size based on bit depth
- Visualization window duration adjusts based on sample rate
- Audio context sample rate clamped to browser-supported range (8-96 kHz)

### Educational Aspects
- Shows relationship between sample rate and Nyquist frequency
- Demonstrates quantization error visually
- Color-codes binary values to show different quantization levels
- Real-time audio lets users hear the effects of low bit depths

### Browser Compatibility
- Requires Web Audio API support
- Canvas 2D rendering
- requestAnimationFrame support
- Modern JavaScript features (ES2020+)

## Future Enhancements (Post-MVP)
- Waveform selection (sine, square, triangle, sawtooth)
- Custom audio file upload
- Zoom and pan controls for detailed inspection
- Frequency spectrum analyzer
- Side-by-side comparison mode
- Export functionality for audio and visualizations
- More advanced DSP concepts (filtering, modulation)
