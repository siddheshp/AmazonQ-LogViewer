import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HistoryFileInfo {
  name: string;
  path: string;
  size: number;
  modified: string;
  content: any;
}

export interface LogSessionInfo {
  session: string;
  path: string;
  size: number;
  modified: string;
  content: string;
}

export class LogProvider {
  private logBase: string;
  private historyDir: string;

  constructor() {
    const home = os.homedir();
    const platform = os.platform();

    // VS Code logs path varies by OS
    if (platform === 'win32') {
      const appdata = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      this.logBase = path.join(appdata, 'Code', 'logs');
    } else if (platform === 'darwin') {
      this.logBase = path.join(home, 'Library', 'Application Support', 'Code', 'logs');
    } else {
      // Linux and other Unix-like
      this.logBase = path.join(home, '.config', 'Code', 'logs');
    }

    // Chat history path is the same on all platforms (under home dir)
    this.historyDir = path.join(home, '.aws', 'amazonq', 'history');
  }

  getLogBase(): string {
    return this.logBase;
  }

  getHistoryDir(): string {
    return this.historyDir;
  }

  getSessionLogs(): LogSessionInfo[] {
    const sessions: LogSessionInfo[] = [];
    const logSubpath = path.join('window1', 'exthost', 'amazonwebservices.amazon-q-vscode', 'Amazon Q Logs.log');

    if (!fs.existsSync(this.logBase)) { return sessions; }

    for (const dir of fs.readdirSync(this.logBase)) {
      const logPath = path.join(this.logBase, dir, logSubpath);
      if (fs.existsSync(logPath)) {
        try {
          const stat = fs.statSync(logPath);
          const content = fs.readFileSync(logPath, 'utf8');
          sessions.push({
            session: dir,
            path: logPath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            content
          });
        } catch {
          // Skip unreadable files
        }
      }
    }

    return sessions.sort((a, b) => a.session.localeCompare(b.session));
  }

  getChatHistoryFiles(): HistoryFileInfo[] {
    const files: HistoryFileInfo[] = [];

    if (!fs.existsSync(this.historyDir)) { return files; }

    for (const f of fs.readdirSync(this.historyDir)) {
      if (f.startsWith('chat-history-') && f.endsWith('.json')) {
        const fp = path.join(this.historyDir, f);
        try {
          const stat = fs.statSync(fp);
          const raw = fs.readFileSync(fp, 'utf8');
          const content = JSON.parse(raw);
          files.push({
            name: f,
            path: fp,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            content
          });
        } catch {
          // Skip unparseable files
        }
      }
    }

    return files.sort((a, b) => b.size - a.size);
  }

  loadAllData(): { historyFiles: HistoryFileInfo[]; logSessions: LogSessionInfo[] } {
    return {
      historyFiles: this.getChatHistoryFiles(),
      logSessions: this.getSessionLogs()
    };
  }
}
