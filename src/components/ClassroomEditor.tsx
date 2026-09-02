import React, { useState, useEffect, useRef } from 'react';
import { ClassroomLayout, Bench } from '../types';
import {
  saveClassroomLayout,
  subscribeToClassroomLayout,
  DEFAULT_CLASSROOM_LAYOUT
} from '../services/classroomService';
import {
  Layers,
  Plus,
  RotateCcw,
  Trash2,
  CheckCircle,
  Loader2,
  HelpCircle,
  DoorOpen,
  Monitor,
  UserCheck,
  Edit2,
  Magnet,
  LayoutGrid
} from 'lucide-react';

export const ClassroomEditor: React.FC = () => {
  const [layout, setLayout] = useState<ClassroomLayout>(DEFAULT_CLASSROOM_LAYOUT);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // States for renaming a bench inline
  const [editingBenchId, setEditingBenchId] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');

  // Snapping and smart alignment guides state variables
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [snapLineY, setSnapLineY] = useState<number | null>(null);
  const [enableGridSnap, setEnableGridSnap] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Realtime subscription to the layout doc
  useEffect(() => {
    const unsubscribe = subscribeToClassroomLayout(
      (updatedLayout) => {
        setLayout(updatedLayout);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error listening to classroom layout:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleUpdateField = async (updatedFields: Partial<ClassroomLayout>) => {
    const updatedLayout = { ...layout, ...updatedFields };
    setLayout(updatedLayout);
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await saveClassroomLayout(updatedLayout);
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (err) {
      console.error('Failed to save classroom layout:', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBench = () => {
    const benches = layout.benches || [];
    const nextNum = benches.length + 1;
    const newBench: Bench = {
      id: `bench-${Date.now()}`,
      name: `Bench ${nextNum}`,
      x: 50,
      y: 50
    };
    handleUpdateField({ benches: [...benches, newBench] });
  };

  const handleDeleteBench = (benchId: string) => {
    const benches = layout.benches || [];
    const filtered = benches.filter(b => b.id !== benchId);
    handleUpdateField({ benches: filtered });
  };

  const handleAutoAlign = () => {
    const benches = layout.benches || [];
    if (benches.length === 0) return;

    // Arrange into 3 columns: 25%, 50%, 75%
    const totalCols = 3;
    const colPositions = [25, 50, 75];
    const totalRows = Math.ceil(benches.length / totalCols);

    const updatedBenches = benches.map((bench, index) => {
      const c = index % totalCols;
      const r = Math.floor(index / totalCols);

      const targetX = colPositions[c];
      
      // Calculate Y coordinate based on row density
      let targetY = 50;
      if (totalRows > 1) {
        const minY = 24; // Leave room for teacher/smartboard at the front (top)
        const maxY = 76; // Leave room at the back (bottom)
        const stepY = (maxY - minY) / (totalRows - 1);
        targetY = minY + r * stepY;
      }

      return {
        ...bench,
        x: Math.round(targetX),
        y: Math.round(targetY)
      };
    });

    handleUpdateField({ benches: updatedBenches });
  };

  const handleResetBenches = () => {
    if (window.confirm('Reset classroom to the default 6 benches?')) {
      handleUpdateField({
        benches: DEFAULT_CLASSROOM_LAYOUT.benches
      });
    }
  };

  const startRenameBench = (bench: Bench) => {
    setEditingBenchId(bench.id);
    setTempName(bench.name);
  };

  const handleSaveRename = (benchId: string) => {
    if (!tempName.trim()) return;
    const benches = layout.benches || [];
    const updated = benches.map(b => 
      b.id === benchId ? { ...b, name: tempName.trim() } : b
    );
    setEditingBenchId(null);
    handleUpdateField({ benches: updated });
  };

  // Pointer dragging handler with built-in snapping and smart alignment guides
  const handleStartDrag = (e: React.PointerEvent<HTMLDivElement>, benchId: string) => {
    // Only drag with primary click and if not editing rename
    if (e.button !== 0 || editingBenchId === benchId) return;
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // Track active move
    const handleMove = (moveEvent: PointerEvent) => {
      const xPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;

      let targetX = xPercent;
      let targetY = yPercent;

      let currentSnapLineX: number | null = null;
      let currentSnapLineY: number | null = null;

      // 1. Grid Snapping (increments of 5%)
      if (enableGridSnap) {
        targetX = Math.round(targetX / 5) * 5;
        targetY = Math.round(targetY / 5) * 5;
      }

      // 2. Alignment Snapping (to other benches X or Y)
      const otherBenches = (layout.benches || []).filter(b => b.id !== benchId);
      const snapThreshold = 3.5; // Snap tolerance percentage

      for (const b of otherBenches) {
        if (Math.abs(targetX - b.x) < snapThreshold) {
          targetX = b.x;
          currentSnapLineX = b.x;
          break;
        }
      }

      for (const b of otherBenches) {
        if (Math.abs(targetY - b.y) < snapThreshold) {
          targetY = b.y;
          currentSnapLineY = b.y;
          break;
        }
      }

      // 3. Center line snapping (50% mark)
      if (Math.abs(targetX - 50) < snapThreshold) {
        targetX = 50;
        currentSnapLineX = 50;
      }
      if (Math.abs(targetY - 50) < snapThreshold) {
        targetY = 50;
        currentSnapLineY = 50;
      }

      // Clamp bench coordinates safely inside classroom walls
      const clampedX = Math.max(6, Math.min(94, Math.round(targetX)));
      const clampedY = Math.max(14, Math.min(86, Math.round(targetY)));

      // Render snap guides in real-time
      setSnapLineX(currentSnapLineX);
      setSnapLineY(currentSnapLineY);

      setLayout(prev => {
        const updatedBenches = (prev.benches || []).map(b =>
          b.id === benchId ? { ...b, x: clampedX, y: clampedY } : b
        );
        return { ...prev, benches: updatedBenches };
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);

      // Reset snap guides
      setSnapLineX(null);
      setSnapLineY(null);

      // Persist the final position on mouse up
      setLayout(latest => {
        handleUpdateField({ benches: latest.benches });
        return latest;
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const toggleWindowLocation = (wall: 'Left-Wall' | 'Right-Wall' | 'Back-Wall' | 'Front-Wall') => {
    const current = layout.windowLocations || [];
    const updated = current.includes(wall)
      ? current.filter((w) => w !== wall)
      : [...current, wall];
    handleUpdateField({ windowLocations: updated });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-900 rounded-lg p-12 text-center shadow-[2px_2px_0px_rgba(0,0,0,1)]">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-900 mx-auto mb-3" />
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
          Synchronizing physical blueprint workspace...
        </p>
      </div>
    );
  }

  const benches = layout.benches || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Floor Plan Designer Column (8 cols) */}
      <div className="lg:col-span-8 bg-white border border-neutral-900 rounded-lg p-5 shadow-[2px_2px_0px_rgba(0,0,0,1)] space-y-4">
        
        {/* Minimal header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 animate-pulse" />
            <h3 className="text-xs uppercase tracking-wider font-mono font-bold text-neutral-900">
              Tactile Drag & Drop Classroom Planner
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {isSaving ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-neutral-900" /> Auto-Saving...
              </span>
            ) : saveStatus === 'success' ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                <CheckCircle className="w-2.5 h-2.5 text-emerald-600" /> Changes Synced
              </span>
            ) : (
              <span className="text-[10px] font-mono text-neutral-400">
                Live Coordinate Tracking
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Draggable Floor Plan Canvas */}
        <div 
          ref={containerRef}
          className="relative w-full aspect-[4/3] max-h-[460px] bg-neutral-50 border border-neutral-300 rounded-md overflow-hidden select-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e5e5 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px'
          }}
        >
          {/* North Label */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-black font-mono text-neutral-400 tracking-widest">
            ▲ FRONT (NORTH)
          </div>

          {/* Boundaries - Smart Board Wall Indicator (centered) */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-neutral-200 border-b border-neutral-300">
            {layout.smartBoardLocation === 'Front' && (
              <span className="absolute top-1 left-1/2 -translate-x-1/2 bg-neutral-900 text-white font-mono text-[8px] px-3 py-0.5 rounded font-black tracking-widest z-10 flex items-center gap-1 border border-neutral-950 shadow-sm whitespace-nowrap uppercase">
                <Monitor className="w-2.5 h-2.5" /> SMART BOARD
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-2 bg-neutral-200 border-t border-neutral-300">
            {layout.smartBoardLocation === 'Back' && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-neutral-900 text-white font-mono text-[8px] px-3 py-0.5 rounded font-black tracking-widest z-10 flex items-center gap-1 border border-neutral-950 shadow-sm whitespace-nowrap uppercase">
                <Monitor className="w-2.5 h-2.5" /> SMART BOARD
              </span>
            )}
          </div>

          <div className="absolute left-0 top-0 bottom-0 w-2 bg-neutral-200 border-r border-neutral-300">
            {layout.smartBoardLocation === 'Left' && (
              <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 bg-neutral-900 text-white font-mono text-[8px] px-3 py-0.5 rounded font-black tracking-widest z-10 flex items-center gap-1 border border-neutral-950 shadow-sm whitespace-nowrap uppercase">
                <Monitor className="w-2.5 h-2.5" /> SMART BOARD
              </span>
            )}
          </div>

          <div className="absolute right-0 top-0 bottom-0 w-2 bg-neutral-200 border-l border-neutral-300">
            {layout.smartBoardLocation === 'Right' && (
              <span className="absolute right-1 top-1/2 -translate-y-1/2 rotate-90 bg-neutral-900 text-white font-mono text-[8px] px-3 py-0.5 rounded font-black tracking-widest z-10 flex items-center gap-1 border border-neutral-950 shadow-sm whitespace-nowrap uppercase">
                <Monitor className="w-2.5 h-2.5" /> SMART BOARD
              </span>
            )}
          </div>

          {/* Active Alignment/Snapping Visual Guides */}
          {snapLineX !== null && (
            <div 
              className="absolute top-0 bottom-0 border-l border-dashed border-sky-500 z-30 pointer-events-none"
              style={{ left: `${snapLineX}%` }}
            >
              <span className="absolute top-3 left-1 text-[7px] font-mono font-bold bg-sky-50 text-sky-800 px-1 py-0.5 rounded shadow border border-sky-200 whitespace-nowrap">
                Align X: {Math.round(snapLineX)}%
              </span>
            </div>
          )}
          {snapLineY !== null && (
            <div 
              className="absolute left-0 right-0 border-t border-dashed border-sky-500 z-30 pointer-events-none"
              style={{ top: `${snapLineY}%` }}
            >
              <span className="absolute left-3 top-1 text-[7px] font-mono font-bold bg-sky-50 text-sky-800 px-1 py-0.5 rounded shadow border border-sky-200 whitespace-nowrap">
                Align Y: {Math.round(snapLineY)}%
              </span>
            </div>
          )}

          {/* Entrance Door Label */}
          {(() => {
            const doorPosMap: Record<typeof layout.doorLocation, string> = {
              'Front-Left': 'absolute top-2 left-2 z-10',
              'Front-Right': 'absolute top-2 right-2 z-10',
              'Back-Left': 'absolute bottom-2 left-2 z-10',
              'Back-Right': 'absolute bottom-2 right-2 z-10',
              'Left-Wall': 'absolute left-2 top-1/2 -translate-y-1/2 z-10',
              'Right-Wall': 'absolute right-2 top-1/2 -translate-y-1/2 z-10',
            };
            return (
              <div className={doorPosMap[layout.doorLocation]}>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-900 font-mono font-bold text-[8px] px-1.5 py-0.5 rounded border border-amber-300 shadow-sm">
                  <DoorOpen className="w-2.5 h-2.5" />
                  <span>DOORWAY</span>
                </div>
              </div>
            );
          })()}

          {/* Teacher Desk Label */}
          {(() => {
            if (layout.teacherDeskLocation === 'None') return null;
            const deskPosMap: Record<Exclude<typeof layout.teacherDeskLocation, 'None'>, string> = {
              'Front-Left': 'absolute top-6 left-6 z-10',
              'Front-Right': 'absolute top-6 right-6 z-10',
              'Front-Center': 'absolute top-6 left-1/2 -translate-x-1/2 z-10',
              'Back-Left': 'absolute bottom-6 left-6 z-10',
              'Back-Right': 'absolute bottom-6 right-6 z-10',
            };
            return (
              <div className={deskPosMap[layout.teacherDeskLocation]}>
                <div className="bg-neutral-800 text-white font-mono text-[8px] px-2 py-0.5 rounded border border-neutral-950 shadow-sm flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5" />
                  <span>TEACHER</span>
                </div>
              </div>
            );
          })()}

          {/* Dynamic Draggable Benches */}
          {benches.map((bench) => {
            const isEditing = editingBenchId === bench.id;
            return (
              <div
                key={bench.id}
                onPointerDown={(e) => handleStartDrag(e, bench.id)}
                className={`absolute w-[110px] bg-white border border-neutral-900 rounded p-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-transform select-none z-20 cursor-grab active:cursor-grabbing ${
                  isEditing ? 'border-dashed border-neutral-400 cursor-default' : ''
                }`}
                style={{
                  left: `${bench.x}%`,
                  top: `${bench.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="flex items-center justify-between gap-1 border-b border-neutral-200 pb-1 mb-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => handleSaveRename(bench.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(bench.id)}
                      autoFocus
                      className="w-full text-[9px] font-mono px-1 border border-neutral-300 focus:outline-none focus:border-neutral-950 bg-white"
                    />
                  ) : (
                    <span 
                      onDoubleClick={() => startRenameBench(bench)}
                      className="text-[9px] font-mono font-black text-neutral-800 truncate cursor-pointer hover:underline"
                      title="Double-click to rename"
                    >
                      {bench.name}
                    </span>
                  )}
                  
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => startRenameBench(bench)}
                      className="p-0.5 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBench(bench.id)}
                      className="p-0.5 hover:bg-neutral-100 text-neutral-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>

                {/* Left/Right Seats diagram */}
                <div className="grid grid-cols-2 gap-1">
                  <div className="border border-dashed border-neutral-200 rounded text-[8px] py-1 text-center font-mono text-neutral-400 bg-neutral-50/50">
                    L
                  </div>
                  <div className="border border-dashed border-neutral-200 rounded text-[8px] py-1 text-center font-mono text-neutral-400 bg-neutral-50/50">
                    R
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dynamic Controls Action Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="text-[10px] text-neutral-400 font-mono">
            * Drag any bench to align • Double-click a title to rename
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEnableGridSnap(!enableGridSnap)}
              className={`px-3 py-1.5 font-mono text-xs font-bold rounded border flex items-center gap-1.5 cursor-pointer transition-all shadow-sm ${
                enableGridSnap 
                  ? 'bg-sky-50 border-sky-400 text-sky-800 hover:bg-sky-100' 
                  : 'bg-white border-neutral-300 text-neutral-500 hover:bg-neutral-50'
              }`}
              title="Toggle snapping alignment (snaps to 5% grid increments and snaps to align with other benches and centerlines)"
            >
              <Magnet className={`w-3.5 h-3.5 ${enableGridSnap ? 'text-sky-600 animate-pulse' : ''}`} />
              <span>{enableGridSnap ? 'Snapping On' : 'Snapping Off'}</span>
            </button>
            <button
              type="button"
              onClick={handleAutoAlign}
              className="px-3 py-1.5 bg-white border border-sky-400 hover:bg-sky-50 text-sky-800 font-mono text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              title="Symmetrically arrange all benches into a neat 3-column layout relative to the room center"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-600" /> Symmetrical Align (3-Col)
            </button>
            <button
              type="button"
              onClick={handleResetBenches}
              className="px-3 py-1.5 bg-white border border-neutral-900 hover:bg-neutral-50 text-neutral-900 font-mono text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Default Layout
            </button>
            <button
              type="button"
              onClick={handleAddBench}
              className="px-4 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Extra Bench
            </button>
          </div>
        </div>
      </div>

      {/* Settings Side Panel Column (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Bounds Settings Card */}
        <div className="bg-white border border-neutral-900 rounded-lg p-5 shadow-[2px_2px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <Layers className="w-4 h-4 text-neutral-700" />
            <div>
              <h3 className="font-bold text-xs text-neutral-950 uppercase tracking-wide">
                Classroom Elements
              </h3>
              <p className="text-[10px] text-neutral-400 font-mono">Position boundaries and teacher desk</p>
            </div>
          </div>

          {/* Smart Board Position Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
              📺 Smart Board Wall
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['Front', 'Back', 'Left', 'Right'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleUpdateField({ smartBoardLocation: loc })}
                  className={`px-1 py-1 font-mono text-[10px] font-bold rounded border transition-all cursor-pointer ${
                    layout.smartBoardLocation === loc
                      ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm'
                      : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Door Position Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
              🚪 Entrance Door Location
            </label>
            <div className="grid grid-cols-2 gap-1">
              {(['Front-Left', 'Front-Right', 'Back-Left', 'Back-Right', 'Left-Wall', 'Right-Wall'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleUpdateField({ doorLocation: loc })}
                  className={`px-1 py-1 font-mono text-[10px] font-bold rounded border transition-all cursor-pointer ${
                    layout.doorLocation === loc
                      ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm'
                      : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                  }`}
                >
                  {loc.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Teacher Desk Position Selector */}
          <div className="space-y-1">
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
              🪑 Teacher's Desk Placement
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['Front-Left', 'Front-Right', 'Front-Center', 'Back-Left', 'Back-Right', 'None'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleUpdateField({ teacherDeskLocation: loc })}
                  className={`px-1 py-1 font-mono text-[9px] font-bold rounded border transition-all cursor-pointer ${
                    layout.teacherDeskLocation === loc
                      ? 'bg-neutral-950 text-white border-neutral-950 shadow-sm'
                      : 'bg-white hover:bg-neutral-50 border-neutral-200 text-neutral-600'
                  }`}
                >
                  {loc === 'None' ? 'No Desk' : loc}
                </button>
              ))}
            </div>
          </div>

          {/* Custom constraints / Notes */}
          <div className="space-y-1 pt-2 border-t border-neutral-100">
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 font-mono">
              📝 Layout Behavioral Directives (for AI)
            </label>
            <textarea
              value={layout.customNotes || ''}
              onChange={(e) => handleUpdateField({ customNotes: e.target.value })}
              placeholder="e.g. Put easily distracted students on the right side benches, away from the back door."
              className="w-full text-xs p-2 bg-neutral-50 rounded border border-neutral-200 focus:outline-none focus:border-neutral-950 leading-relaxed min-h-[70px] font-sans"
            />
          </div>
        </div>

        {/* Minimal Information Card */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2 text-[11px] text-neutral-600 font-mono">
          <div className="font-bold text-neutral-900 uppercase">
            Optimization Engine Highlights
          </div>
          <p className="leading-relaxed font-sans">
            Benches contain physical grid coordinates. When optimized, the AI parses exact proximity distance metrics from the Smart Board, doorway, and teacher to seat the students perfectly.
          </p>
        </div>

      </div>
    </div>
  );
};
