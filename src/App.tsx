import React from 'react';
import { AudioProvider } from '@/context/AudioContext';
import { Header } from '@/components/Header';
import { WaveformDisplay } from '@/components/WaveformDisplay';
import { ControlPanel } from '@/components/ControlPanel';
import { PadGrid } from '@/components/PadGrid';

/**
 * Root application component.
 * Provides audio context and renders main layout with header, waveform, controls, and pad grid.
 */
const App: React.FC = () => {
  return (
    <AudioProvider>
      <div className="font-sans bg-background-dark text-gray-300 antialiased h-screen w-screen overflow-hidden flex flex-col">
        <Header />

        <main className="grow flex flex-col bg-black p-4 gap-4 overflow-y-auto">
          <WaveformDisplay />
          <ControlPanel />
          <PadGrid />
        </main>
      </div>
    </AudioProvider>
  );
};

export default App;