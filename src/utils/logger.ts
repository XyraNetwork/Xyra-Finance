/**
 * Frontend Logger Utility
 * Captures all console logs, errors, and diagnostics
 * Stores them for debugging and local reference
 */

export interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  data?: any;
  stackTrace?: string;
}

export interface RecordDiagnostic {
  timestamp: string;
  walletAddress?: string;
  creditsRecords: any[];
  lendingPoolRecords: any[];
  allRecords: any[];
  errors: string[];
  warnings: string[];
}

class FrontendLogger {
  private logs: LogEntry[] = [];
  private recordDiagnostics: RecordDiagnostic[] = [];
  private maxLogs = 1000; // Keep last 1000 logs to avoid memory issues
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  constructor() {
    this.initializeConsoleInterception();
  }

  /**
   * Check if code is running in browser
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Intercept all console methods to capture logs
   */
  private initializeConsoleInterception() {
    // Only initialize on client-side
    if (!this.isBrowser()) {
      return;
    }
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.addLog('log', args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.addLog('error', args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.addLog('warn', args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.addLog('info', args);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.addLog('debug', args);
    };

    // Also capture uncaught errors
    window.addEventListener('error', (event) => {
      this.addLog('error', [event.message], event.error?.stack);
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.addLog('error', ['Unhandled Promise Rejection:', event.reason], undefined);
    });
  }

  /**
   * Add a log entry
   */
  private addLog(level: LogEntry['level'], data: any[], stackTrace?: string) {
    const message = data
      .map((item) => {
        if (typeof item === 'object') {
          try {
            return JSON.stringify(item);
          } catch (e) {
            return String(item);
          }
        }
        return String(item);
      })
      .join(' ');

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data.length === 1 ? data[0] : data,
      stackTrace,
    };

    this.logs.push(logEntry);

    // Keep only last maxLogs entries to avoid memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also store in localStorage for persistence
    this.storeInLocalStorage('frontend_logs_session', JSON.stringify(this.logs.slice(-100)));
  }

  /**
   * Store record diagnostic information
   */
  async storeRecordDiagnostic(
    walletAddress: string | undefined,
    creditsRecords: any[],
    lendingPoolRecords: any[],
    allRecords: any[],
    errors: string[] = [],
    warnings: string[] = []
  ) {
    const diagnostic: RecordDiagnostic = {
      timestamp: new Date().toISOString(),
      walletAddress,
      creditsRecords,
      lendingPoolRecords,
      allRecords,
      errors,
      warnings,
    };

    this.recordDiagnostics.push(diagnostic);

    // Keep only last 50 diagnostics
    if (this.recordDiagnostics.length > 50) {
      this.recordDiagnostics = this.recordDiagnostics.slice(-50);
    }

    // Store in localStorage
    this.storeInLocalStorage(
      'frontend_record_diagnostics',
      JSON.stringify(this.recordDiagnostics.slice(-20))
    );
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Get all record diagnostics
   */
  getRecordDiagnostics(): RecordDiagnostic[] {
    return this.recordDiagnostics;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.removeFromLocalStorage('frontend_logs_session');
  }

  /**
   * Clear all record diagnostics
   */
  clearRecordDiagnostics() {
    this.recordDiagnostics = [];
    this.removeFromLocalStorage('frontend_record_diagnostics');
  }

  /**
   * Export logs as formatted text file content
   */
  exportLogsAsText(): string {
    let text = `=== FRONTEND LOGS ===\n`;
    text += `Export Time: ${new Date().toISOString()}\n`;
    text += `Total Logs: ${this.logs.length}\n\n`;

    this.logs.forEach((log, index) => {
      text += `[${index + 1}] ${log.timestamp} [${log.level.toUpperCase()}]\n`;
      text += `    Message: ${log.message}\n`;
      if (log.data && typeof log.data === 'object') {
        text += `    Data: ${JSON.stringify(log.data, null, 2)}\n`;
      }
      if (log.stackTrace) {
        text += `    Stack: ${log.stackTrace}\n`;
      }
      text += '\n';
    });

    return text;
  }

  /**
   * Export record diagnostics as formatted text file content
   */
  exportRecordDiagnosticsAsText(): string {
    let text = `=== RECORD DIAGNOSTICS ===\n`;
    text += `Export Time: ${new Date().toISOString()}\n`;
    text += `Total Diagnostics: ${this.recordDiagnostics.length}\n\n`;

    this.recordDiagnostics.forEach((diag, index) => {
      text += `\n[${'='.repeat(60)}]\n`;
      text += `[DIAGNOSTIC ${index + 1}] ${diag.timestamp}\n`;
      text += `[${'='.repeat(60)}]\n\n`;

      text += `Wallet Address: ${diag.walletAddress || 'Not provided'}\n\n`;

      text += `--- CREDITS RECORDS (${diag.creditsRecords.length}) ---\n`;
      text += JSON.stringify(diag.creditsRecords, null, 2) + '\n\n';

      text += `--- LENDING POOL RECORDS (${diag.lendingPoolRecords.length}) ---\n`;
      text += JSON.stringify(diag.lendingPoolRecords, null, 2) + '\n\n';

      text += `--- ALL RECORDS (${diag.allRecords.length}) ---\n`;
      text += JSON.stringify(diag.allRecords, null, 2) + '\n\n';

      if (diag.errors.length > 0) {
        text += `--- ERRORS ---\n`;
        diag.errors.forEach((err) => {
          text += `  • ${err}\n`;
        });
        text += '\n';
      }

      if (diag.warnings.length > 0) {
        text += `--- WARNINGS ---\n`;
        diag.warnings.forEach((warn) => {
          text += `  • ${warn}\n`;
        });
        text += '\n';
      }
    });

    return text;
  }

  /**
   * Export all data as JSON
   */
  exportAllAsJSON(): string {
    return JSON.stringify(
      {
        logsExportTime: new Date().toISOString(),
        totalLogs: this.logs.length,
        logs: this.logs,
        totalRecordDiagnostics: this.recordDiagnostics.length,
        recordDiagnostics: this.recordDiagnostics,
      },
      null,
      2
    );
  }

  /**
   * Download logs as file
   */
  downloadLogsAsFile(format: 'text' | 'json' = 'text') {
    const content = format === 'json' ? this.exportAllAsJSON() : this.exportLogsAsText();
    const filename = `frontend-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'txt'}`;

    this.downloadFile(filename, content);
  }

  /**
   * Download record diagnostics as file
   */
  downloadRecordDiagnosticsAsFile(format: 'text' | 'json' = 'text') {
    const content =
      format === 'json'
        ? JSON.stringify(this.recordDiagnostics, null, 2)
        : this.exportRecordDiagnosticsAsText();
    const filename = `record-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'txt'}`;

    this.downloadFile(filename, content);
  }

  /**
   * Download all data as combined file
   */
  downloadAllAsFile(format: 'text' | 'json' = 'text') {
    let content: string;

    if (format === 'json') {
      content = this.exportAllAsJSON();
    } else {
      content = this.exportLogsAsText() + '\n\n' + this.exportRecordDiagnosticsAsText();
    }

    const filename = `frontend-all-${new Date().toISOString().replace(/[:.]/g, '-')}.${format === 'json' ? 'json' : 'txt'}`;

    this.downloadFile(filename, content);
  }

  /**
   * Download file (client-side only)
   */
  private downloadFile(filename: string, content: string) {
    if (!this.isBrowser()) {
      console.warn('downloadFile: Cannot download file - not running in browser');
      return;
    }

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';

    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const errorCount = this.logs.filter((l) => l.level === 'error').length;
    const warnCount = this.logs.filter((l) => l.level === 'warn').length;
    const logCount = this.logs.filter((l) => l.level === 'log').length;

    return {
      totalLogs: this.logs.length,
      errors: errorCount,
      warnings: warnCount,
      logs: logCount,
      totalDiagnostics: this.recordDiagnostics.length,
      sessionDuration: this.logs.length > 0 
        ? new Date(this.logs[this.logs.length - 1].timestamp).getTime() - 
          new Date(this.logs[0].timestamp).getTime()
        : 0,
    };
  }

  /**
   * Safe localStorage wrapper for client-side only
   */
  private storeInLocalStorage(key: string, value: string) {
    if (!this.isBrowser()) {
      return;
    }

    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // localStorage might be full or unavailable
      console.warn(`Failed to store in localStorage for key: ${key}`, e);
    }
  }

  /**
   * Safe localStorage removal for client-side only
   */
  private removeFromLocalStorage(key: string) {
    if (!this.isBrowser()) {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  }
}

// Create singleton instance (only on client-side)
export const frontendLogger = new FrontendLogger();

// Export for window access (only on client-side)
if (typeof window !== 'undefined') {
  (window as any).frontendLogger = frontendLogger;
}
