/**
 * useBrokerSync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the broker sync Web Worker lifecycle.
 *
 * Usage:
 *   const { startSync, isSyncing, progress, error, result } = useBrokerSync();
 *
 *   startSync('zerodha', { apiKey, accessToken })
 *     .then(({ fills, rawCount }) => ...)
 *     .catch(err => ...);
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const PROXY_BASE = import.meta.env.VITE_BROKER_PROXY || '';

export function useBrokerSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress]   = useState('');
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(null);
  const workerRef                  = useRef(null);
  const resolveRef                 = useRef(null);
  const rejectRef                  = useRef(null);

  // Terminate worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const startSync = useCallback((broker, credentials) => {
    return new Promise((resolve, reject) => {
      // Terminate any existing worker
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }

      setIsSyncing(true);
      setProgress('Initializing...');
      setError(null);
      setResult(null);
      resolveRef.current = resolve;
      rejectRef.current  = reject;

      // Spin up Web Worker
      const worker = new Worker(
        new URL('../workers/brokerSyncWorker.js', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, message, fills, rawCount } = event.data;

        if (type === 'PROGRESS') {
          setProgress(message);
          return;
        }

        if (type === 'SUCCESS') {
          setIsSyncing(false);
          setProgress('');
          const syncResult = { fills, rawCount };
          setResult(syncResult);
          worker.terminate();
          workerRef.current = null;
          resolveRef.current?.(syncResult);
          return;
        }

        if (type === 'ERROR') {
          setIsSyncing(false);
          setProgress('');
          setError(message);
          worker.terminate();
          workerRef.current = null;
          rejectRef.current?.(new Error(message));
          return;
        }
      };

      worker.onerror = (err) => {
        setIsSyncing(false);
        setProgress('');
        const msg = err.message || 'Worker crashed';
        setError(msg);
        worker.terminate();
        workerRef.current = null;
        rejectRef.current?.(new Error(msg));
      };

      // Send sync message to worker
      worker.postMessage({
        type: 'SYNC',
        broker: broker.toLowerCase(),
        credentials,
        proxyBase: PROXY_BASE,
      });
    });
  }, []);

  const resetSync = useCallback(() => {
    setIsSyncing(false);
    setProgress('');
    setError(null);
    setResult(null);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return { startSync, resetSync, isSyncing, progress, error, result };
}
