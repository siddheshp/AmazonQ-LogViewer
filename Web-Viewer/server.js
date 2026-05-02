const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3099;
const LOG_BASE = path.join(process.env.APPDATA, 'Code', 'logs');
const HISTORY_DIR = path.join(process.env.USERPROFILE, '.aws', 'amazonq', 'history');
const LOG_SUBPATH = path.join('window1', 'exthost', 'amazonwebservices.amazon-q-vscode', 'Amazon Q Logs.log');

function getSessionLogs() {
  const sessions = [];
  if (!fs.existsSync(LOG_BASE)) return sessions;
  for (const dir of fs.readdirSync(LOG_BASE)) {
    const logPath = path.join(LOG_BASE, dir, LOG_SUBPATH);
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      sessions.push({ session: dir, path: logPath, size: stat.size, modified: stat.mtime.toISOString() });
    }
  }
  return sessions.sort((a, b) => a.session.localeCompare(b.session));
}

function getChatHistoryFiles() {
  const files = [];
  if (!fs.existsSync(HISTORY_DIR)) return files;
  for (const f of fs.readdirSync(HISTORY_DIR)) {
    if (f.startsWith('chat-history-') && f.endsWith('.json')) {
      const fp = path.join(HISTORY_DIR, f);
      const stat = fs.statSync(fp);
      files.push({ name: f, path: fp, size: stat.size, modified: stat.mtime.toISOString() });
    }
  }
  return files.sort((a, b) => b.size - a.size);
}

function serve(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (url.pathname === '/' || url.pathname === '/viewer.html') {
    const html = fs.readFileSync(path.join(__dirname, 'viewer.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (url.pathname === '/api/sessions') {
    const sessions = getSessionLogs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  if (url.pathname === '/api/log') {
    const session = url.searchParams.get('session');
    if (!session || !/^[\w-]+$/.test(session)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid session' }));
      return;
    }
    const logPath = path.join(LOG_BASE, session, LOG_SUBPATH);
    if (!fs.existsSync(logPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Log not found' }));
      return;
    }
    const content = fs.readFileSync(logPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(content);
    return;
  }

  if (url.pathname === '/api/history-files') {
    const files = getChatHistoryFiles();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  if (url.pathname === '/api/history') {
    const name = url.searchParams.get('name');
    if (!name || !/^chat-history-[\da-zA-Z-]+\.json$/.test(name)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid filename' }));
      return;
    }
    const fp = path.join(HISTORY_DIR, name);
    if (!fs.existsSync(fp)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return;
    }
    const content = fs.readFileSync(fp, 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(content);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(serve);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} already in use — opening existing viewer...`);
    require('child_process').exec(`start http://localhost:${PORT}`);
    process.exit(0);
  }
  throw err;
});
server.listen(PORT, () => {
  console.log(`Amazon Q Log Viewer running at http://localhost:${PORT}`);
  console.log(`Log base: ${LOG_BASE}`);
  console.log(`History dir: ${HISTORY_DIR}`);
  require('child_process').exec(`start http://localhost:${PORT}`);
});
