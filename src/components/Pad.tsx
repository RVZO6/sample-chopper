import React from 'react';

interface PadProps {
  label: string;
  colorClass: string;
  isEmpty?: boolean;
  isPressed?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const Pad: React.FC<PadProps> = ({
  label,
  colorClass,
  isEmpty = false,
  isPressed = false,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onContextMenu
}) => {
  const baseClasses = "rounded-md relative transform transition-all duration-75 flex items-center justify-center h-full w-full min-h-16 outline-none focus:outline-none";

  // Different styling for empty vs active pads
  const activeStyle = "shadow-pad-raised active:shadow-pad-pressed active:translate-y-px cursor-pointer hover:brightness-110";
  const emptyStyle = "bg-pad-empty-bg shadow-pad-empty cursor-pointer opacity-100 hover:brightness-110";

  // Apply pressed state for keyboard triggers
  const pressedStyle = isPressed ? "shadow-pad-pressed translate-y-px brightness-90" : "";

  // If empty, use emptyStyle, otherwise use the passed colorClass + activeStyle
  const combinedClasses = `${baseClasses} ${isEmpty ? emptyStyle : colorClass + ' ' + activeStyle} ${pressedStyle}`;

  return (
    <button
      className={combinedClasses}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onContextMenu={onContextMenu}
    >
      <span className="absolute bottom-1 right-2 text-xs font-bold px-1.5 py-0.5 rounded-sm text-white bg-black/30">
        {label}
      </span>

      {/* Visual shine for active pads */}
      {!isEmpty && (
        <div className="absolute inset-0 rounded-md bg-linear-to-tr from-transparent to-white/10 pointer-events-none"></div>
      )}
    </button>
  );
};