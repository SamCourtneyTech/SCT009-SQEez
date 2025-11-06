import { z } from "zod";

export type WaveformType = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface AudioSettings {
  sampleRate: number;
  bitDepth: number;
  frequency: number;
  isPlaying: boolean;
  waveformType: WaveformType;
}

export interface QuantizationInfo {
  levels: number;
  nyquistFrequency: number;
  estimatedSize: number;
}

export const audioSettingsSchema = z.object({
  sampleRate: z.number().min(0.1).max(88200),
  bitDepth: z.number().int().min(1).max(32),
  frequency: z.number().min(20).max(20000),
  isPlaying: z.boolean(),
  waveformType: z.enum(['sine', 'square', 'triangle', 'sawtooth']),
});

export type AudioSettingsType = z.infer<typeof audioSettingsSchema>;

export function generateWaveform(t: number, frequency: number, type: WaveformType): number {
  const phase = 2 * Math.PI * frequency * t;

  switch (type) {
    case 'sine':
      return Math.sin(phase);
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1;
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(phase));
    case 'sawtooth':
      return 2 * ((frequency * t) % 1) - 1;
    default:
      return Math.sin(phase);
  }
}

export function generateStaticWaveformPath(type: WaveformType, width: number, height: number, periods: number = 2): string {
  const centerY = height / 2;
  const amplitude = height * 0.35;
  const points: string[] = [];

  const samplesPerPeriod = 100;
  const totalSamples = samplesPerPeriod * periods;

  for (let i = 0; i <= totalSamples; i++) {
    const x = (i / totalSamples) * width;
    const t = (i / samplesPerPeriod);
    const y = centerY - generateWaveform(t, 1, type) * amplitude;

    if (i === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  }

  return points.join(' ');
}
