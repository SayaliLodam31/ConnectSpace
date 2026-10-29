'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PenTool,
  Eraser,
  Square,
  Circle,
  Minus,
  Type,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
  Palette,
  Loader2,
} from 'lucide-react';
import { WhiteboardItem, WhiteboardItemType } from '@/types/database';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface WhiteboardPanelProps {
  meetingId: string;
  currentUserId: string;
  isHost: boolean;
  onClose: () => void;
}

const COLORS = [
  '#0F172A', // Slate 900
  '#2563EB', // Blue 600
  '#4F46E5', // Indigo 600
  '#DC2626', // Red 600
  '#16A34A', // Emerald 600
  '#EA580C', // Orange 600
  '#9333EA', // Purple 600
];

const STROKE_WIDTHS = [2, 4, 6, 10];

export function WhiteboardPanel({
  meetingId,
  currentUserId,
  isHost,
  onClose,
}: WhiteboardPanelProps) {
  const supabase = getSupabaseBrowserClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<WhiteboardItemType>('stroke');
  const [selectedColor, setSelectedColor] = useState<string>('#2563EB');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [whiteboardId, setWhiteboardId] = useState<string | null>(null);

  // In-memory items list for undo/redo and redrawing
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardItem[]>([]);
  const isDrawing = useRef(false);
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const startPoint = useRef<{ x: number; y: number } | null>(null);

  // Initialize or fetch whiteboard for meeting
  useEffect(() => {
    async function initWhiteboard() {
      // Find or create whiteboard
      let { data: wb, error } = await supabase
        .from('whiteboards')
        .select('*')
        .eq('meeting_id', meetingId)
        .single();

      if (!wb) {
        const { data: newWb } = await supabase
          .from('whiteboards')
          .insert({
            meeting_id: meetingId,
            name: 'Main Whiteboard',
            created_by: currentUserId,
          })
          .select()
          .single();
        wb = newWb;
      }

      if (wb) {
        setWhiteboardId(wb.id);

        // Fetch existing items
        const { data: existingItems } = await supabase
          .from('whiteboard_items')
          .select('*')
          .eq('whiteboard_id', wb.id)
          .order('created_at', { ascending: true });

        if (existingItems) {
          setItems(existingItems as WhiteboardItem[]);
        }
      }
    }

    initWhiteboard();
  }, [meetingId, currentUserId, supabase]);

  // Redraw canvas whenever items change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear whole canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const item of items) {
      ctx.save();
      ctx.strokeStyle = item.data.color || '#2563EB';
      ctx.lineWidth = item.data.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (item.item_type === 'stroke' || item.item_type === 'eraser') {
        if (item.item_type === 'eraser') {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = (item.data.width || 3) * 3;
        }

        const pts = item.data.points || [];
        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
      } else if (item.item_type === 'shape') {
        const { shapeType, x = 0, y = 0, widthPx = 0, heightPx = 0 } = item.data;
        ctx.beginPath();
        if (shapeType === 'rectangle') {
          ctx.strokeRect(x, y, widthPx, heightPx);
        } else if (shapeType === 'circle') {
          const radius = Math.sqrt(widthPx * widthPx + heightPx * heightPx) / 2;
          ctx.arc(x + widthPx / 2, y + heightPx / 2, radius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (shapeType === 'line') {
          ctx.moveTo(x, y);
          ctx.lineTo(x + widthPx, y + heightPx);
          ctx.stroke();
        }
      } else if (item.item_type === 'text') {
        ctx.font = `${(item.data.width || 3) * 5 + 12}px sans-serif`;
        ctx.fillStyle = item.data.color || '#0F172A';
        ctx.fillText(item.data.text || '', item.data.x || 50, item.data.y || 50);
      }

      ctx.restore();
    }
  }, [items]);

  useEffect(() => {
    redrawCanvas();
  }, [items, redrawCanvas]);

  // Subscribe to real-time whiteboard item broadcasts & inserts
  useEffect(() => {
    if (!whiteboardId) return;

    const channel = supabase
      .channel(`whiteboard:${whiteboardId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whiteboard_items',
          filter: `whiteboard_id=eq.${whiteboardId}`,
        },
        (payload) => {
          const newItem = payload.new as WhiteboardItem;
          setItems((prev) => {
            if (prev.some((it) => it.id === newItem.id)) return prev;
            return [...prev, newItem];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'whiteboard_items',
          filter: `whiteboard_id=eq.${whiteboardId}`,
        },
        (payload) => {
          setItems((prev) => prev.filter((it) => it.id !== payload.old.id));
        }
      )
      .on('broadcast', { event: 'clear' }, () => {
        setItems([]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [whiteboardId, supabase]);

  // Resize canvas to match container
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.parentElement?.getBoundingClientRect();
        if (rect) {
          canvasRef.current.width = rect.width;
          canvasRef.current.height = rect.height;
          redrawCanvas();
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const coords = getCanvasCoords(e);
    startPoint.current = coords;
    currentPoints.current = [coords];

    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        saveWhiteboardItem('text', {
          text,
          x: coords.x,
          y: coords.y,
          color: selectedColor,
          width: strokeWidth,
        });
      }
      isDrawing.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const coords = getCanvasCoords(e);

    if (tool === 'stroke' || tool === 'eraser') {
      currentPoints.current.push(coords);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && currentPoints.current.length > 1) {
        ctx.save();
        ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : selectedColor;
        ctx.lineWidth = tool === 'eraser' ? strokeWidth * 3 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const p1 = currentPoints.current[currentPoints.current.length - 2];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const coords = getCanvasCoords(e);

    if (tool === 'stroke' || tool === 'eraser') {
      if (currentPoints.current.length > 1) {
        saveWhiteboardItem(tool, {
          points: currentPoints.current,
          color: tool === 'eraser' ? '#FFFFFF' : selectedColor,
          width: strokeWidth,
        });
      }
    } else if (tool === 'shape' && startPoint.current) {
      const widthPx = coords.x - startPoint.current.x;
      const heightPx = coords.y - startPoint.current.y;
      saveWhiteboardItem('shape', {
        shapeType: 'rectangle',
        x: startPoint.current.x,
        y: startPoint.current.y,
        widthPx,
        heightPx,
        color: selectedColor,
        width: strokeWidth,
      });
    }

    currentPoints.current = [];
    startPoint.current = null;
  };

  const saveWhiteboardItem = async (itemType: WhiteboardItemType, data: any) => {
    if (!whiteboardId) return;

    // Optimistic local update
    const tempItem: WhiteboardItem = {
      id: Math.random().toString(36).substring(2, 9),
      whiteboard_id: whiteboardId,
      created_by: currentUserId,
      item_type: itemType,
      data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setItems((prev) => [...prev, tempItem]);
    setRedoStack([]);

    // Persist in Supabase
    const { data: saved, error } = await supabase
      .from('whiteboard_items')
      .insert({
        whiteboard_id: whiteboardId,
        created_by: currentUserId,
        item_type: itemType,
        data,
      })
      .select()
      .single();

    if (!error && saved) {
      setItems((prev) => prev.map((it) => (it.id === tempItem.id ? (saved as WhiteboardItem) : it)));
    }
  };

  const handleUndo = async () => {
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    setItems((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [lastItem, ...prev]);

    if (lastItem.id && !lastItem.id.includes('.')) {
      await supabase.from('whiteboard_items').delete().eq('id', lastItem.id);
    }
  };

  const handleRedo = async () => {
    if (redoStack.length === 0) return;
    const itemToRestore = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    saveWhiteboardItem(itemToRestore.item_type, itemToRestore.data);
  };

  const handleClear = async () => {
    if (!confirm('Clear the entire whiteboard for all participants?')) return;
    setItems([]);
    setRedoStack([]);
    if (whiteboardId) {
      await supabase.from('whiteboard_items').delete().eq('whiteboard_id', whiteboardId);
      const ch = supabase.channel(`whiteboard:${whiteboardId}`);
      ch.send({
        type: 'broadcast',
        event: 'clear',
        payload: {},
      });
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md flex flex-col">
      {/* Top Toolbar */}
      <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between gap-4 bg-white select-none">
        {/* Tools: Pen, Eraser, Shape, Text */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setTool('stroke')}
            title="Pen Tool"
            className={cn(
              'p-2 rounded-lg text-xs font-medium transition-colors',
              tool === 'stroke' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTool('eraser')}
            title="Eraser Tool"
            className={cn(
              'p-2 rounded-lg text-xs font-medium transition-colors',
              tool === 'eraser' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Eraser className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTool('shape')}
            title="Rectangle Shape"
            className={cn(
              'p-2 rounded-lg text-xs font-medium transition-colors',
              tool === 'shape' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTool('text')}
            title="Text Tool"
            className={cn(
              'p-2 rounded-lg text-xs font-medium transition-colors',
              tool === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Type className="w-4 h-4" />
          </button>
        </div>

        {/* Colors & Width */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'w-6 h-6 rounded-full transition-transform',
                  selectedColor === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'
                )}
              />
            ))}
          </div>

          <div className="h-5 w-[1px] bg-slate-200" />

          <div className="flex items-center gap-1">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={cn(
                  'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold',
                  strokeWidth === w ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {w}px
              </button>
            ))}
          </div>
        </div>

        {/* History & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={items.length === 0}
            title="Undo"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            title="Clear whiteboard"
            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-[1px] bg-slate-200" />

          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" />
            Close Whiteboard
          </Button>
        </div>
      </div>

      {/* Drawing Canvas */}
      <div className="flex-1 relative cursor-crosshair overflow-hidden bg-slate-50">
        {!whiteboardId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 gap-2 select-none">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Connecting to Collaborative Whiteboard...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full block bg-white"
        />
      </div>
    </div>
  );
}
