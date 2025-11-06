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
**Phase**: Feature Development - Core Features Complete
- ✅ Schema and TypeScript interfaces defined
- ✅ All React components built with exceptional visual design
- ✅ Three canvas-based visualizations implemented
- ✅ Interactive control panel with sliders for sample rate and bit depth
- ✅ Real-time audio playback with Web Audio API
- ✅ Performance optimizations: requestAnimationFrame, canvas rendering, display downsampling
- ✅ Waveform selection (sine, square, triangle, sawtooth)
- ✅ Custom audio file upload and playback
- ✅ Zoom and pan controls for detailed inspection
- ⏳ Backend (minimal - primarily frontend app)
- ⏳ Additional features (spectrum analyzer, comparison mode, export)

## Recent Changes
- **2025-11-06**: Waveform selection and custom audio upload
  - Added waveform type selector with 4 waveform types (sine, square, triangle, sawtooth)
  - Implemented custom audio file upload with Web Audio API decoding
  - Created getSampleValue() helper to read from audio buffer or generate waveform
  - Audio playback switches between BufferSourceNode (custom) and OscillatorNode (generated)
  - Proper client-only AudioBuffer state management

- **2025-11-06**: Zoom and pan controls
  - Implemented zoom slider (1x to 100x magnification)
  - Added pan left/right buttons with 10% step increments
  - Created reset view button to restore default zoom/pan
  - Modified canvas rendering with zoom-dependent display duration
  - Synchronized zoom/pan across all three visualizations
  - Proper pan offset range (0-1) with zoom scaling in timeOffset calculation

- **2025-11-05**: Initial project setup
  - Created schema definitions for audio settings and quantization info
  - Built WaveformCanvas component with three visualization modes
  - Implemented ControlPanel with sliders and calculated metrics display
  - Created main Visualizer page with responsive layout
  - Configured design tokens and added SEO meta tags

## Features

### Implemented Features
1. **Interactive Waveform Display**
   - Adjustable sample rate from 0.1 Hz to 88.2 kHz
   - Visual sample points overlaid on continuous waveform
   - Vertical slice indicators showing sampling moments
   - Zoom: 1x to 100x magnification for detailed inspection
   - Pan: Navigate through zoomed view with left/right controls

2. **Waveform Selection**
   - Sine wave (smooth sinusoidal)
   - Square wave (alternating high/low with sharp transitions)
   - Triangle wave (linear ramps up and down)
   - Sawtooth wave (linear ramp up, sharp drop)
   - Custom audio file upload (WAV, MP3, etc.)

3. **Quantization Visualization**
   - Bit depth control from 1-bit to 32-bit
   - Stepped waveform showing quantization levels
   - Visual representation of discrete levels
   - Real-time quantization error demonstration

4. **Binary Encoding Display**
   - Real-time scrolling binary values
   - Color-coded by quantization value
   - Smooth animation showing encoding stream
   - Adapts to bit depth (1-32 bits)

5. **Audio Playback**
   - Play/pause control for hearing quantized audio
   - Web Audio API implementation
   - ScriptProcessorNode for real-time quantization
   - Works with both generated and uploaded audio
   - No anti-aliasing filters (educational demonstration)

6. **Calculated Metrics**
   - Quantization levels (2^n)
   - Nyquist frequency (sampleRate / 2)
   - Data rate estimation (bytes per second)

### Technical Features
- Canvas-based rendering for 60fps performance
- requestAnimationFrame for smooth animations
- Display downsampling (max 500 samples/frame for performance)
- Responsive layout (desktop/tablet/mobile)
- Keyboard shortcuts (Space for play/pause)
- Accessibility features (ARIA labels, tooltips, data-testid attributes)
- Synchronized visualizations across zoom/pan operations

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
type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';

interface AudioSettings {
  sampleRate: number;      // 0.1 Hz to 88.2 kHz
  bitDepth: number;        // 1-bit to 32-bit
  frequency: number;       // Audio frequency (440 Hz default)
  isPlaying: boolean;      // Playback state
  waveformType: WaveformType;  // Selected waveform shape
}

interface QuantizationInfo {
  levels: number;              // 2^bitDepth
  nyquistFrequency: number;   // sampleRate / 2
  estimatedSize: number;      // bytes per second
}

// Client-only state (not in shared schema):
// - audioBuffer: AudioBuffer | null  // Uploaded custom audio
// - zoomLevel: number (1-100)        // Magnification level
// - panOffset: number (0-1)          // Pan position (normalized)
```

### Component Structure
```
Visualizer (Main Page)
├── Header Bar (title, stats)
├── Control Panel (sidebar)
│   ├── Sample Rate Slider (0.1 Hz - 88.2 kHz)
│   ├── Bit Depth Slider (1-32 bits)
│   ├── Waveform Type Selector (dropdown)
│   ├── Custom Audio Upload (file input)
│   ├── Zoom Slider (1x - 100x)
│   ├── Pan Controls (left/right buttons + reset)
│   ├── Calculated Metrics Card
│   └── Play/Pause Button
└── Visualization Area
    ├── Original Waveform Canvas (with sample points)
    ├── Quantized Waveform Canvas (with step levels)
    └── Binary Encoding Canvas (scrolling binary stream)
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

## Completed Post-MVP Features
- ✅ Waveform selection (sine, square, triangle, sawtooth)
- ✅ Custom audio file upload with Web Audio API decoding
- ✅ Zoom and pan controls for detailed waveform inspection (1x-100x, pan with buttons)

## Planned Future Enhancements
- ⏳ Frequency spectrum analyzer with FFT
- ⏳ Side-by-side comparison mode (original vs quantized)
- ⏳ Export functionality (audio as WAV, visualizations as PNG)
- 🔮 More advanced DSP concepts (filtering, modulation, convolution)
- 🔮 Real-time input from microphone
- 🔮 Multiple waveform layers/mixing
