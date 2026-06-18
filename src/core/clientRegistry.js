import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { CONFIG } from '../config.js';
import logger from '../logger.js';

/**
 * Thread-safe registry untuk semua MTProto user clients
 */
class ClientRegistry {
  constructor() {
    this._clients = new Map(); // accountId -> TelegramClient
    this._locks = new Map();   // accountId -> Promise lock
  }

  /**
   * Get client for account
   */
  get(accountId) {
    return this._clients.get(Number(accountId)) || null;
  }

  /**
   * Get all clients
   */
  getAll() {
    return new Map(this._clients);
  }

  /**
   * Check if client exists
   */
  has(accountId) {
    return this._clients.has(Number(accountId));
  }

  /**
   * Register a new client (stops old one if exists)
   */
  async register(accountId, client) {
    accountId = Number(accountId);
    
    // Wait for any ongoing operation
    while (this._locks.has(accountId)) {
      try { await this._locks.get(accountId); } catch { /* ignore */ }
    }

    const lockPromise = this._doRegister(accountId, client);
    this._locks.set(accountId, lockPromise);
    
    try {
      await lockPromise;
    } finally {
      this._locks.delete(accountId);
    }
  }

  async _doRegister(accountId, client) {
    // Stop old client
    const old = this._clients.get(accountId);
    if (old && old !== client) {
      try {
        await old.disconnect();
        logger.info(`Old client #${accountId} disconnected`);
      } catch (err) {
        logger.warn(`Error disconnecting old client #${accountId}: ${err.message}`);
      }
    }

    this._clients.set(accountId, client);
    logger.info(`Client #${accountId} registered`);
  }

  /**
   * Remove and stop client
   */
  async remove(accountId) {
    accountId = Number(accountId);

    while (this._locks.has(accountId)) {
      try { await this._locks.get(accountId); } catch { /* ignore */ }
    }

    const client = this._clients.get(accountId);
    if (!client) return;

    this._clients.delete(accountId);

    try {
      await client.disconnect();
      logger.info(`Client #${accountId} removed and disconnected`);
    } catch (err) {
      logger.warn(`Error disconnecting client #${accountId}: ${err.message}`);
    }
  }

  /**
   * Stop all clients
   */
  async stopAll() {
    const entries = Array.from(this._clients.entries());
    this._clients.clear();

    for (const [accountId, client] of entries) {
      try {
        await Promise.race([
          client.disconnect(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          ),
        ]);
        logger.info(`Client #${accountId} stopped`);
      } catch (err) {
        logger.warn(`Client #${accountId} stop error: ${err.message}`);
      }
    }
  }

  /**
   * Create a new TelegramClient
   */
  createClient(sessionString, apiId, apiHash, name = 'user') {
    const session = new StringSession(sessionString || '');
    return new TelegramClient(session, Number(apiId), apiHash, {
      connectionRetries: 5,
      useWSS: false,
      requestRetries: 3,
      timeout: 30000,
      appVersion: 'PromoBot V4.0',
      deviceModel: 'PromoBot Server',
      systemVersion: 'Node.js',
      langCode: 'id',
      baseLogger: logger,
    });
  }

  /**
   * Connect and authorize client with session string
   */
  async connectClient(client) {
    await client.connect();
    if (!await client.checkAuthorization()) {
      throw new Error('Session not authorized');
    }
    return client;
  }
}

export const clientRegistry = new ClientRegistry();