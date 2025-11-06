import { useEffect, useRef } from 'react';
import { WaveformType, generateWaveform, generateStaticWaveformPath } from '@shared/schema';

interface WaveformCanvasProps {
  sampleRate: number;
  bitDepth: number;
  frequency: number;
  waveformType: WaveformType;
  audioBuffer?: AudioBuffer | null;
  className?: string;
  type: 'original' | 'quantized' | 'binary';
}

export function WaveformCanvas({ sampleRate, bitDepth, frequency, waveformType, audioBuffer, className, type }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();
  const scrollOffsetRef = useRef(0);

  // For the 'original' type, we show a static SVG image
  if (type === 'original') {
    return (
      <div className={className} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 800 300"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Static waveform visualization showing 2 periods"
          data-testid="svg-static-waveform"
        >
          <line x1="0" y1="150" x2="800" y2="150" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
          <path
            d={generateStaticWaveformPath(waveformType, 800, 300, 2)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="10"
            y="20"
            fill="hsl(var(--muted-foreground))"
            fontSize="14"
            fontFamily="var(--font-sans)"
          >
            {waveformType.charAt(0).toUpperCase() + waveformType.slice(1)} Wave (2 periods)
          </text>
        </svg>
      </div>
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;
    const amplitude = height * 0.35;

    const quantizationLevels = Math.pow(2, bitDepth);
    const stepSize = (height * 0.7) / quantizationLevels;

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
      ctx.strokeStyle = 'hsl(var(--border))';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 4]);

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (type === 'quantized') {
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
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, width, height);

      const quantize = (value: number) => {
        const normalized = (value + 1) / 2;
        const quantized = Math.floor(normalized * quantizationLevels);
        return Math.max(0, Math.min(quantizationLevels - 1, quantized));
      };

      const binaryWidth = Math.max(8, Math.min(120, bitDepth * 8));
      const spacing = 4;
      const maxValues = Math.floor(width / (binaryWidth + spacing));

      scrollOffsetRef.current += sampleRate / 60;
      const startIndex = Math.floor(scrollOffsetRef.current);

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

      ctx.fillStyle = 'hsl(var(--muted-foreground))';
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
  }, [sampleRate, bitDepth, frequency, waveformType, audioBuffer, type]);

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
