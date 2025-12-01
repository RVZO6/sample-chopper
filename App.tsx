import React from 'react';
import { AudioProvider } from '@/context/AudioContext';
import { Header } from '@/components/Header';
import { WaveformDisplay } from '@/components/WaveformDisplay';
import { ControlPanel } from '@/components/ControlPanel';
import { PadGrid } from '@/components/PadGrid';

const App: React.FC = () => {
  return (
    <AudioProvider>
      <div className="font-sans bg-background-dark text-gray-300 antialiased h-screen w-screen overflow-hidden flex flex-col">
        <Header />

        <main className="grow flex flex-col bg-black p-4 gap-4 overflow-y-auto">
          {/* Top: Waveform Visualization */}
          <WaveformDisplay />

          {/* Middle: Controls (Knobs, Sliders, Buttons) */}
          <ControlPanel />

          {/* Bottom: Pad Grid */}
          <PadGrid />
        </main>
      </div>
    </AudioProvider>
  );
};

export default App;