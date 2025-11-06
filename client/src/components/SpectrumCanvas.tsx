import { useEffect, useRef } from 'react';

interface SpectrumCanvasProps {
  analyserNode: AnalyserNode | null;
  sampleRate: number;
  className?: string;
}

export function SpectrumCanvas({ analyserNode, sampleRate, className }: SpectrumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    const fftSize = analyserNode.fftSize;
    const frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    const nyquistFrequency = sampleRate / 2;
    const maxDisplayFrequency = Math.max(nyquistFrequency * 2, Math.min(20000, 20000));
    
    const draw = () => {
      analyserNode.getByteFrequencyData(frequencyData);

      ctx.fillStyle = 'hsl(var(--background))';
      ctx.fillRect(0, 0, width, height);

      const nyquistX = (nyquistFrequency / maxDisplayFrequency) * width;
      
      ctx.strokeStyle = 'hsl(var(--primary))';
      ctx.fillStyle = 'hsl(var(--primary) / 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < frequencyData.length; i++) {
        const freq = (i / frequencyData.length) * nyquistFrequency;
        const x = (freq / maxDisplayFrequency) * width;
        const value = frequencyData[i] / 255;
        const barHeight = value * height * 0.9;
        const y = height - barHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineTo(nyquistX, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'hsl(var(--destructive) / 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(nyquistX, 0);
      ctx.lineTo(nyquistX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '10px monospace';
      ctx.fillStyle = 'hsl(var(--destructive))';
      ctx.fillText(`Nyquist: ${Math.round(nyquistFrequency)}Hz`, nyquistX + 5, 15);

      if (nyquistX < width - 20) {
        ctx.fillStyle = 'hsl(var(--destructive) / 0.15)';
        ctx.fillRect(nyquistX, 0, width - nyquistX, height);
        
        ctx.font = '11px monospace';
        ctx.fillStyle = 'hsl(var(--destructive) / 0.8)';
        const aliasingText = 'Aliasing Region';
        const textWidth = ctx.measureText(aliasingText).width;
        const textX = Math.min(nyquistX + (width - nyquistX - textWidth) / 2, width - textWidth - 10);
        ctx.fillText(aliasingText, textX, height / 2);
      }

      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '10px monospace';
      const freqLabels = [100, 500, 1000, 5000, 10000];
      freqLabels.forEach(freq => {
        if (freq < maxDisplayFrequency) {
          const x = (freq / maxDisplayFrequency) * width;
          if (x > 20 && x < width - 40) {
            ctx.fillText(`${freq >= 1000 ? (freq / 1000) + 'k' : freq}Hz`, x - 15, height - 5);
          }
        }
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, sampleRate]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-testid="canvas-spectrum"
    />
  );
}
