const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  system: {
    getAutoLaunch: () => ipcRenderer.invoke('system:getAutoLaunch'),
    setAutoLaunch: (enabled) => ipcRenderer.invoke('system:setAutoLaunch', enabled),
    onPowerSuspend: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('system:power-suspend', listener);
      return () => ipcRenderer.removeListener('system:power-suspend', listener);
    },
    onPowerResume: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('system:power-resume', listener);
      return () => ipcRenderer.removeListener('system:power-resume', listener);
    }
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (callback) => {
      const listener = (_e, val) => callback(val);
      ipcRenderer.on('window:maximized-change', listener);
      return () => ipcRenderer.removeListener('window:maximized-change', listener);
    }
  },
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    install: () => ipcRenderer.invoke('update:install'),
    dismiss: () => ipcRenderer.invoke('update:dismiss'),
    getState: () => ipcRenderer.invoke('update:getState'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    skipVersion: (version) => ipcRenderer.invoke('update:skipVersion', version),
    setAutoDownload: (enabled) => ipcRenderer.invoke('update:setAutoDownload', enabled),
    openLogs: () => ipcRenderer.invoke('update:openLogs'),
    onState: (callback) => {
      const listener = (_e, data) => callback(data);
      ipcRenderer.on('update:state-change', listener);
      return () => ipcRenderer.removeListener('update:state-change', listener);
    },
    onStatus: (callback) => {
      const listener = (_e, data) => callback(data);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    }
  },
  theme: {
    getSystemTheme: () => ipcRenderer.invoke('theme:getSystemTheme'),
    onSystemThemeChange: (callback) => {
      const listener = (_e, data) => callback(data);
      ipcRenderer.on('theme:system-changed', listener);
      return () => ipcRenderer.removeListener('theme:system-changed', listener);
    }
  },
  zoom: {
    zoomIn: () => webFrame.setZoomFactor(webFrame.getZoomFactor() + 0.1),
    zoomOut: () => webFrame.setZoomFactor(Math.max(0.5, webFrame.getZoomFactor() - 0.1)),
    resetZoom: () => webFrame.setZoomFactor(1.0),
    getZoom: () => webFrame.getZoomFactor(),
  },
  notifications: {
    getStatus: () => ipcRenderer.invoke('notifications:getStatus'),
    setEnabled: (enabled) => ipcRenderer.invoke('notifications:setEnabled', enabled),
    show: (opts) => ipcRenderer.invoke('notifications:show', opts),
  },
  auth: {
    startBrowserLogin: () => ipcRenderer.invoke('desktopAuth:start'),
    onBrowserSuccess: (callback) => {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('desktopAuth:result', listener);
      return () => ipcRenderer.removeListener('desktopAuth:result', listener);
    }
  },
  db: {
    // Trades & Executions
    getTrades: (portfolioId, filters) => ipcRenderer.invoke('db:trades:get', { portfolioId, filters }),
    getTradeById: (tradeId) => ipcRenderer.invoke('db:trades:getById', tradeId),
    saveTrade: (portfolioId, trade, executions) => ipcRenderer.invoke('db:trades:save', { portfolioId, trade, executions }),
    deleteTrade: (tradeId) => ipcRenderer.invoke('db:trades:delete', tradeId),
    resequenceTradeNumbers: (portfolioId) => ipcRenderer.invoke('db:trades:resequence', portfolioId),
    getDashboardMetrics: (portfolioId) => ipcRenderer.invoke('db:metrics:getDashboard', portfolioId),

    // Portfolios & Funds
    getPortfolios: () => ipcRenderer.invoke('db:portfolios:getAll'),
    savePortfolio: (portfolio) => ipcRenderer.invoke('db:portfolios:save', portfolio),
    deletePortfolio: (portfolioId) => ipcRenderer.invoke('db:portfolios:delete', portfolioId),
    getBaseCapital: (portfolioId) => ipcRenderer.invoke('db:portfolios:getBaseCapital', portfolioId),
    setBaseCapital: (portfolioId, amount) => ipcRenderer.invoke('db:portfolios:setBaseCapital', { portfolioId, amount }),
    getFundTransactions: (portfolioId, year) => ipcRenderer.invoke('db:funds:get', { portfolioId, year }),
    saveFundTransaction: (tx) => ipcRenderer.invoke('db:funds:save', tx),
    deleteFundTransaction: (txId) => ipcRenderer.invoke('db:funds:delete', txId),

    // Playbook Setups & Audits
    getPlaybooks: (portfolioId) => ipcRenderer.invoke('db:playbook:getAll', portfolioId),
    savePlaybook: (portfolioId, playbook) => ipcRenderer.invoke('db:playbook:save', { portfolioId, playbook }),
    deletePlaybook: (playbookId) => ipcRenderer.invoke('db:playbook:delete', playbookId),
    saveTradeAudit: (tradeId, auditData) => ipcRenderer.invoke('db:playbook:saveAudit', { tradeId, auditData }),
    getTradeAudit: (tradeId) => ipcRenderer.invoke('db:playbook:getAudit', tradeId),
    getAllTradeAudits: () => ipcRenderer.invoke('db:playbook:getAllAudits'),

    // Monthly Tax Ledger
    getMonthlyTaxRecords: (portfolioId, year) => ipcRenderer.invoke('db:tax:getYear', { portfolioId, year }),
    saveMonthlyTaxRecord: (portfolioId, year, monthIndex, data) => ipcRenderer.invoke('db:tax:saveMonth', { portfolioId, year, monthIndex, data }),

    // Notes (Calendar & Independent)
    getCalendarNotes: (portfolioId) => ipcRenderer.invoke('db:notes:getCalendar', portfolioId),
    saveDayNote: (portfolioId, dateStr, noteData) => ipcRenderer.invoke('db:notes:saveDay', { portfolioId, dateStr, noteData }),
    deleteDayNote: (portfolioId, dateStr) => ipcRenderer.invoke('db:notes:deleteDay', { portfolioId, dateStr }),
    getIndependentNotes: (portfolioId) => ipcRenderer.invoke('db:notes:getIndependent', portfolioId),
    saveIndependentNote: (portfolioId, note) => ipcRenderer.invoke('db:notes:saveIndependent', { portfolioId, note }),
    deleteIndependentNote: (portfolioId, noteId) => ipcRenderer.invoke('db:notes:deleteIndependent', { portfolioId, noteId }),

    // Screenshots
    saveScreenshot: (tradeId, imageType, bufferOrBase64, customFilename) =>
      ipcRenderer.invoke('db:screenshots:save', { tradeId, imageType, bufferOrBase64, customFilename }),
    getScreenshotsForTrade: (tradeId) => ipcRenderer.invoke('db:screenshots:getByTrade', tradeId),
    deleteScreenshot: (screenshotId) => ipcRenderer.invoke('db:screenshots:delete', screenshotId),

    // Settings
    getSetting: (key, defaultValue) => ipcRenderer.invoke('db:settings:get', { key, defaultValue }),
    setSetting: (key, value) => ipcRenderer.invoke('db:settings:set', { key, value }),
    deleteSetting: (key) => ipcRenderer.invoke('db:settings:delete', key),
  }
});

contextBridge.exposeInMainWorld('desktopAuth', {
  startGoogleLogin: () => ipcRenderer.invoke('desktopAuth:start'),
  cancelGoogleLogin: () => ipcRenderer.invoke('desktopAuth:cancel'),
  onResult: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('desktopAuth:result', listener);
    return () => ipcRenderer.removeListener('desktopAuth:result', listener);
  }
});

contextBridge.exposeInMainWorld('updater', {
  check: () => ipcRenderer.invoke('update:check'),
  install: () => ipcRenderer.invoke('update:install'),
  dismiss: () => ipcRenderer.invoke('update:dismiss'),
  getState: () => ipcRenderer.invoke('update:getState'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  skipVersion: (version) => ipcRenderer.invoke('update:skipVersion', version),
  setAutoDownload: (enabled) => ipcRenderer.invoke('update:setAutoDownload', enabled),
  openLogs: () => ipcRenderer.invoke('update:openLogs'),
  onState: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update:state-change', listener);
    return () => ipcRenderer.removeListener('update:state-change', listener);
  }
});
