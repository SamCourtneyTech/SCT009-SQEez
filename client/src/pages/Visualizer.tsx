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
  const [frequency] = useState(440);
  const [waveformType, setWaveformType] = useState<WaveformType>('sine');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioContextClass();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setIsPlaying(false);
    } catch (error) {
      console.error('Error decoding audio file:', error);
      alert('Failed to load audio file. Please try a different file.');
    } finally {
      tempCtx.close();
    }
  };

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

  useEffect(() => {
    if (!isPlaying || sampleRate > hardwareMaxRate) {
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const requestedRate = Math.max(0.1, Math.min(hardwareMaxRate, sampleRate));
    const ctx = new AudioContextClass({ sampleRate: requestedRate });
    audioContextRef.current = ctx;

    const actualContextRate = ctx.sampleRate;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.3;

    const quantizationLevels = Math.pow(2, bitDepth);
    const crusher = ctx.createScriptProcessor(4096, 1, 1);

    let phaseAccumulator = 0;
    const downsampleRatio = actualContextRate / sampleRate;
    let lastSample = 0;

    crusher.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);

      for (let i = 0; i < input.length; i++) {
        if (sampleRate < actualContextRate) {
          phaseAccumulator += 1.0;
          
          if (phaseAccumulator >= downsampleRatio) {
            phaseAccumulator -= downsampleRatio;
            
            const normalized = (input[i] + 1) / 2;
            const quantized = Math.floor(normalized * quantizationLevels);
            const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
            lastSample = (clamped / (quantizationLevels - 1)) * 2 - 1;
          }
          output[i] = lastSample;
        } else {
          const normalized = (input[i] + 1) / 2;
          const quantized = Math.floor(normalized * quantizationLevels);
          const clamped = Math.max(0, Math.min(quantizationLevels - 1, quantized));
          output[i] = (clamped / (quantizationLevels - 1)) * 2 - 1;
        }
      }
    };

    let sourceNode: AudioScheduledSourceNode;

    if (audioBuffer) {
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.loop = true;
      bufferSource.connect(crusher);
      bufferSource.start();
      sourceNode = bufferSource;
    } else {
      const oscillator = ctx.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.type = waveformType;
      oscillator.connect(crusher);
      oscillator.start();
      sourceNode = oscillator;
      oscillatorRef.current = oscillator;
    }

    crusher.connect(gainNode);
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    return () => {
      try {
        if (sourceNode) {
          sourceNode.stop();
        }
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
    };
  }, [isPlaying, sampleRate, bitDepth, frequency, waveformType, hardwareMaxRate, audioBuffer]);

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
            audioBuffer={audioBuffer}
            onSampleRateChange={setSampleRate}
            onBitDepthChange={setBitDepth}
            onWaveformTypeChange={setWaveformType}
            onPlayPauseToggle={() => setIsPlaying(!isPlaying)}
            onFileUpload={handleFileUpload}
            onClearAudio={() => setAudioBuffer(null)}
          />
        </aside>

        <main className="flex-1 p-2 md:p-4 overflow-hidden">
          <div className="h-full flex flex-col gap-2">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Original Waveform + Sample Points
                </h2>
              </div>
              <Card className="flex-1 p-2 bg-card min-h-0" data-testid="card-original-waveform">
                <WaveformCanvas
                  sampleRate={sampleRate}
                  bitDepth={bitDepth}
                  frequency={frequency}
                  waveformType={waveformType}
                  audioBuffer={audioBuffer}
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
                  audioBuffer={audioBuffer}
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
                  audioBuffer={audioBuffer}
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
