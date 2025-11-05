import { z } from "zod";

export interface AudioSettings {
  sampleRate: number;
  bitDepth: number;
  frequency: number;
  isPlaying: boolean;
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
});

export type AudioSettingsType = z.infer<typeof audioSettingsSchema>;
