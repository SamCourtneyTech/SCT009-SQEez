import { useEffect, useRef } from 'react';
import { WaveformType, generateWaveform } from '@shared/schema';

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
  const animationRef = useRef<number>();
  const scrollOffsetRef = useRef(0);

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

    const displayDuration = Math.max(0.5, Math.min(5, 1000 / sampleRate));
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

    const drawOriginalWaveform = (time: number) => {
      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, width, height);

      drawGrid();

      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const points: { x: number; y: number }[] = [];
      
      for (let x = 0; x < width; x++) {
        const t = (x / width) * displayDuration + time;
        const y = centerY + getSampleValue(t) * amplitude;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      ctx.fillStyle = 'hsl(var(--primary))';
      ctx.strokeStyle = 'hsl(var(--primary-foreground))';
      ctx.lineWidth = 1;

      for (let i = 0; i < samplesInView; i++) {
        const x = i * sampleSpacing;
        const sampleIndex = i * sampleStride;
        const t = (sampleIndex / totalSamples) * displayDuration + time;
        const sampleValue = getSampleValue(t);
        const y = centerY + sampleValue * amplitude;

        if (samplesInView <= 100) {
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = 'hsl(var(--muted-foreground))';
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, 4 * Math.min(1, 100 / samplesInView)), 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'hsl(var(--background))';
        ctx.stroke();
      }
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

      if (type === 'original') {
        drawOriginalWaveform(time);
      } else if (type === 'quantized') {
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
