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
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isPlaying ? 0.3 : 0;
    }
    // Resume audio context if it's suspended (browser autoplay policy)
    if (isPlaying && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch((err) => {
        console.error('Failed to resume audio context:', err);
      });
    }

    // Auto-stop playback after 1 second
    if (isPlaying) {
      const timeout = setTimeout(() => {
        setIsPlaying(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isPlaying]);

  // Update oscillator waveform type when it changes (requires restart)
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    // Clamp sample rate to valid AudioContext range (3000-768000 Hz) and hardware max
    // For playback, cap at hardware limit (48kHz) even if visualization uses higher rate
    const requestedRate = Math.max(3000, Math.min(hardwareMaxRate, sampleRate));
    const ctx = new AudioContextClass({ sampleRate: requestedRate });
    audioContextRef.current = ctx;

    const actualContextRate = ctx.sampleRate;
    const gainNode = ctx.createGain();
    gainNode.gain.value = isPlaying ? 0.3 : 0;

    const quantizationLevels = Math.pow(2, bitDepth);
    const crusher = ctx.createScriptProcessor(4096, 1, 1);

    let phaseAccumulator = 0;
    const downsampleRatio = actualContextRate / sampleRate;
    let lastSample = 0;
    let nextSample = 0;
    let needNewSample = true;

    // Use linear interpolation only for sine waves
    const useInterpolation = waveformType === 'sine';

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

            // Quantize the new sample
            const normalized = (input[i] + 1) / 2;
            const quantized = Math.floor(normalized * quantizationLevels);
            const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
            const newSample = (clamped / (quantizationLevels - 1)) * 2 - 1;

            if (useInterpolation) {
              // Shift samples: next becomes last, and we capture a new next
              lastSample = nextSample;
              nextSample = newSample;

              if (needNewSample) {
                // First sample - initialize both
                lastSample = nextSample;
                needNewSample = false;
              }
            } else {
              // Sample-and-hold for non-sine waves
              lastSample = newSample;
            }
          }

          if (useInterpolation) {
            // Linear interpolation between lastSample and nextSample
            // Phase accumulator tells us how far between samples we are
            const interpolationFactor = phaseAccumulator / downsampleRatio;
            output[i] = lastSample + (nextSample - lastSample) * interpolationFactor;
          } else {
            // Sample-and-hold
            output[i] = lastSample;
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

    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.type = waveformType;
    oscillator.connect(crusher);
    oscillator.start();
    oscillatorRef.current = oscillator;

    crusher.connect(gainNode);
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
