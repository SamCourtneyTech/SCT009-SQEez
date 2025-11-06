import { Play, Pause, Info, AlertTriangle, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WaveformType } from '@shared/schema';
import { useRef } from 'react';

interface ControlPanelProps {
  sampleRate: number;
  bitDepth: number;
  isPlaying: boolean;
  hardwareMaxRate: number;
  waveformType: WaveformType;
  audioBuffer: AudioBuffer | null;
  onSampleRateChange: (value: number) => void;
  onBitDepthChange: (value: number) => void;
  onWaveformTypeChange: (value: WaveformType) => void;
  onPlayPauseToggle: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAudio: () => void;
}

export function ControlPanel({
  sampleRate,
  bitDepth,
  isPlaying,
  hardwareMaxRate,
  waveformType,
  audioBuffer,
  onSampleRateChange,
  onBitDepthChange,
  onWaveformTypeChange,
  onPlayPauseToggle,
  onFileUpload,
  onClearAudio,
}: ControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quantizationLevels = Math.pow(2, bitDepth);
  const nyquistFrequency = sampleRate / 2;
  
  const formatSampleRate = (rate: number) => {
    if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1)} kHz`;
    }
    return `${rate.toFixed(1)} Hz`;
  };

  const formatFileSize = () => {
    const bytesPerSample = Math.ceil(bitDepth / 8);
    const bytesPerSecond = sampleRate * bytesPerSample;
    
    if (bytesPerSecond >= 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    }
    return `${bytesPerSecond} B/s`;
  };

  return (
    <div className="h-full flex flex-col space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="space-y-4 md:space-y-6 flex-1">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-foreground">
                Sample Rate
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground" data-testid="info-sample-rate" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Number of samples captured per second. Higher rates capture more detail.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-3xl font-mono tabular-nums text-foreground" data-testid="text-sample-rate">
              {formatSampleRate(sampleRate)}
            </span>
          </div>
          <Slider
            value={[sampleRate]}
            onValueChange={([value]) => onSampleRateChange(value)}
            min={0.1}
            max={88200}
            step={0.1}
            className="w-full"
            aria-label="Sample rate in Hertz"
            data-testid="slider-sample-rate"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>0.1 Hz</span>
            <span>88.2 kHz</span>
          </div>
          {sampleRate > hardwareMaxRate && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <AlertTriangle className="w-3 h-3" />
              <span>Above hardware limit ({formatSampleRate(hardwareMaxRate)}) - visualization only</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-foreground">
                Bit Depth
              </label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground" data-testid="info-bit-depth" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Number of bits used to represent each sample. More bits = more precision.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-3xl font-mono tabular-nums text-foreground" data-testid="text-bit-depth">
              {bitDepth}-bit
            </span>
          </div>
          <Slider
            value={[bitDepth]}
            onValueChange={([value]) => onBitDepthChange(value)}
            min={1}
            max={32}
            step={1}
            className="w-full"
            aria-label="Bit depth"
            data-testid="slider-bit-depth"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>1-bit</span>
            <span>32-bit</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-foreground">
              Waveform Type
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground" data-testid="info-waveform-type" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  Select the shape of the waveform to visualize and sample.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select value={waveformType} onValueChange={onWaveformTypeChange}>
            <SelectTrigger className="w-full" data-testid="select-waveform-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sine">Sine Wave</SelectItem>
              <SelectItem value="square">Square Wave</SelectItem>
              <SelectItem value="triangle">Triangle Wave</SelectItem>
              <SelectItem value="sawtooth">Sawtooth Wave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-foreground">
              Custom Audio
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-muted-foreground" data-testid="info-custom-audio" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-xs">
                  Upload your own audio file (WAV/MP3) to visualize and quantize.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={onFileUpload}
            className="hidden"
            data-testid="input-audio-file"
          />
          {!audioBuffer ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-audio"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Audio File
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Loaded: {audioBuffer.duration.toFixed(2)}s @ {(audioBuffer.sampleRate / 1000).toFixed(1)} kHz
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={onClearAudio}
                data-testid="button-clear-audio"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Audio
              </Button>
            </div>
          )}
        </div>

        <Card className="p-4 space-y-3 bg-card">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Calculated Metrics
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Quantization Levels</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono tabular-nums text-foreground" data-testid="text-quant-levels">
                  {quantizationLevels.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  (2^{bitDepth})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Nyquist Frequency</span>
              <span className="text-sm font-mono tabular-nums text-foreground" data-testid="text-nyquist">
                {formatSampleRate(nyquistFrequency)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Data Rate</span>
              <span className="text-sm font-mono tabular-nums text-foreground" data-testid="text-data-rate">
                {formatFileSize()}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Button
        onClick={onPlayPauseToggle}
        className="w-full"
        size="lg"
        data-testid="button-play-pause"
      >
        {isPlaying ? (
          <>
            <Pause className="w-4 h-4 mr-2" />
            Pause Audio
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            Play Audio
          </>
        )}
      </Button>
    </div>
  );
}
