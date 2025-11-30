import React from 'react';

interface PadProps {
  label: string;
  colorClass: string;
  isEmpty?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const Pad: React.FC<PadProps> = ({ label, colorClass, isEmpty = false, onClick, onContextMenu }) => {
  const baseClasses = "rounded-md relative transform transition-all duration-75 flex items-center justify-center h-full w-full min-h-[4rem]";

  // Different styling for empty vs active pads
  const activeStyle = "shadow-pad-raised active:shadow-pad-pressed active:translate-y-px cursor-pointer hover:brightness-110";
  // Updated: Darker background and purely recessed shadow (no bounce light)
  const emptyStyle = "bg-pad-empty-bg shadow-pad-empty cursor-pointer opacity-100 hover:brightness-110"; // Made cursor-pointer for empty pads too

  // If empty, use emptyStyle, otherwise use the passed colorClass + activeStyle
  const combinedClasses = `${baseClasses} ${isEmpty ? emptyStyle : colorClass + ' ' + activeStyle}`;

  return (
    <button
      className={combinedClasses}
      onMouseDown={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="absolute bottom-1 right-2 text-xs font-bold px-1.5 py-0.5 rounded text-white bg-black/30">
        {label}
      </span>

      {/* Visual shine for active pads */}
      {!isEmpty && (
        <div className="absolute inset-0 rounded-md bg-gradient-to-tr from-transparent to-white/10 pointer-events-none"></div>
      )}
    </button>
  );
};