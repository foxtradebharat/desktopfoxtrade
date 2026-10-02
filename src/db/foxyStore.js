/**
 * foxyStore.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Structured Storage Engine for Foxy AI (Chat History & Behavioral Coach Memory).
 *
 * Manages:
 *   1. AI Chat Conversations & Message Threads
 *   2. Trader Behavioral Commitments & Rules
 *   3. AI Provider Configuration
 *
 * Storage:
 *   - Primary Store: IndexedDB `foxtrade_v2` -> `app_config` store
 *   - Automatic Real-Time Google Drive sync on every conversation update
 */

import { getConfig, setConfig } from './configStore.js';
import { getValidAccessToken } from './tokenManager.js';
import { getActivePortfolioId } from './configStore.js';
import { getTradesWithDeleted } from './tradeStore.js';
import { triggerAutoSync } from './syncEngine.js';

// ── Storage Keys ──────────────────────────────────────────────────────────────
export const KEY_FOXY_CHATS        = 'foxy_ai_chats';
export const KEY_FOXY_COMMITMENTS  = 'foxy_trader_commitments';
export const KEY_FOXY_PROVIDER     = 'foxy_ai_provider';
export const KEY_FOXY_MODEL        = 'foxy_ai_model';
export const KEY_FOXY_API_KEY      = 'foxy_ai_api_key';

// ── Automatic Background Drive Sync Dispatcher ────────────────────────────────
let _syncDebounceTimer = null;
function scheduleFoxyDriveSync() {
  if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(async () => {
    try {
      const token = await getValidAccessToken().catch(() => null);
      if (!token || token === 'demo-token') return;
      const portfolioId = await getActivePortfolioId().catch(() => 'default');
      const trades = await getTradesWithDeleted(portfolioId).catch(() => []);
      triggerAutoSync(portfolioId, token, trades);
    } catch (err) {
      console.warn('[FoxyStore] Background sync trigger notice:', err.message);
    }
  }, 1500);
}

// ── Validation & Sanitization ─────────────────────────────────────────────────

/**
 * Validates and normalizes an individual chat message.
 * @param {object} msg
 * @returns {object} sanitized message
 */
export function sanitizeChatMessage(msg = {}) {
  const role = (msg.role === 'user' || msg.sender === 'user') ? 'user' : 'assistant';
  const sender = role === 'user' ? 'user' : 'foxy';
  const content = String(msg.content !== undefined && msg.content !== null ? msg.content : (msg.text || ''));
  const text = content;

  return {
    id: String(msg.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    role,
    sender,
    content,
    text,
    timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
    model: msg.model ? String(msg.model) : undefined,
    tokens: typeof msg.tokens === 'number' ? msg.tokens : undefined,
    isStreaming: false,
  };
}

/**
 * Validates and normalizes an entire chat conversation session.
 * @param {object} session
 * @returns {object} sanitized chat session
 */
export function sanitizeChatSession(session = {}) {
  const now = Date.now();
  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  return {
    id: String(session.id || 'chat-' + now),
    title: String(session.title || 'New conversation').trim().slice(0, 100),
    isPinned: Boolean(session.isPinned),
    createdAt: typeof session.createdAt === 'number' ? session.createdAt : now,
    updatedAt: typeof session.updatedAt === 'number' ? session.updatedAt : now,
    messages: rawMessages
      .map(sanitizeChatMessage)
      .filter(m => (m.content && m.content.trim().length > 0) || m.isStreaming),
  };
}

// ── Chat History API ──────────────────────────────────────────────────────────

/**
 * Get all saved AI chat sessions from IndexedDB.
 * @returns {Promise<Array>} array of sanitized ChatSessions
 */
export async function getFoxyChatHistory() {
  const chats = await getConfig(KEY_FOXY_CHATS, []);
  if (!Array.isArray(chats)) return [];
  return chats.map(sanitizeChatSession);
}

/**
 * Save full list of AI chat sessions to IndexedDB and dispatch Drive sync.
 * @param {Array} chats
 * @returns {Promise<void>}
 */
export async function saveFoxyChatHistory(chats) {
  const sanitized = Array.isArray(chats) ? chats.map(sanitizeChatSession) : [];
  // Keep up to 50 most recent chat threads to conserve storage
  const trimmed = sanitized.slice(-50);
  await setConfig(KEY_FOXY_CHATS, trimmed);
  scheduleFoxyDriveSync();
}

/**
 * Delete a specific chat session by ID.
 * @param {string} chatId
 * @returns {Promise<Array>} updated chats
 */
export async function deleteFoxyChat(chatId) {
  const current = await getFoxyChatHistory();
  const updated = current.filter(c => c.id !== chatId);
  await saveFoxyChatHistory(updated);
  return updated;
}

// ── Trader Commitments & Behavioral Rules API ─────────────────────────────────

/**
 * Get all trader commitments from IndexedDB.
 * @returns {Promise<string[]>}
 */
export async function getTraderCommitments() {
  const comms = await getConfig(KEY_FOXY_COMMITMENTS, []);
  if (!Array.isArray(comms)) return [];
  return comms.filter(c => typeof c === 'string' && c.trim().length > 0);
}

/**
 * Save trader commitments to IndexedDB and dispatch Drive sync.
 * @param {string[]} commitments
 * @returns {Promise<void>}
 */
export async function saveTraderCommitments(commitments) {
  if (!Array.isArray(commitments)) return;
  const unique = [];
  for (const item of commitments) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed && !unique.includes(trimmed)) {
        unique.push(trimmed);
      }
    }
  }
  // Store up to 20 commitments
  const finalRules = unique.slice(-20);
  await setConfig(KEY_FOXY_COMMITMENTS, finalRules);
  scheduleFoxyDriveSync();
}

/**
 * Add a new trader commitment rule.
 * @param {string} ruleText
 * @returns {Promise<string[]>}
 */
export async function addTraderCommitment(ruleText) {
  if (!ruleText || typeof ruleText !== 'string') return [];
  const current = await getTraderCommitments();
  const cleaned = ruleText.trim();
  if (cleaned && !current.includes(cleaned)) {
    current.push(cleaned);
    await saveTraderCommitments(current);
  }
  return current;
}
