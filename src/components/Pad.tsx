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

/**
 * Individual pad component with visual feedback and interaction handlers.
 * Displays different styles for empty vs active states and provides pressed animation.
 */
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

  const emptyStyle = "bg-pad-empty-bg shadow-pad-empty cursor-pointer opacity-100 hover:brightness-110";

  // Dynamic styles for active pad
  const shadowStyle = isPressed ? "shadow-pad-pressed translate-y-px" : "shadow-pad-raised";
  const activeStyle = `cursor-pointer hover:brightness-110 ${shadowStyle}`;

  const combinedClasses = `${baseClasses} ${isEmpty ? emptyStyle : colorClass + ' ' + activeStyle}`;

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

      {!isEmpty && (
        <div className="absolute inset-0 rounded-md bg-linear-to-tr from-transparent to-white/10 pointer-events-none"></div>
      )}
    </button>
  );
};