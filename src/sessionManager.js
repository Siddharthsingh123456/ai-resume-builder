/**
 * SessionManager - Handles session expiry, activity tracking, and refresh
 * Integrates with backend session authentication
 */

class SessionManager {
  constructor(options = {}) {
    this.sessionExpiryTimer = null;
    this.inactivityTimer = null;
    this.warningTimer = null;
    this.refreshTimer = null;
    
    // Configuration
    this.SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    this.INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in ms
    this.WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // Warn 5 minutes before expiry
    this.CHECK_INTERVAL = 30 * 1000; // Check session every 30 seconds
    
    // Override with options
    Object.assign(this, options);
    
    // Callbacks
    this.onSessionWarning = null;
    this.onSessionExpired = null;
    this.onSessionRefreshed = null;
    this.onInactivityWarning = null;
    
    this.isSessionActive = false;
  }

  /**
   * Initialize session tracking after user login
   */
  initSession(sessionExpiresAt) {
    this.isSessionActive = true;
    this.sessionExpiresAt = new Date(sessionExpiresAt);
    
    console.log(`[SessionManager] Session initialized, expires at: ${this.sessionExpiresAt}`);
    
    this.setupExpiryTimer();
    this.setupActivityTracking();
  }

  /**
   * Setup timer to warn before session expires
   */
  setupExpiryTimer() {
    this.clearTimers();
    
    const now = Date.now();
    const expiryTime = this.sessionExpiresAt.getTime();
    const timeRemaining = expiryTime - now;
    
    // Warn before expiry
    const warningTime = timeRemaining - this.WARNING_BEFORE_EXPIRY;
    
    if (warningTime > 0) {
      this.warningTimer = setTimeout(() => {
        console.warn(`[SessionManager] Session expiring soon!`);
        if (this.onSessionWarning) {
          this.onSessionWarning({
            message: "Your session will expire in 5 minutes. Click to refresh or you'll be logged out.",
            timeRemaining: this.WARNING_BEFORE_EXPIRY / 1000,
          });
        }
      }, warningTime);
    }
    
    // Auto-logout on expiry
    if (timeRemaining > 0) {
      this.sessionExpiryTimer = setTimeout(() => {
        console.error(`[SessionManager] Session expired!`);
        this.handleSessionExpiry();
      }, timeRemaining);
    }
  }

  /**
   * Setup activity tracking for inactivity timeout
   */
  setupActivityTracking() {
    // Listen to user interactions
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, () => this.resetActivityTimer(), true);
    });
  }

  /**
   * Reset activity timer on user interaction
   */
  resetActivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    
    this.inactivityTimer = setTimeout(() => {
      if (this.isSessionActive) {
        console.warn(`[SessionManager] User inactivity detected for ${this.INACTIVITY_TIMEOUT / 1000 / 60} minutes`);
        if (this.onInactivityWarning) {
          this.onInactivityWarning({
            message: `You've been inactive for ${this.INACTIVITY_TIMEOUT / 1000 / 60} minutes. Stay active or you'll be logged out.`,
          });
        }
      }
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Refresh session by extending expiry time
   */
  async refreshSession() {
    try {
      console.log('[SessionManager] Refreshing session...');
      
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      this.sessionExpiresAt = new Date(data.sessionExpiresAt);
      console.log(`[SessionManager] Session refreshed, new expiry: ${this.sessionExpiresAt}`);
      
      // Reset all timers
      this.setupExpiryTimer();
      
      if (this.onSessionRefreshed) {
        this.onSessionRefreshed({
          message: "Session refreshed! You're logged in for another 7 days.",
        });
      }
      
      return true;
    } catch (error) {
      console.error('[SessionManager] Session refresh failed:', error);
      return false;
    }
  }

  /**
   * Check session status via backend
   */
  async checkSessionStatus() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.handleSessionExpiry();
          return null;
        }
        throw new Error('Status check failed');
      }

      const data = await response.json();
      
      // Update session expiry
      this.sessionExpiresAt = new Date(data.sessionExpiresAt);
      
      // Show warning if session is about to expire
      if (data.sessionWarning) {
        if (this.onSessionWarning) {
          this.onSessionWarning({
            message: data.sessionWarning,
            timeRemaining: (this.sessionExpiresAt.getTime() - Date.now()) / 1000,
          });
        }
      }
      
      return data.user;
    } catch (error) {
      console.error('[SessionManager] Session status check failed:', error);
      return null;
    }
  }

  /**
   * Handle session expiry
   */
  handleSessionExpiry() {
    this.isSessionActive = false;
    this.clearTimers();
    
    if (this.onSessionExpired) {
      this.onSessionExpired({
        message: "Your session has expired. Please log in again.",
      });
    }
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.sessionExpiryTimer) clearTimeout(this.sessionExpiryTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  /**
   * Terminate session
   */
  async logout() {
    try {
      this.clearTimers();
      this.isSessionActive = false;
      
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      console.log('[SessionManager] Logged out successfully');
      return true;
    } catch (error) {
      console.error('[SessionManager] Logout error:', error);
      return false;
    }
  }

  /**
   * Terminate all active sessions (logout from all devices)
   */
  async logoutAll() {
    try {
      this.clearTimers();
      this.isSessionActive = false;
      
      const response = await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        console.log('[SessionManager] All sessions terminated');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SessionManager] Logout all error:', error);
      return false;
    }
  }

  /**
   * Get remaining session time in seconds
   */
  getTimeRemaining() {
    if (!this.sessionExpiresAt || !this.isSessionActive) return 0;
    return Math.max(0, (this.sessionExpiresAt.getTime() - Date.now()) / 1000);
  }

  /**
   * Format remaining time for display
   */
  formatTimeRemaining() {
    const seconds = this.getTimeRemaining();
    if (seconds <= 0) return "Expired";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

// Export singleton instance
let sessionManager = null;

export function getSessionManager(options = {}) {
  if (!sessionManager) {
    sessionManager = new SessionManager(options);
  }
  return sessionManager;
}

export default SessionManager;
