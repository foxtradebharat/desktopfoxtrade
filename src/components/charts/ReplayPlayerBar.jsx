import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Scissors,
  Calendar,
  X,
  Crosshair,
  TrendingUp,
  Compass,
  Check,
  ChevronDown
} from 'lucide-react';

const SPEEDS = [0.5, 1, 2, 4, 8];

export default function ReplayPlayerBar({
  isReplaying,
  onTogglePlay,
  replayIndex,
  totalCandles,
  currentCandleTime,
  onStepBack,
  onStepForward,
  onSeek,
  replaySpeed,
  onChangeSpeed,
  onRestart,
  onExitReplay,
  onJumpToDate,
  isCutModeActive,
  onToggleCutMode,
  autoScroll,
  onToggleAutoScroll,
  isPracticeMode,
  onTogglePracticeMode,
  rawCandles = []
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [inputDate, setInputDate] = useState('');
  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  const handleApplyJump = () => {
    if (!inputDate) return;
    if (onJumpToDate) {
      onJumpToDate(inputDate);
    }
    setShowDatePicker(false);
  };

  const handleQuickJump = (monthsAgo) => {
    if (!rawCandles || rawCandles.length === 0) return;
    const now = new Date();
    const target = new Date();
    target.setMonth(now.getMonth() - monthsAgo);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (onJumpToDate) {
      onJumpToDate(dateStr);
    }
    setShowDatePicker(false);
  };

  // Format current candle date/time display
  const formattedTimeDisplay = (() => {
    if (!currentCandleTime) return '';
    if (typeof currentCandleTime === 'number') {
      const d = new Date(currentCandleTime * 1000);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
    const d = new Date(currentCandleTime);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    return String(currentCandleTime);
  })();

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color, #e5e7eb)',
        borderRadius: '12px',
        boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
        userSelect: 'none',
        fontSize: '11px',
        fontFamily: 'Inter, system-ui, sans-serif',
        maxWidth: 'calc(100% - 24px)'
      }}
    >
      {/* Replay Status Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          paddingRight: '6px',
          borderRight: '1px solid #e5e7eb'
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isReplaying ? '#10b981' : '#f59e0b',
            boxShadow: isReplaying ? '0 0 8px #10b981' : 'none',
            transition: 'all 0.2s ease'
          }}
        />
        <span
          style={{
            fontWeight: 800,
            fontSize: '10px',
            letterSpacing: '0.06em',
            color: '#111827',
            textTransform: 'uppercase'
          }}
        >
          Replay
        </span>
      </div>

      {/* Jump to Date / Cut Bar Button */}
      <div style={{ position: 'relative' }} ref={popoverRef}>
        <button
          onClick={() => setShowDatePicker(prev => !prev)}
          title="Jump to specific date in history"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: showDatePicker ? '1px solid #3b82f6' : '1px solid #e5e7eb',
            backgroundColor: showDatePicker ? 'rgba(59, 130, 246, 0.08)' : '#ffffff',
            color: showDatePicker ? '#2563eb' : '#111827',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <Calendar size={13} />
          <span>Jump</span>
          <ChevronDown size={11} style={{ opacity: 0.6 }} />
        </button>

        {/* Date Jump Popover */}
        {showDatePicker && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '240px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15)',
              padding: '12px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#111827' }}>
              Jump to Replay Date
            </div>
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                fontSize: '11px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleQuickJump(1)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                1M Ago
              </button>
              <button
                onClick={() => handleQuickJump(3)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                3M Ago
              </button>
              <button
                onClick={() => handleQuickJump(6)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                6M Ago
              </button>
              <button
                onClick={() => handleQuickJump(12)}
                style={{
                  padding: '3px 6px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                1Y Ago
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button
                onClick={() => setShowDatePicker(false)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  color: '#4b5563',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyJump}
                disabled={!inputDate}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: inputDate ? 'pointer' : 'not-allowed',
                  opacity: inputDate ? 1 : 0.5
                }}
              >
                Go to Date
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Cut to Bar Tool */}
      <button
        onClick={onToggleCutMode}
        title={isCutModeActive ? 'Click any candle to cut replay start point (Active)' : 'Select Bar on Chart to Cut Replay'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '6px',
          border: isCutModeActive ? '1px solid #ef4444' : '1px solid #e5e7eb',
          backgroundColor: isCutModeActive ? 'rgba(239, 68, 68, 0.1)' : '#ffffff',
          color: isCutModeActive ? '#dc2626' : '#111827',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Scissors size={12} style={{ transform: isCutModeActive ? 'rotate(-30deg)' : 'none' }} />
        <span>{isCutModeActive ? 'Select Bar...' : 'Cut Bar'}</span>
      </button>

      {/* Step Backward 1 Bar */}
      <button
        onClick={onStepBack}
        title="Step Backward 1 Bar (ArrowLeft)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#111827',
          cursor: 'pointer',
          transition: 'background-color 0.15s'
        }}
      >
        <SkipBack size={13} />
      </button>

      {/* Play / Pause Toggle Button */}
      <button
        onClick={onTogglePlay}
        title={isReplaying ? 'Pause Replay (Space)' : 'Play Bar Replay (Space)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: '#111827',
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.18)',
          transition: 'transform 0.1s ease, background-color 0.15s'
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isReplaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
      </button>

      {/* Step Forward 1 Bar */}
      <button
        onClick={onStepForward}
        title="Step Forward 1 Bar (ArrowRight)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#111827',
          cursor: 'pointer',
          transition: 'background-color 0.15s'
        }}
      >
        <SkipForward size={13} />
      </button>

      {/* Timeline Scrubber & Date Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
        <input
          type="range"
          min={1}
          max={Math.max(1, totalCandles)}
          value={Math.min(replayIndex, totalCandles)}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{
            width: '100px',
            accentColor: '#111827',
            cursor: 'pointer'
          }}
        />
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: 'monospace',
            color: '#111827',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>{formattedTimeDisplay}</span>
          <span style={{ color: '#9ca3af', fontWeight: 500, fontSize: '10px' }}>
            ({replayIndex}/{totalCandles})
          </span>
        </div>
      </div>

      {/* Speed Selector Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#f3f4f6',
          borderRadius: '6px',
          padding: '2px',
          gap: '2px'
        }}
      >
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onChangeSpeed(s)}
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: replaySpeed === s ? '#111827' : 'transparent',
              color: replaySpeed === s ? '#ffffff' : '#4b5563',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Auto-Scroll Toggle */}
      <button
        onClick={onToggleAutoScroll}
        title={autoScroll ? 'Auto-scroll is ON (Chart tracks newest revealed candle)' : 'Auto-scroll is OFF'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: autoScroll ? '1px solid #3b82f6' : '1px solid #e5e7eb',
          backgroundColor: autoScroll ? 'rgba(59, 130, 246, 0.08)' : '#ffffff',
          color: autoScroll ? '#2563eb' : '#6b7280',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <Compass size={14} />
      </button>

      {/* Practice Mode Toggle */}
      <button
        onClick={onTogglePracticeMode}
        title={isPracticeMode ? 'Hide Practice Mode Trading Panel' : 'Open Practice Mode (Simulated Paper Trading)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '6px',
          border: isPracticeMode ? '1px solid #10b981' : '1px solid #e5e7eb',
          backgroundColor: isPracticeMode ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
          color: isPracticeMode ? '#059669' : '#374151',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <TrendingUp size={12} />
        <span>Practice</span>
      </button>

      {/* Restart Replay */}
      <button
        onClick={onRestart}
        title="Restart Replay from beginning"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#111827',
          cursor: 'pointer'
        }}
      >
        <RotateCcw size={13} />
      </button>

      {/* Exit Replay Button */}
      <button
        onClick={onExitReplay}
        title="Exit Replay Mode (Escape)"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          color: '#ef4444',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
