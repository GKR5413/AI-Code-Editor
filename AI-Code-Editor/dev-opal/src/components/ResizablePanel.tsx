import React, { useState, useRef, useEffect, ReactNode, useMemo } from 'react';

type ResizeDirection = 'left' | 'right' | 'top' | 'bottom';
type PanelDirection = 'vertical' | 'horizontal';

interface ResizablePanelProps {
  children: ReactNode;
  className?: string;
  direction?: PanelDirection; // vertical => width, horizontal => height
  resizeDirection?: ResizeDirection; // which edge has the handle
  minSize?: number;
  maxSize?: number | string; // allows values like '50vh' for horizontal
  defaultSize?: number;
  onResize?: (size: number) => void;
  persistKey?: string; // if provided, persist size in localStorage
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  className = '',
  direction = 'vertical',
  resizeDirection,
  minSize = 200,
  maxSize = 600,
  defaultSize = 300,
  onResize,
  persistKey,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const resolvedResizeDirection: ResizeDirection = useMemo(() => {
    if (resizeDirection) return resizeDirection;
    return direction === 'vertical' ? 'right' : 'top';
  }, [direction, resizeDirection]);

  const getInitialSize = (): number => {
    if (persistKey) {
      const saved = localStorage.getItem(`panel-${persistKey}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) return parsed;
      }
    }
    return defaultSize;
  };

  const [size, setSize] = useState<number>(getInitialSize);
  const [isResizing, setIsResizing] = useState(false);

  const parseMaxSize = (raw: number | string, fallbackPx: number): number => {
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string' && direction === 'horizontal' && raw.endsWith('vh')) {
      const vh = parseFloat(raw.replace('vh', ''));
      if (!Number.isNaN(vh)) return Math.round((window.innerHeight * vh) / 100);
    }
    return fallbackPx;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();

      let newSize = size;
      if (direction === 'vertical') {
        newSize = resolvedResizeDirection === 'right'
          ? e.clientX - rect.left
          : rect.right - e.clientX;
      } else {
        // horizontal (height)
        newSize = resolvedResizeDirection === 'bottom'
          ? e.clientY - rect.top
          : rect.bottom - e.clientY;
      }

      const computedMax = parseMaxSize(maxSize, 600);
      const clamped = Math.max(minSize, Math.min(computedMax, newSize));
      setSize(clamped);
      onResize?.(clamped);
    };

    const handleMouseUp = () => {
      if (isResizing && persistKey) {
        localStorage.setItem(`panel-${persistKey}`, String(size));
      }
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [direction, isResizing, maxSize, minSize, onResize, parseMaxSize, persistKey, resolvedResizeDirection, size]);

  useEffect(() => {
    // Update size if persisted value exists after mount
    if (persistKey) {
      const saved = localStorage.getItem(`panel-${persistKey}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed)) setSize(parsed);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClasses = `resize-handle ${direction === 'vertical' ? 'resize-handle-vertical' : 'resize-handle-horizontal'} ${isResizing ? 'resizing' : ''} ${resolvedResizeDirection === 'left' || resolvedResizeDirection === 'top' ? 'order-first' : 'order-last'}`;

  const style = direction === 'vertical' ? { width: `${size}px` } : { height: `${size}px` };

  return (
    <div ref={panelRef} className={`relative flex ${direction === 'vertical' ? '' : 'flex-col'} ${className}`} style={style}>
      <div className="flex-1 min-w-0 min-h-0">
        {children}
      </div>
      <div className={handleClasses} onMouseDown={handleMouseDown} />
    </div>
  );
};

export default ResizablePanel;