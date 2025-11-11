import { useState, useEffect, useRef } from 'react';
import { WaveformCanvas } from '@/components/WaveformCanvas';
import { ControlPanel } from '@/components/ControlPanel';
import { Card } from '@/components/ui/card';
import { WaveformType } from '@shared/schema';

export default function Visualizer() {
  const [hardwareMaxRate, setHardwareMaxRate] = useState(48000);
  const [sampleRate, setSampleRate] = useState(8000);
  const [bitDepth, setBitDepth] = useState(8);
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [waveformType, setWaveformType] = useState<WaveformType>('sine');
  const [zoomLevel, setZoomLevel] = useState(100);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    setHardwareMaxRate(tempCtx.sampleRate);
    tempCtx.close();
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Update oscillator frequency when it changes (without restarting audio)
  useEffect(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.frequency.value = frequency;
    }
  }, [frequency]);

  // Update gain when play/pause state changes
  useEffect(() => {
    // Clear any existing timer
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isPlaying ? 0.3 : 0;
    }

    // Resume audio context if it's suspended (browser autoplay policy)
    if (isPlaying && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => {
        console.error('Failed to resume audio context:', err);
      });
    }

    // Set timer to stop playback after 1 second
    if (isPlaying) {
      playbackTimerRef.current = setTimeout(() => {
        setIsPlaying(false);
      }, 1000);
    }

    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  // Update oscillator waveform type when it changes (requires restart)
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Always create AudioContext at hardware rate for proper downsampling
    // The crusher will handle resampling to the desired sample rate
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    const actualContextRate = ctx.sampleRate;
    const gainNode = ctx.createGain();
    gainNode.gain.value = isPlaying ? 0.3 : 0;

    const quantizationLevels = Math.pow(2, bitDepth);
    const crusher = ctx.createScriptProcessor(4096, 1, 1);

    let phaseAccumulator = 0;
    const downsampleRatio = actualContextRate / sampleRate;

    // Sinc interpolation parameters
    const sincRadius = 32; // Number of samples on each side for sinc kernel
    const sampleBuffer: number[] = []; // Buffer to store quantized samples for sinc interpolation

    // Windowed sinc function (Lanczos window)
    const sinc = (x: number): number => {
      if (Math.abs(x) < 1e-10) return 1.0;
      const piX = Math.PI * x;
      return Math.sin(piX) / piX;
    };

    const lanczosWindow = (x: number, a: number): number => {
      if (Math.abs(x) > a) return 0;
      return sinc(x / a);
    };

    crusher.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);

      for (let i = 0; i < input.length; i++) {
        if (sampleRate < actualContextRate) {
          // Advance phase
          phaseAccumulator += 1.0;

          // Check if we need to capture a new sample
          if (phaseAccumulator >= downsampleRatio) {
            phaseAccumulator -= downsampleRatio;

            // Quantize the new sample and add to buffer
            const normalized = (input[i] + 1) / 2;
            const quantized = Math.floor(normalized * quantizationLevels);
            const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
            const quantizedSample = (clamped / (quantizationLevels - 1)) * 2 - 1;
            sampleBuffer.push(quantizedSample);

            // Keep buffer size manageable
            if (sampleBuffer.length > sincRadius * 2 + 1) {
              sampleBuffer.shift();
            }
          }

          // Sinc interpolation
          if (sampleBuffer.length >= sincRadius * 2 + 1) {
            // Calculate fractional position within the downsample period
            const fracPos = phaseAccumulator / downsampleRatio;

            let interpolatedSample = 0;
            const centerIdx = sampleBuffer.length - sincRadius - 1;

            for (let j = -sincRadius; j <= sincRadius; j++) {
              const bufferIdx = centerIdx + j;
              if (bufferIdx >= 0 && bufferIdx < sampleBuffer.length) {
                const x = j - fracPos;
                const weight = sinc(x) * lanczosWindow(x, sincRadius);
                interpolatedSample += sampleBuffer[bufferIdx] * weight;
              }
            }

            output[i] = interpolatedSample;
          } else {
            // Not enough samples yet, use last available sample
            output[i] = sampleBuffer.length > 0 ? sampleBuffer[sampleBuffer.length - 1] : 0;
          }
        } else {
          // When sampleRate >= actualContextRate, just quantize without resampling
          const normalized = (input[i] + 1) / 2;
          const quantized = Math.floor(normalized * quantizationLevels);
          const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
          output[i] = (clamped / (quantizationLevels - 1)) * 2 - 1;
        }
      }
    };

    // Anti-aliasing filter BEFORE downsampling to prevent aliasing
    const nyquist = sampleRate / 2;
    const antiAliasFilter = ctx.createBiquadFilter();
    antiAliasFilter.type = 'lowpass';
    antiAliasFilter.frequency.value = nyquist * 0.8; // Conservative cutoff at 80% of Nyquist
    antiAliasFilter.Q.value = 0.707; // Butterworth response

    // Reconstruction filter AFTER sample-and-hold to remove imaging artifacts
    // This is critical - the stepped output from sample-and-hold creates images
    // that need to be filtered out before we hear them
    const reconstructionFilter1 = ctx.createBiquadFilter();
    reconstructionFilter1.type = 'lowpass';
    reconstructionFilter1.frequency.value = nyquist * 0.9;
    reconstructionFilter1.Q.value = 0.5412; // 4th-order Butterworth Q1

    const reconstructionFilter2 = ctx.createBiquadFilter();
    reconstructionFilter2.type = 'lowpass';
    reconstructionFilter2.frequency.value = nyquist * 0.9;
    reconstructionFilter2.Q.value = 1.3065; // 4th-order Butterworth Q2

    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.type = waveformType;
    oscillator.connect(antiAliasFilter);
    oscillator.start();
    oscillatorRef.current = oscillator;

    // Chain: oscillator -> anti-alias filter -> crusher (downsample + quantize + hold)
    //        -> reconstruction filters -> gain -> output
    antiAliasFilter.connect(crusher);
    crusher.connect(reconstructionFilter1);
    reconstructionFilter1.connect(reconstructionFilter2);
    reconstructionFilter2.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    // Resume audio context if playing and suspended (browser autoplay policy)
    if (isPlaying && ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.error('Failed to resume audio context:', err);
      });
    }

    return () => {
      try {
        oscillator.stop();
      } catch (e) {
      }

      try {
        crusher.disconnect();
        antiAliasFilter.disconnect();
        reconstructionFilter1.disconnect();
        reconstructionFilter2.disconnect();
        gainNode.disconnect();
      } catch (e) {
      }

      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }

      audioContextRef.current = null;
      oscillatorRef.current = null;
    };
  }, [sampleRate, bitDepth, waveformType, hardwareMaxRate, isPlaying]);

  const quantizationLevels = Math.pow(2, bitDepth);
  const nyquistFrequency = sampleRate / 2;

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 md:px-6 h-16 border-b border-border bg-background">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground" data-testid="text-app-title">
            Digital Audio Sampling & Quantization
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Interactive DSP Visualizer
          </p>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Sample Rate</div>
            <div className="text-sm font-mono tabular-nums text-foreground" data-testid="text-header-sample-rate" aria-live="polite">
              {sampleRate >= 1000 ? `${(sampleRate / 1000).toFixed(1)} kHz` : `${sampleRate.toFixed(1)} Hz`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Bit Depth</div>
            <div className="text-sm font-mono tabular-nums text-foreground" data-testid="text-header-bit-depth" aria-live="polite">
              {bitDepth}-bit
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">Levels</div>
            <div className="text-sm font-mono tabular-nums text-foreground" data-testid="text-header-levels" aria-live="polite">
              {quantizationLevels.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <aside className="w-full md:w-80 lg:w-80 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto">
          <ControlPanel
            sampleRate={sampleRate}
            bitDepth={bitDepth}
            isPlaying={isPlaying}
            hardwareMaxRate={hardwareMaxRate}
            waveformType={waveformType}
            frequency={frequency}
            zoomLevel={zoomLevel}
            onSampleRateChange={setSampleRate}
            onBitDepthChange={setBitDepth}
            onWaveformTypeChange={setWaveformType}
            onFrequencyChange={setFrequency}
            onZoomLevelChange={setZoomLevel}
            onPlayPauseToggle={() => setIsPlaying(!isPlaying)}
          />
        </aside>

        <main className="flex-1 p-2 md:p-4 overflow-hidden">
          <div className="h-full flex flex-col gap-2">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Waveform Shape
                </h2>
              </div>
              <Card className="flex-1 p-2 bg-card min-h-0" data-testid="card-original-waveform">
                <WaveformCanvas
                  sampleRate={sampleRate}
                  bitDepth={bitDepth}
                  frequency={frequency}
                  waveformType={waveformType}
                  zoomLevel={zoomLevel}
                  isPlaying={isPlaying}
                  type="original"
                  className="w-full h-full"
                />
              </Card>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Quantized Waveform
                </h2>
              </div>
              <Card className="flex-1 p-2 bg-card min-h-0" data-testid="card-quantized-waveform">
                <WaveformCanvas
                  sampleRate={sampleRate}
                  bitDepth={bitDepth}
                  frequency={frequency}
                  waveformType={waveformType}
                  zoomLevel={zoomLevel}
                  isPlaying={isPlaying}
                  type="quantized"
                  className="w-full h-full"
                />
              </Card>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Binary Encoding Stream
                </h2>
              </div>
              <Card className="flex-1 p-2 bg-card min-h-0" data-testid="card-binary-encoding">
                <WaveformCanvas
                  sampleRate={sampleRate}
                  bitDepth={bitDepth}
                  frequency={frequency}
                  waveformType={waveformType}
                  isPlaying={isPlaying}
                  type="binary"
                  className="w-full h-full"
                />
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
