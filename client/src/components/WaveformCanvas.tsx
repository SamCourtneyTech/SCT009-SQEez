import { useEffect, useRef } from 'react';
import { WaveformType, generateWaveform, generateStaticWaveformPath } from '@shared/schema';

interface WaveformCanvasProps {
  sampleRate: number;
  bitDepth: number;
  frequency: number;
  waveformType: WaveformType;
  audioBuffer?: AudioBuffer | null;
  zoomLevel?: number;
  className?: string;
  type: 'original' | 'quantized' | 'binary';
  isPlaying?: boolean;
}

export function WaveformCanvas({ sampleRate, bitDepth, frequency, waveformType, audioBuffer, zoomLevel = 1, className, type, isPlaying = false }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();
  const scrollOffsetRef = useRef(0);

  // For the 'original' type, we show a waveform with sample markers
  useEffect(() => {
    if (type !== 'original') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const drawWaveform = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;
      const amplitude = height * 0.35;

      // Clear canvas with computed background color
      const computedStyle = getComputedStyle(canvas);
      const bgColor = computedStyle.getPropertyValue('--background');
      ctx.fillStyle = bgColor ? `hsl(${bgColor})` : '#000000';
      ctx.fillRect(0, 0, width, height);

      // Draw center line
      const borderColor = computedStyle.getPropertyValue('--border');
      ctx.strokeStyle = borderColor ? `hsl(${borderColor})` : '#555555';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw horizontal quantization level lines (only if not too dense)
      const quantizationLevels = Math.pow(2, bitDepth);
      const stepSize = (height * 0.7) / quantizationLevels;

      // Only draw level lines if there's enough space between them (at least 3 pixels)
      if (stepSize >= 3) {
        ctx.strokeStyle = borderColor ? `hsl(${borderColor})` : '#555555';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]); // Longer dashes, shorter gaps

        for (let i = 0; i < quantizationLevels; i++) {
          const yPos = height * 0.15 + i * stepSize;
          ctx.beginPath();
          ctx.moveTo(0, yPos);
          ctx.lineTo(width, yPos);
          ctx.stroke();
        }

        ctx.setLineDash([]);
      }

      // Display exactly 1 second of the waveform
      const displayDuration = 1.0; // 1 second
      const timePerPixel = (displayDuration / zoomLevel) / width;

      // Draw the waveform
      const primaryColor = computedStyle.getPropertyValue('--primary');
      ctx.strokeStyle = primaryColor ? `hsl(${primaryColor})` : '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const t = x * timePerPixel;
        const value = generateWaveform(t, frequency, waveformType);
        const y = centerY - value * amplitude;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw sample markers
      const sampleInterval = 1 / sampleRate; // Time between samples in seconds
      const pixelsPerSample = sampleInterval / timePerPixel;

      // Only draw sample markers if they're visible (not too close together)
      if (pixelsPerSample >= 2) {
        const chart2Color = computedStyle.getPropertyValue('--chart-2');
        ctx.strokeStyle = chart2Color ? `hsl(${chart2Color})` : '#10b981';
        ctx.lineWidth = 1;
        ctx.globalAlpha = Math.min(1, pixelsPerSample / 10);

        for (let sampleIndex = 0; sampleIndex * sampleInterval <= displayDuration / zoomLevel; sampleIndex++) {
          const t = sampleIndex * sampleInterval;
          const x = t / timePerPixel;

          if (x > width) break;

          // Draw vertical line at sample point
          ctx.beginPath();
          ctx.moveTo(x, centerY - amplitude);
          ctx.lineTo(x, centerY + amplitude);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Draw label
      const mutedFgColor = computedStyle.getPropertyValue('--muted-foreground');
      ctx.fillStyle = mutedFgColor ? `hsl(${mutedFgColor})` : '#888888';
      ctx.font = '12px var(--font-sans)';
      ctx.fillText(
        `${waveformType.charAt(0).toUpperCase() + waveformType.slice(1)} Wave @ ${frequency} Hz (${(displayDuration / zoomLevel).toFixed(3)}s view)`,
        8,
        20
      );

      // Draw sample info if markers are visible
      if (pixelsPerSample >= 2) {
        ctx.fillText(
          `Sample markers: ${sampleRate} Hz (${(sampleInterval * 1000).toFixed(4)} ms)`,
          8,
          height - 8
        );
      } else {
        ctx.fillText(
          `Zoom in to see sample markers (${sampleRate} Hz)`,
          8,
          height - 8
        );
      }
    };

    drawWaveform();

    // Also redraw on window resize
    const handleResize = () => drawWaveform();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };

  }, [type, sampleRate, bitDepth, frequency, waveformType, zoomLevel]);

  if (type === 'original') {
    return (
      <canvas
        ref={canvasRef}
        className={className}
        aria-label="Waveform visualization with sample markers"
        data-testid="canvas-original-waveform"
        style={{ width: '100%', height: '100%' }}
      />
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      return {
        width: rect.width,
        height: rect.height,
        centerY: rect.height / 2,
        amplitude: rect.height * 0.35
      };
    };

    let { width, height, centerY, amplitude } = setupCanvas();

    const baseDuration = Math.max(0.5, Math.min(5, 1000 / sampleRate));
    const displayDuration = baseDuration;
    const totalSamples = Math.max(2, Math.floor(sampleRate * displayDuration));
    const maxDisplaySamples = 500;
    const samplesInView = Math.min(totalSamples, maxDisplaySamples);
    const sampleSpacing = width / samplesInView;
    const sampleStride = Math.max(1, Math.floor(totalSamples / maxDisplaySamples));

    const getSampleValue = (t: number): number => {
      if (audioBuffer) {
        const bufferData = audioBuffer.getChannelData(0);
        const sampleIndex = Math.floor((t * audioBuffer.sampleRate) % bufferData.length);
        return bufferData[sampleIndex];
      } else {
        return generateWaveform(t, frequency, waveformType);
      }
    };

    const drawGrid = () => {
      // Recalculate these values each time to ensure they're always up to date
      const quantizationLevels = Math.pow(2, bitDepth);
      const stepSize = (height * 0.7) / quantizationLevels;

      ctx.strokeStyle = 'hsl(var(--border))';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (type === 'quantized' && bitDepth <= 5) {
        // Make lines more visible with longer dashes
        ctx.setLineDash([4, 2]);
        ctx.lineWidth = 1;

        for (let i = 0; i < quantizationLevels; i++) {
          const y = height * 0.15 + i * stepSize;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      ctx.setLineDash([]);
    };

    const drawQuantizedWaveform = (time: number) => {
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, width, height);

      drawGrid();

      const quantizationLevels = Math.pow(2, bitDepth);

      const quantize = (value: number) => {
        const normalized = (value + 1) / 2;
        const quantized = Math.floor(normalized * quantizationLevels);
        const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
        return (clamped / (quantizationLevels - 1)) * 2 - 1;
      };

      ctx.strokeStyle = 'hsl(var(--chart-2))';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      for (let i = 0; i < samplesInView; i++) {
        const x = i * sampleSpacing;
        const sampleIndex = i * sampleStride;
        const t = (sampleIndex / totalSamples) * displayDuration + time;
        const sampleValue = getSampleValue(t);
        const quantizedValue = quantize(sampleValue);
        const y = centerY - quantizedValue * amplitude;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        if (i < samplesInView - 1) {
          const nextX = (i + 1) * sampleSpacing;
          ctx.lineTo(nextX, y);
        }
      }
      ctx.stroke();

      ctx.fillStyle = 'hsl(var(--chart-2))';
      const pointSize = Math.max(2, 3 * Math.min(1, 100 / samplesInView));
      for (let i = 0; i < samplesInView; i++) {
        const x = i * sampleSpacing;
        const sampleIndex = i * sampleStride;
        const t = (sampleIndex / totalSamples) * displayDuration + time;
        const sampleValue = getSampleValue(t);
        const quantizedValue = quantize(sampleValue);
        const y = centerY - quantizedValue * amplitude;

        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    const drawBinaryEncoding = (time: number) => {
      // Only clear/redraw background on the first frame
      if (!scrollOffsetRef.current || scrollOffsetRef.current === 0) {
        const computedStyle = getComputedStyle(canvas);
        const bgColor = computedStyle.getPropertyValue('--background');
        ctx.fillStyle = bgColor ? `hsl(${bgColor})` : '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      const quantizationLevels = Math.pow(2, bitDepth);

      const quantize = (value: number) => {
        const normalized = (value + 1) / 2;
        const quantized = Math.floor(normalized * quantizationLevels);
        return Math.max(0, Math.min(quantizationLevels - 1, quantized));
      };

      const binaryWidth = Math.max(8, Math.min(120, bitDepth * 8));
      const spacing = 4;
      const maxValues = Math.floor(width / (binaryWidth + spacing));

      // Only update scroll offset when playing
      if (isPlaying) {
        scrollOffsetRef.current += sampleRate / 60;
      }
      const startIndex = Math.floor(scrollOffsetRef.current);

      // Clear the canvas with the computed background color
      const computedStyle = getComputedStyle(canvas);
      const bgColor = computedStyle.getPropertyValue('--background');
      ctx.fillStyle = bgColor ? `hsl(${bgColor})` : '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${Math.min(14, binaryWidth / bitDepth)}px var(--font-mono)`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < maxValues; i++) {
        const sampleIndex = startIndex + i;
        const t = sampleIndex / sampleRate;
        const sampleValue = getSampleValue(t);
        const quantizedValue = quantize(sampleValue);

        const binary = quantizedValue.toString(2).padStart(bitDepth, '0');

        const hue = (quantizedValue / quantizationLevels) * 300;
        ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;

        const x = width - (i * (binaryWidth + spacing)) - binaryWidth;
        const fadeIn = Math.min(1, i / 3);
        const alpha = fadeIn;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillText(binary, x, centerY);
        ctx.restore();
      }

      const mutedFgColor = computedStyle.getPropertyValue('--muted-foreground');
      ctx.fillStyle = mutedFgColor ? `hsl(${mutedFgColor})` : '#888888';
      ctx.font = '11px var(--font-sans)';
      ctx.textAlign = 'left';
      ctx.fillText(`${quantizationLevels} levels (${bitDepth}-bit)`, 8, 20);
    };

    const animate = () => {
      const time = Date.now() / 1000;

      if (type === 'quantized') {
        drawQuantizedWaveform(time);
      } else if (type === 'binary') {
        drawBinaryEncoding(time);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [sampleRate, bitDepth, frequency, waveformType, audioBuffer, type, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label={`${type} waveform visualization`}
      data-testid={`canvas-${type}-waveform`}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
