/**
 * Logger — structured logging utility for backend operations
 *
 * Usage: req.logger.info('action.name', { param1: value1, param2: value2 })
 *
 * Log levels (least to most verbose):
 *   error — failures, exceptions, unexpected states
 *   info  — normal operations: create, update, delete, login
 *   debug — detailed tracing: query parameters, intermediate values
 *
 * Effective level resolution (in order):
 *   1. workspace_users.log_level (if set and not expired)
 *   2. workspaces.log_level (if set and not expired)
 *   3. LOGGER_DEFAULT_LEVEL env var (default: 'error')
 */

const LEVEL_RANKS = {
  error: 1,
  info: 2,
  debug: 3,
};

const LEVEL_NAMES = Object.keys(LEVEL_RANKS);

class Logger {
  constructor({ workspace_id, user_id, db, defaultLevel = 'error' }) {
    this.workspace_id = workspace_id;
    this.user_id = user_id;
    this.db = db;
    this.defaultLevel = defaultLevel;
    this.effectiveLevel = null;
    this.levelQueryTime = null;
  }

  /**
   * Query the effective log level for this user in this workspace.
   * Cache for 5 seconds to avoid hitting the DB on every log call.
   */
  async getEffectiveLevel() {
    const now = Date.now();

    // Return cached level if still valid (< 5 seconds old)
    if (this.effectiveLevel !== null && this.levelQueryTime && now - this.levelQueryTime < 5000) {
      return this.effectiveLevel;
    }

    let level = this.defaultLevel;

    try {
      // 1. Check user-specific override
      if (this.user_id) {
        const userSetting = await this.db('workspace_users')
          .where({ workspace_id: this.workspace_id, user_id: this.user_id })
          .select('log_level', 'log_level_expires_at')
          .first();

        if (userSetting?.log_level) {
          const now_db = new Date();
          if (!userSetting.log_level_expires_at || new Date(userSetting.log_level_expires_at) > now_db) {
            level = userSetting.log_level;
            this.levelQueryTime = now;
            this.effectiveLevel = level;
            return level;
          }
        }
      }

      // 2. Check workspace default
      const workspaceSetting = await this.db('workspaces')
        .where({ id: this.workspace_id })
        .select('log_level', 'log_level_expires_at')
        .first();

      if (workspaceSetting?.log_level) {
        const now_db = new Date();
        if (!workspaceSetting.log_level_expires_at || new Date(workspaceSetting.log_level_expires_at) > now_db) {
          level = workspaceSetting.log_level;
        }
      }

      // Cache the result
      this.levelQueryTime = now;
      this.effectiveLevel = level;
      return level;
    } catch (err) {
      // If DB query fails, fall back to default level silently
      console.error('[Logger] Failed to query effective log level:', err.message);
      this.effectiveLevel = this.defaultLevel;
      this.levelQueryTime = now;
      return this.defaultLevel;
    }
  }

  /**
   * Check if a message at this level should be logged
   */
  async shouldLog(level) {
    const effective = await this.getEffectiveLevel();
    return LEVEL_RANKS[level] <= LEVEL_RANKS[effective];
  }

  /**
   * Format a log entry as JSON or text
   */
  formatLog(level, source, action, description, parameters) {
    const timestamp = new Date().toISOString();

    if (process.env.LOGGER_STDOUT_FORMAT === 'text') {
      // Human-readable format
      return `[${timestamp}] [${level.toUpperCase()}] [${source}] ${action} — ${description || ''}${
        Object.keys(parameters).length > 0 ? ' ' + JSON.stringify(parameters) : ''
      }`;
    }

    // JSON format (default)
    return JSON.stringify({
      timestamp,
      level,
      source,
      action,
      description,
      parameters,
      workspace_id: this.workspace_id,
      user_id: this.user_id,
    });
  }

  /**
   * Core logging method
   */
  async _log(level, action, parameters = {}, description = null) {
    // Check if we should log this message
    if (!(await this.shouldLog(level))) {
      return;
    }

    const source = 'backend';
    const logEntry = this.formatLog(level, source, action, description, parameters);

    // Write to stdout
    if (level === 'error') {
      console.error(logEntry);
    } else {
      console.log(logEntry);
    }

    // Write to database (if enabled)
    if (process.env.LOGGER_STORE_IN_DB === 'true') {
      try {
        await this.db('activity_log').insert({
          workspace_id: this.workspace_id,
          user_id: this.user_id,
          timestamp: new Date(),
          level,
          source,
          action,
          description,
          parameters,
        });
      } catch (err) {
        // If DB insert fails, don't let it crash the app — log to stderr
        console.error('[Logger] Failed to insert into activity_log:', err.message);
      }
    }
  }

  /**
   * Public methods: error, info, debug
   */

  async error(action, parameters = {}, description = null) {
    await this._log('error', action, parameters, description);
  }

  async info(action, parameters = {}, description = null) {
    await this._log('info', action, parameters, description);
  }

  async debug(action, parameters = {}, description = null) {
    await this._log('debug', action, parameters, description);
  }

  /**
   * For testing: override the effective level without DB queries
   */
  setLevel(level) {
    if (!LEVEL_NAMES.includes(level)) {
      throw new Error(`Invalid log level: ${level}. Must be one of: ${LEVEL_NAMES.join(', ')}`);
    }
    this.effectiveLevel = level;
  }

  /**
   * For testing: clear the cache
   */
  clearCache() {
    this.effectiveLevel = null;
    this.levelQueryTime = null;
  }
}

module.exports = Logger;
