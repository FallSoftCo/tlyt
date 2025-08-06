// Custom logger that sends logs to our API endpoint
class Logger {
  private async sendLog(message: string, level: 'info' | 'error' | 'warn' | 'debug' = 'info') {
    try {
      const apiKey = process.env.NEXT_PUBLIC_LOGGING_API_KEY;
      if (!apiKey) {
        throw new Error('No API key configured');
      }
      
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ message, level })
      });
    } catch {
      // Fallback to console if API fails
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  info(message: string) {
    console.log(`[INFO] ${message}`);
    this.sendLog(message, 'info');
  }

  error(message: string) {
    console.error(`[ERROR] ${message}`);
    this.sendLog(message, 'error');
  }

  warn(message: string) {
    console.warn(`[WARN] ${message}`);
    this.sendLog(message, 'warn');
  }

  debug(message: string) {
    console.log(`[DEBUG] ${message}`);
    this.sendLog(message, 'debug');
  }
}

export const logger = new Logger();