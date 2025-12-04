import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  onInteractChange?: (isInteracting: boolean) => void;
  color?: string;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  min = 0,
  max = 100,
  value,
  onChange,
  onInteractChange,
  color = "bg-red-500"
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const startY = useRef<number>(0);
  const startValue = useRef<number>(0);

  // Map value (min-max) to rotation (-135 to 135)
  const percent = (value - min) / (max - min);
  const rotation = -135 + (percent * 270);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const dy = startY.current - e.clientY;
      const range = max - min;
      // Sensitivity factor: 200px drag for full range
      const delta = (dy / 200) * range;

      let newValue = startValue.current + delta;
      newValue = Math.max(min, Math.min(max, newValue));

      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ns-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, max, min, onChange]);

  // Notify parent when interaction state changes
  useEffect(() => {
    const isInteracting = isDragging || isHovering;
    onInteractChange?.(isInteracting);
  }, [isDragging, isHovering, onInteractChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  return (
    <div className="flex flex-col items-center gap-2 group select-none">
      <div
        className="w-16 h-16 rounded-full dial-bg border border-black/50 flex items-center justify-center shadow-ui-element-raised relative cursor-ns-resize active:scale-95 transition-transform"
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="w-1 h-8 bg-transparent absolute top-0 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none transition-transform duration-75 ease-out"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        >
          <div className={`w-full h-1/2 ${color} rounded-t-full shadow-[0_0_5px_rgba(239,68,68,0.5)]`}></div>
        </div>

        {/* Removed center indent/dot */}
      </div>
      <span className={`text-xs font-semibold transition-colors ${isDragging ? 'text-primary' : 'text-gray-400 group-hover:text-gray-200'}`}>
        {label}
      </span>
    </div>
  );
};