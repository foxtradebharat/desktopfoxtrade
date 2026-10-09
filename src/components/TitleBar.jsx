import React, { useState, useEffect, useRef } from 'react';
import foxtradeSquareIcon from '../assets/logo/foxtrade-square-icon-safe-transparent-1024.png';
import UpdatePill from './UpdatePill';
import { Minus, Square, Copy, X, Check, ArrowUpCircle } from 'lucide-react';

export default function TitleBar({ onOpenSettings, onNewTrade, onImportTrades, onToggleTheme, onOpenUpdateModal }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [hasUpdate, setHasUpdate] = useState(false);
  const barRef = useRef(null);

  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (!isElectron) return;

    // Track maximized state
    if (window.electronAPI?.window) {
      window.electronAPI.window.isMaximized().then(setIsMaximized).catch(() => {});
      const unsubMax = window.electronAPI.window.onMaximizedChange((val) => {
        setIsMaximized(Boolean(val));
      });
      return () => {
        if (unsubMax) unsubMax();
      };
    }
  }, [isElectron]);

  useEffect(() => {
    if (!isElectron) return;

    // Get app version
    if (window.electronAPI?.updater) {
      window.electronAPI.updater.getVersion().then(ver => {
        if (ver) setAppVersion(ver);
      }).catch(() => {});

      const unsubUpdate = window.electronAPI.updater.onStatus((data) => {
        if (data?.status === 'available' || data?.status === 'downloaded') {
          setHasUpdate(true);
        }
      });
      return () => {
        if (unsubUpdate) unsubUpdate();
      };
    }
  }, [isElectron]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to native menu IPC triggers
  useEffect(() => {
    const handleCheckUpdates = () => onOpenUpdateModal?.();
    const handleOpenSettings = () => onOpenSettings?.();
    const handleNewTrade = () => onNewTrade?.();
    const handleImportTrades = () => onImportTrades?.();
    const handleToggleTheme = () => onToggleTheme?.();

    window.addEventListener('menu:check-updates', handleCheckUpdates);
    window.addEventListener('menu:open-settings', handleOpenSettings);
    window.addEventListener('menu:new-trade', handleNewTrade);
    window.addEventListener('menu:import-trades', handleImportTrades);
    window.addEventListener('menu:toggle-theme', handleToggleTheme);

    return () => {
      window.removeEventListener('menu:check-updates', handleCheckUpdates);
      window.removeEventListener('menu:open-settings', handleOpenSettings);
      window.removeEventListener('menu:new-trade', handleNewTrade);
      window.removeEventListener('menu:import-trades', handleImportTrades);
      window.removeEventListener('menu:toggle-theme', handleToggleTheme);
    };
  }, [onOpenUpdateModal, onOpenSettings, onNewTrade, onImportTrades, onToggleTheme]);

  if (!isElectron) {
    return null; // Keep existing web version 100% untouched
  }

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize?.();
  };

  const handleMaximizeToggle = () => {
    window.electronAPI?.window?.toggleMaximize?.();
  };

  const handleClose = () => {
    window.electronAPI?.window?.close?.();
  };

  const handleZoom = (type) => {
    if (type === 'in') window.electronAPI?.zoom?.zoomIn();
    if (type === 'out') window.electronAPI?.zoom?.zoomOut();
    if (type === 'reset') window.electronAPI?.zoom?.resetZoom();
  };

  const menuItems = [
    {
      id: 'app',
      label: 'FoxTrade',
      bold: true,
      items: [
        { label: `Version ${appVersion}`, disabled: true, isVersion: true },
        {
          label: 'Check for Updates…',
          onClick: () => {
            setActiveMenu(null);
            onOpenUpdateModal?.();
          }
        },
        { divider: true },
        {
          label: 'Preferences / Settings',
          shortcut: 'Ctrl+,',
          onClick: () => {
            setActiveMenu(null);
            onOpenSettings?.();
          }
        },
        { divider: true },
        {
          label: 'Quit FoxTrade',
          shortcut: 'Alt+F4',
          onClick: () => handleClose()
        }
      ]
    },
    {
      id: 'file',
      label: 'File',
      items: [
        {
          label: 'New Trade',
          shortcut: 'Ctrl+N',
          onClick: () => {
            setActiveMenu(null);
            onNewTrade?.();
          }
        },
        {
          label: 'Import Broker Trades (CSV)…',
          shortcut: 'Ctrl+O',
          onClick: () => {
            setActiveMenu(null);
            onImportTrades?.();
          }
        },
        { divider: true },
        {
          label: 'Settings…',
          shortcut: 'Ctrl+,',
          onClick: () => {
            setActiveMenu(null);
            onOpenSettings?.();
          }
        },
        { divider: true },
        {
          label: 'Close Window',
          shortcut: 'Ctrl+W',
          onClick: () => handleClose()
        }
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', onClick: () => document.execCommand('undo') },
        { label: 'Redo', shortcut: 'Ctrl+Y', onClick: () => document.execCommand('redo') },
        { divider: true },
        { label: 'Cut', shortcut: 'Ctrl+X', onClick: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: 'Ctrl+C', onClick: () => document.execCommand('copy') },
        { label: 'Paste', shortcut: 'Ctrl+V', onClick: () => document.execCommand('paste') },
        { divider: true },
        { label: 'Select All', shortcut: 'Ctrl+A', onClick: () => document.execCommand('selectAll') }
      ]
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          label: 'Toggle Dark / Light Mode',
          onClick: () => {
            setActiveMenu(null);
            onToggleTheme?.();
          }
        },
        { divider: true },
        {
          label: 'Zoom In',
          shortcut: 'Ctrl++',
          onClick: () => handleZoom('in')
        },
        {
          label: 'Zoom Out',
          shortcut: 'Ctrl+-',
          onClick: () => handleZoom('out')
        },
        {
          label: 'Reset Zoom',
          shortcut: 'Ctrl+0',
          onClick: () => handleZoom('reset')
        },
        { divider: true },
        {
          label: 'Toggle Full Screen',
          shortcut: 'F11',
          onClick: () => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }
        },
        {
          label: 'Reload App',
          shortcut: 'Ctrl+R',
          onClick: () => window.location.reload()
        }
      ]
    },
    {
      id: 'window',
      label: 'Window',
      items: [
        { label: 'Minimize', shortcut: 'Ctrl+M', onClick: () => handleMinimize() },
        { label: isMaximized ? 'Restore Window' : 'Maximize Window', onClick: () => handleMaximizeToggle() },
        { divider: true },
        { label: 'Close Window', shortcut: 'Ctrl+W', onClick: () => handleClose() }
      ]
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        {
          label: 'FoxTrade Official Website',
          onClick: () => {
            setActiveMenu(null);
            window.open('https://foxtrade.in', '_blank');
          }
        },
        {
          label: 'Foxy AI Trading Coach Guide',
          onClick: () => {
            setActiveMenu(null);
            window.open('https://foxtrade.in', '_blank');
          }
        },
        { divider: true },
        {
          label: 'Check for Updates…',
          onClick: () => {
            setActiveMenu(null);
            onOpenUpdateModal?.();
          }
        },
        { divider: true },
        {
          label: `About FoxTrade (${appVersion})`,
          onClick: () => {
            setActiveMenu(null);
            onOpenUpdateModal?.();
          }
        }
      ]
    }
  ];

  return (
    <div
      ref={barRef}
      onDoubleClick={handleMaximizeToggle}
      style={{
        height: '34px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--titlebar-bg, #181818)',
        color: 'var(--titlebar-text, #e5e7eb)',
        borderBottom: '1px solid var(--titlebar-border, rgba(255, 255, 255, 0.08))',
        userSelect: 'none',
        WebkitAppRegion: 'drag',
        fontSize: '12.5px',
        fontWeight: 500,
        zIndex: 9999,
        position: 'relative'
      }}
    >
      {/* Dynamic CSS variables based on theme */}
      <style>{`
        :root {
          --titlebar-bg: #181818;
          --titlebar-text: #e5e7eb;
          --titlebar-border: rgba(255, 255, 255, 0.08);
          --titlebar-hover: rgba(255, 255, 255, 0.08);
          --menu-popup-bg: #202020;
          --menu-popup-border: #333333;
          --titlebar-logo-filter: none;
        }
        :root:not(.dark) {
          --titlebar-bg: #f3f4f6;
          --titlebar-text: #1f2937;
          --titlebar-border: rgba(0, 0, 0, 0.08);
          --titlebar-hover: rgba(0, 0, 0, 0.06);
          --menu-popup-bg: #ffffff;
          --menu-popup-border: #e5e7eb;
          --titlebar-logo-filter: invert(1) brightness(0.15);
        }
      `}</style>

      {/* Left: App Logo + Menu Dropdowns */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' }}>
        {/* Menu Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {menuItems.map((menu) => (
            <div key={menu.id} style={{ position: 'relative', height: '100%' }}>
              <button
                type="button"
                onClick={() => setActiveMenu(activeMenu === menu.id ? null : menu.id)}
                onMouseEnter={() => {
                  if (activeMenu !== null) setActiveMenu(menu.id);
                }}
                style={{
                  height: '100%',
                  padding: menu.id === 'app' ? '0 10px' : '0 8px',
                  background: activeMenu === menu.id ? 'var(--titlebar-hover)' : 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '12.5px',
                  fontWeight: menu.bold ? 600 : 400,
                  cursor: 'default',
                  display: 'flex',
                  alignItems: 'center',
                  outline: 'none',
                  transition: 'background-color 0.1s ease',
                  borderRadius: '0px'
                }}
              >
                {menu.id === 'app' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                    <img
                      src={foxtradeSquareIcon}
                      alt="FoxTrade"
                      style={{
                        width: '22px',
                        height: '22px',
                        objectFit: 'contain',
                        filter: 'var(--titlebar-logo-filter, none)',
                        display: 'block',
                        flexShrink: 0,
                        userSelect: 'none'
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '-0.1px' }}>
                      FoxTrade
                    </span>
                  </span>
                ) : (
                  menu.label
                )}
              </button>

              {/* Dropdown Popup */}
              {activeMenu === menu.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: '34px',
                    left: 0,
                    minWidth: '220px',
                    backgroundColor: 'var(--menu-popup-bg)',
                    border: '1px solid var(--menu-popup-border)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                    padding: '5px 0',
                    zIndex: 100000,
                    animation: 'fadeIn 0.08s ease'
                  }}
                >
                  {menu.items.map((item, idx) => {
                    if (item.divider) {
                      return (
                        <div
                          key={`div-${idx}`}
                          style={{
                            height: '1px',
                            backgroundColor: 'var(--titlebar-border)',
                            margin: '4px 0'
                          }}
                        />
                      );
                    }

                    if (item.isVersion) {
                      return (
                        <div
                          key={`ver-${idx}`}
                          style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            color: 'var(--text-muted, #9ca3af)',
                            fontWeight: 500,
                            letterSpacing: '0.2px'
                          }}
                        >
                          {item.label}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.onClick}
                        disabled={item.disabled}
                        style={{
                          width: '100%',
                          padding: '6px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          border: 'none',
                          background: 'none',
                          color: 'var(--titlebar-text)',
                          fontSize: '12.5px',
                          textAlign: 'left',
                          cursor: item.disabled ? 'default' : 'pointer',
                          opacity: item.disabled ? 0.6 : 1,
                          outline: 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (!item.disabled) e.currentTarget.style.backgroundColor = 'var(--titlebar-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted, #9ca3af)', marginLeft: '16px' }}>
                            {item.shortcut}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Update Indicator + Windows Caption Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', height: '100%', WebkitAppRegion: 'no-drag' }}>
        {/* Update Pill Indicator */}
        <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
          <UpdatePill onOpenDialog={() => onOpenUpdateModal?.()} />
        </div>

        {/* Minimize Button */}
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize"
          style={{
            height: '100%',
            width: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'default',
            outline: 'none',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--titlebar-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <Minus size={14} />
        </button>

        {/* Maximize / Restore Button */}
        <button
          type="button"
          onClick={handleMaximizeToggle}
          title={isMaximized ? 'Restore' : 'Maximize'}
          style={{
            height: '100%',
            width: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'default',
            outline: 'none',
            transition: 'background-color 0.1s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--titlebar-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {isMaximized ? <Copy size={12} style={{ transform: 'rotate(90deg)' }} /> : <Square size={12} />}
        </button>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          title="Close"
          style={{
            height: '100%',
            width: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'default',
            outline: 'none',
            transition: 'background-color 0.1s ease, color 0.1s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e81123';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'inherit';
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
