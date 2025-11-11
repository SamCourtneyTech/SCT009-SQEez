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

    // Polyphase FIR filter parameters
    const filterLength = 64; // Taps per polyphase branch
    const numPhases = 256; // Number of polyphase branches (interpolation phases)
    const sampleBuffer: number[] = []; // Buffer to store quantized samples

    // Blackman-Harris window (4-term, excellent stopband attenuation ~92dB)
    const blackmanHarris = (n: number, N: number): number => {
      const a0 = 0.35875;
      const a1 = 0.48829;
      const a2 = 0.14128;
      const a3 = 0.01168;
      const factor = (2 * Math.PI * n) / (N - 1);
      return a0 - a1 * Math.cos(factor) + a2 * Math.cos(2 * factor) - a3 * Math.cos(3 * factor);
    };

    // Band-limited sinc function
    const sinc = (x: number): number => {
      if (Math.abs(x) < 1e-10) return 1.0;
      const piX = Math.PI * x;
      return Math.sin(piX) / piX;
    };

    // Pre-compute polyphase FIR filter coefficients
    const filterCoeffs: number[][] = [];
    const totalTaps = filterLength * numPhases;

    for (let phase = 0; phase < numPhases; phase++) {
      const phaseCoeffs: number[] = [];
      for (let tap = 0; tap < filterLength; tap++) {
        const n = tap * numPhases + phase;
        const x = n - totalTaps / 2;
        const normalizedX = x / numPhases; // Normalize for sinc function

        // Windowed sinc: sinc(x) * window(n)
        const sincValue = sinc(normalizedX);
        const windowValue = blackmanHarris(n, totalTaps);
        phaseCoeffs.push(sincValue * windowValue);
      }

      // Normalize coefficients so sum = 1
      const sum = phaseCoeffs.reduce((acc, val) => acc + val, 0);
      filterCoeffs.push(phaseCoeffs.map(c => c / sum));
    }

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
            if (sampleBuffer.length > filterLength) {
              sampleBuffer.shift();
            }
          }

          // Polyphase FIR interpolation
          if (sampleBuffer.length >= filterLength) {
            // Calculate fractional position and select polyphase branch
            const fracPos = phaseAccumulator / downsampleRatio;
            const phaseIndex = Math.floor(fracPos * numPhases) % numPhases;
            const coeffs = filterCoeffs[phaseIndex];

            // Apply FIR filter
            let interpolatedSample = 0;
            const startIdx = sampleBuffer.length - filterLength;

            for (let tap = 0; tap < filterLength; tap++) {
              interpolatedSample += sampleBuffer[startIdx + tap] * coeffs[tap];
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

    // Rate-adaptive Kaiser-windowed FIR filters
    // Modified Bessel function of the first kind (I0) - needed for Kaiser window
    const besselI0 = (x: number): number => {
      let sum = 1.0;
      let term = 1.0;
      for (let k = 1; k < 50; k++) {
        term *= (x * x) / (4 * k * k);
        sum += term;
        if (term < 1e-12 * sum) break;
      }
      return sum;
    };

    // Kaiser window function (beta ≈ 8.5 for ~100 dB stopband)
    const kaiserWindow = (n: number, N: number, beta: number): number => {
      const alpha = (N - 1) / 2;
      const arg = beta * Math.sqrt(1 - Math.pow((n - alpha) / alpha, 2));
      return besselI0(arg) / besselI0(beta);
    };

    // FFT helper for passband gain normalization
    const computePassbandGain = (coeffs: number[], normalizedCutoff: number): number => {
      // Use simple frequency response calculation at normalized cutoff/2 (middle of passband)
      const testFreq = normalizedCutoff / 2;
      let realSum = 0;
      let imagSum = 0;

      for (let n = 0; n < coeffs.length; n++) {
        const angle = -2 * Math.PI * testFreq * n;
        realSum += coeffs[n] * Math.cos(angle);
        imagSum += coeffs[n] * Math.sin(angle);
      }

      return Math.sqrt(realSum * realSum + imagSum * imagSum);
    };

    // Create rate-adaptive FIR filter
    const createAdaptiveFIR = (cutoffRatio: number): AudioWorkletNode | ScriptProcessorNode => {
      const nyquist = sampleRate / 2;
      const cutoffFreq = nyquist * cutoffRatio;
      const normalizedCutoff = cutoffFreq / actualContextRate; // Normalize to hardware sample rate

      // Scale filter order LINEARLY with sample rate
      const baseOrder = 64;
      const rateScale = sampleRate / 4000; // Linear scaling from 4kHz baseline
      const filterOrder = Math.max(32, Math.floor(baseOrder * rateScale)); // Minimum 32 taps

      const beta = 8.5; // Kaiser beta for ~100 dB stopband attenuation
      const firCoeffs: number[] = [];

      // Design Kaiser-windowed sinc FIR filter with CENTERED impulse for zero-phase
      const center = (filterOrder - 1) / 2;

      for (let n = 0; n < filterOrder; n++) {
        const x = n - center; // Center impulse at (N-1)/2

        // Sinc function at normalized cutoff
        let h;
        if (Math.abs(x) < 1e-10) {
          h = 2 * normalizedCutoff;
        } else {
          const piX = 2 * Math.PI * normalizedCutoff * x;
          h = Math.sin(piX) / (Math.PI * x);
        }

        // Apply Kaiser window
        const w = kaiserWindow(n, filterOrder, beta);
        firCoeffs.push(h * w);
      }

      // Normalize to unity gain at DC (initial normalization)
      const dcSum = firCoeffs.reduce((acc, val) => acc + val, 0);
      let normalizedCoeffs = firCoeffs.map(c => c / dcSum);

      // FFT-based passband gain check and correction
      const passbandGain = computePassbandGain(normalizedCoeffs, normalizedCutoff);
      normalizedCoeffs = normalizedCoeffs.map(c => c / passbandGain);

      // Create FIR filter using ScriptProcessor with DOUBLE-PRECISION convolution
      const firFilter = ctx.createScriptProcessor(4096, 1, 1);
      const firBuffer: Float64Array = new Float64Array(filterOrder); // Double precision buffer
      let bufferIndex = 0;

      firFilter.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = e.outputBuffer.getChannelData(0);

        for (let i = 0; i < input.length; i++) {
          // Add new sample to circular buffer (double precision)
          firBuffer[bufferIndex] = input[i];
          bufferIndex = (bufferIndex + 1) % filterOrder;

          // Apply FIR filter with DOUBLE-PRECISION convolution
          let result = 0.0; // Explicitly double precision
          for (let j = 0; j < filterOrder; j++) {
            const bufIdx = (bufferIndex + j) % filterOrder;
            result += firBuffer[bufIdx] * normalizedCoeffs[j];
          }
          output[i] = result;
        }
      };

      return firFilter;
    };

    // Anti-aliasing filter BEFORE downsampling (0.7x Nyquist)
    const antiAliasFilter = createAdaptiveFIR(0.7);

    // Reconstruction filter AFTER interpolation (0.85x Nyquist)
    const reconstructionFilter = createAdaptiveFIR(0.85);

    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.type = waveformType;
    oscillator.connect(antiAliasFilter);
    oscillator.start();
    oscillatorRef.current = oscillator;

    // Chain: oscillator -> anti-alias filter -> crusher (downsample + quantize + interpolate)
    //        -> reconstruction filter -> gain -> output
    antiAliasFilter.connect(crusher);
    crusher.connect(reconstructionFilter);
    reconstructionFilter.connect(gainNode);
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
        reconstructionFilter.disconnect();
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
