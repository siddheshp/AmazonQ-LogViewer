import * as vscode from 'vscode';
import { LogProvider } from './logProvider';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class LogViewerPanel {
  public static currentPanel: LogViewerPanel | undefined;
  private static readonly viewType = 'amazonqLogViewer';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _logProvider: LogProvider;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

    if (LogViewerPanel.currentPanel) {
      LogViewerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      LogViewerPanel.viewType,
      'Q Log Session Viewer',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
      }
    );

    LogViewerPanel.currentPanel = new LogViewerPanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._logProvider = new LogProvider();

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      message => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public refresh() {
    this._panel.webview.postMessage({ command: 'startLoading' });
    const data = this._logProvider.loadAllData();
    this._panel.webview.postMessage({ command: 'dataLoaded', ...data });
  }

  public dispose() {
    LogViewerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _handleMessage(message: any) {
    switch (message.command) {
      case 'loadData':
        const data = this._logProvider.loadAllData();
        this._panel.webview.postMessage({
          command: 'dataLoaded',
          ...data,
          logBase: this._logProvider.getLogBase(),
          historyDir: this._logProvider.getHistoryDir()
        });
        break;
      case 'copyToClipboard':
        vscode.env.clipboard.writeText(message.text);
        break;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    return getViewerHtml(nonce);
  }
}

export class LogViewerSidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _logProvider: LogProvider;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._logProvider = new LogProvider();
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'resources')]
    };

    const nonce = getNonce();
    webviewView.webview.html = getViewerHtml(nonce);

    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'loadData':
          const data = this._logProvider.loadAllData();
          webviewView.webview.postMessage({
            command: 'dataLoaded',
            ...data,
            logBase: this._logProvider.getLogBase(),
            historyDir: this._logProvider.getHistoryDir()
          });
          break;
        case 'openInPanel':
          vscode.commands.executeCommand('amazonq-logviewer.open');
          break;
        case 'copyToClipboard':
          vscode.env.clipboard.writeText(message.text);
          break;
      }
    });
  }

  public refresh() {
    if (this._view) {
      const data = this._logProvider.loadAllData();
      this._view.webview.postMessage({
        command: 'dataLoaded',
        ...data,
        logBase: this._logProvider.getLogBase(),
        historyDir: this._logProvider.getHistoryDir()
      });
    }
  }
}

function getViewerHtml(nonce: string): string {
  return /*html*/ `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<title>Q Log Session Viewer</title>
<style nonce="${nonce}">
  :root[data-theme="dark"]{
    --bg:#1e1e1e;--bg2:#252526;--bg3:#2d2d2d;--bgH:#2a2d2e;--bgS:#094771;
    --bgC:#252526;--bgCH:#2f3031;--brd:#3c3c3c;--txt:#ccc;--txtM:#858585;--txtB:#e0e0e0;
    --acc:#0078d4;--accL:#1a8fff;--grn:#4ec9b0;--ylw:#dcdcaa;--red:#f44747;
    --ov:rgba(0,0,0,.55);--sh:0 8px 32px rgba(0,0,0,.5);
    --bReq:#0e639c;--bRes:#388a34;--bLLM:#9b59b6;--bTool:#d68c00;
    --bMCP:#6a5acd;--bErr:#a31515;--bRule:#2e7d6e;--bSlash:#c586c0;
    --glow:rgba(0,120,212,.08);--glowH:rgba(0,120,212,.15);
  }
  :root[data-theme="light"]{
    --bg:#eaeaea;--bg2:#fff;--bg3:#e0e0e0;--bgH:#d8d8d8;--bgS:#b8d4ec;
    --bgC:#fff;--bgCH:#eef3f9;--brd:#b0b0b0;--txt:#1a1a1a;--txtM:#4a4a4a;--txtB:#000;
    --acc:#005fb8;--accL:#004d99;--grn:#0e6b4c;--ylw:#5a4210;--red:#b81414;
    --ov:rgba(0,0,0,.35);--sh:0 8px 32px rgba(0,0,0,.18);
    --bReq:#08508a;--bRes:#2d7029;--bLLM:#7b3fa0;--bTool:#a06d00;
    --bMCP:#5040b0;--bErr:#b81414;--bRule:#1e6050;--bSlash:#8a00b0;
    --glow:rgba(0,91,187,.07);--glowH:rgba(0,91,187,.14);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--vscode-font-family,'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif);font-size:13px;background:var(--bg);color:var(--txt);height:100vh;overflow:hidden;display:flex;flex-direction:column}
  .topbar{background:var(--bg2);border-bottom:1px solid var(--brd);padding:6px 10px;display:flex;align-items:center;gap:6px;flex-shrink:0;z-index:10;flex-wrap:wrap}
  .topbar-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--txtB);white-space:nowrap}
  .topbar-title svg{width:18px;height:18px;flex-shrink:0}
  .breadcrumb{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--txtM);min-width:0;overflow:hidden}
  .breadcrumb .crumb{color:var(--txt);cursor:pointer}.breadcrumb .crumb:hover{text-decoration:underline;color:var(--accL)}
  .breadcrumb .cur{color:var(--txtB);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .topbar-r{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}
  .btn{background:var(--acc);color:#fff;border:none;padding:5px 14px;border-radius:4px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;font-family:inherit;transition:background .15s}
  .btn:hover{background:var(--accL)}
  .btn-sec{background:transparent;border:1px solid var(--brd);color:var(--txt)}.btn-sec:hover{background:var(--bg3)}
  .btn-back{background:transparent;border:1px solid var(--brd);color:var(--txt);padding:5px 12px;border-radius:4px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit}.btn-back:hover{background:var(--bg3)}
  .thm-tog{width:40px;height:22px;border-radius:11px;background:var(--brd);border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
  .thm-tog::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--txtB);transition:transform .2s}
  :root[data-theme="light"] .thm-tog{background:var(--acc)}
  :root[data-theme="light"] .thm-tog::after{transform:translateX(18px)}
  .thm-lbl{font-size:11px;color:var(--txtM);white-space:nowrap}
  .content{flex:1;overflow:hidden;position:relative}
  .page{display:none;height:100%;overflow-y:auto}.page.active{display:block}
  .page::-webkit-scrollbar{width:8px}.page::-webkit-scrollbar-thumb{background:var(--brd);border-radius:4px}
  .sessions-page{padding:12px 10px 30px}
  .sec-title{font-size:12px;font-weight:600;color:var(--txtM);text-transform:uppercase;letter-spacing:1px;margin-top:24px;margin-bottom:4px;padding-bottom:6px;border-bottom:1px solid var(--brd)}
  .sec-title:first-child{margin-top:0}
  .sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr));gap:10px;margin-top:10px}
  .scard{background:var(--bgC);border:1px solid var(--brd);border-radius:8px;padding:16px 18px;cursor:pointer;transition:all .15s;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .scard:hover{border-color:var(--acc);background:var(--bgCH);box-shadow:0 2px 12px var(--glowH);transform:translateY(-1px)}
  .scard-hdr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .scard-ico{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}
  .scard-ico.log{background:rgba(106,90,205,.15);color:var(--bMCP)}.scard-ico.chat{background:rgba(14,99,156,.15);color:var(--bReq)}
  .scard-ttl{font-size:14px;font-weight:600;color:var(--txtB);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .scard-sub{font-size:11px;color:var(--txtM);margin-top:1px}
  .scard-stats{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .scard-st{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg3);color:var(--txt);white-space:nowrap}
  .scard-st .n{font-weight:600;color:var(--txtB)}
  .entries-page{display:flex;flex-direction:column;height:100%}
  .etoolbar{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--brd);flex-shrink:0;flex-wrap:wrap}
  .finput{flex:1;min-width:80px;background:var(--bg3);border:1px solid var(--brd);color:var(--txt);padding:5px 8px;border-radius:4px;font-size:12px;font-family:inherit}
  .finput:focus{outline:none;border-color:var(--acc)}.finput::placeholder{color:var(--txtM)}
  .fbadges{display:flex;gap:3px;overflow-x:auto;flex-shrink:1;flex-wrap:wrap;width:100%}
  .fbadge{padding:2px 7px;border-radius:10px;font-size:10px;cursor:pointer;opacity:.45;transition:opacity .15s;border:1px solid transparent;user-select:none;white-space:nowrap;color:#fff}
  .fbadge.active{opacity:1;border-color:rgba(255,255,255,.2)}
  .ehdr{display:grid;grid-template-columns:90px 1fr;background:var(--bg2);border-bottom:1px solid var(--brd);padding:4px 10px;font-size:11px;font-weight:600;color:var(--txtM);text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}
  .elist{flex:1;overflow-y:auto;overflow-x:hidden;position:relative}
  .elist::-webkit-scrollbar{width:8px}.elist::-webkit-scrollbar-thumb{background:var(--brd);border-radius:4px}
  .erow{display:grid;grid-template-columns:90px 1fr;padding:6px 10px;border-bottom:1px solid rgba(60,60,60,.3);cursor:pointer;transition:background .1s;align-items:start;height:52px;position:absolute;left:0;right:0;gap:8px;overflow:hidden}
  .erow:hover{background:var(--bgH)}.erow.sel{background:var(--bgS)}
  .erow .ts{font-family:'Cascadia Code','Consolas',monospace;font-size:10px;color:var(--txtM);white-space:nowrap;padding-top:4px}
  .erow .nc{display:flex;flex-direction:column;gap:3px;min-width:0;overflow:hidden}
  .erow .nc .badge{align-self:flex-start;max-width:100%;overflow:hidden;text-overflow:ellipsis}
  .erow .dc{color:var(--txtM);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
  .badge{padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;white-space:nowrap;color:#fff}
  .estat{background:var(--bg2);border-top:1px solid var(--brd);padding:4px 10px;font-size:10px;color:var(--txtM);display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap}
  .estat strong{color:var(--txt)}
  .pop-ov{display:none;position:fixed;inset:0;background:var(--ov);z-index:100;align-items:center;justify-content:center}
  .pop-ov.open{display:flex}
  .pop-panel{background:var(--bg2);border:1px solid var(--brd);border-radius:10px;box-shadow:var(--sh);width:min(700px,96vw);max-height:90vh;display:flex;flex-direction:column;overflow:hidden}
  .pop-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--brd);flex-shrink:0}
  .pop-hdr h3{font-size:15px;font-weight:600;color:var(--txtB)}
  .pop-acts{display:flex;gap:4px}
  .pop-x{background:none;border:none;color:var(--txtM);cursor:pointer;font-size:18px;padding:2px 8px;border-radius:4px;line-height:1}
  .pop-x:hover{background:var(--bg3);color:var(--txt)}
  .pop-body{flex:1;overflow-y:auto;padding:0}
  .pop-body::-webkit-scrollbar{width:8px}.pop-body::-webkit-scrollbar-thumb{background:var(--brd);border-radius:4px}
  .pop-sum{padding:14px 16px;border-bottom:1px solid var(--brd)}
  .pop-sum h2{font-size:16px;font-weight:600;color:var(--txtB);margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .pop-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12px}
  .pop-mi label{color:var(--txtM);font-size:11px;display:block}
  .pop-mi span{color:var(--txtB);font-family:'Cascadia Code','Consolas',monospace;font-size:12px;word-break:break-word}
  .pop-sec{border-bottom:1px solid var(--brd)}
  .pop-sh{display:flex;align-items:center;gap:6px;padding:8px 16px;cursor:pointer;user-select:none;color:var(--txtB);font-weight:500;font-size:13px}
  .pop-sh:hover{background:var(--bg3)}
  .pop-sh .arr{font-size:10px;transition:transform .15s;color:var(--txtM)}
  .pop-sh .arr.open{transform:rotate(90deg)}
  .pop-sh .cpb{margin-left:auto;background:none;border:none;color:var(--txtM);cursor:pointer;font-size:12px;padding:2px 8px;border-radius:3px;opacity:0;transition:opacity .15s}
  .pop-sh:hover .cpb{opacity:1}.pop-sh .cpb:hover{background:var(--bgH);color:var(--txt)}
  .pop-sc{display:none;padding:8px 16px 14px}.pop-sc.open{display:block}
  .pop-sc pre{background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:12px;font-family:'Cascadia Code','Consolas',monospace;font-size:12px;line-height:1.5;overflow-x:auto;white-space:pre-wrap;word-break:break-word;color:var(--txtB);max-height:400px;overflow-y:auto}
  .chat-msg{padding:10px 12px;margin-bottom:8px;border-radius:6px;border-left:3px solid var(--brd)}
  .chat-msg.user{border-left-color:var(--acc);background:var(--glow)}.chat-msg.asst{border-left-color:var(--grn);background:rgba(78,201,176,.08)}
  .chat-msg-lbl{font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:4px;letter-spacing:.5px}
  .chat-msg.user .chat-msg-lbl{color:var(--accL)}.chat-msg.asst .chat-msg-lbl{color:var(--grn)}
  .chat-msg-body{font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
  .tool-item{background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:10px 12px;margin-bottom:6px}
  .tool-item .tn{font-weight:600;color:var(--ylw);font-size:12px}
  .tool-item .tid{font-family:'Cascadia Code','Consolas',monospace;font-size:11px;color:var(--txtM)}
  .tool-item .tinp{margin-top:6px;font-family:'Cascadia Code','Consolas',monospace;font-size:11px;color:var(--txt);background:var(--bg3);padding:6px 8px;border-radius:4px;white-space:pre-wrap;word-break:break-word;max-height:150px;overflow-y:auto}
  .empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--txtM);gap:12px;padding:40px;text-align:center}
  .empty-state h3{font-size:16px;color:var(--txt)}.empty-state p{font-size:13px;max-width:420px;line-height:1.5}
  .spinner{width:28px;height:28px;border:3px solid var(--brd);border-top-color:var(--acc);border-radius:50%;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-title">
    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <rect width="128" height="128" rx="24" fill="#232F3E"/>
      <text x="56" y="88" font-family="Arial,sans-serif" font-size="80" font-weight="bold" fill="#FF9900" text-anchor="middle">Q</text>
      <circle cx="102" cy="100" r="22" fill="#0078D4"/>
      <ellipse cx="102" cy="100" rx="8" ry="10" fill="none" stroke="#fff" stroke-width="2"/>
      <line x1="94" y1="100" x2="110" y2="100" stroke="#fff" stroke-width="1.5"/>
      <line x1="94" y1="95" x2="91" y2="91" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <line x1="110" y1="95" x2="113" y2="91" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <line x1="94" y1="105" x2="91" y2="109" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <line x1="110" y1="105" x2="113" y2="109" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <line x1="95" y1="97" x2="92" y2="94" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <line x1="109" y1="97" x2="112" y2="94" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>
    Q Logs
  </div>
  <div class="breadcrumb" id="bc"><span class="cur">Sessions</span></div>
  <div class="topbar-r">
    <button class="btn btn-sec" id="refreshBtn" title="Reload">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.451 5.609l-.579-.921-1.017.641-.076-.12A5.5 5.5 0 002.5 8a5.5 5.5 0 005.5 5.5 5.49 5.49 0 004.949-3.07l.929.37A6.5 6.5 0 018 14.5 6.5 6.5 0 011.5 8a6.5 6.5 0 0110.949-4.727l.076.12 1.017-.641.579.921-2.835 1.786-1.835-2.85z"/></svg>
      Refresh
    </button>
    <span class="thm-lbl" id="thmL">Dark</span>
    <button class="thm-tog" id="thmTogBtn" title="Toggle theme"></button>
  </div>
</div>

<div class="content">
  <div class="page sessions-page active" id="sessionsPage">
    <div class="empty-state" id="sessionsLoading"><div class="spinner"></div><h3>Loading sessions...</h3><p>Reading VS Code logs and Amazon Q chat history.</p></div>
    <div id="sessionsContent" style="display:none"></div>
  </div>
  <div class="page entries-page" id="entriesPage">
    <div class="etoolbar">
      <button class="btn-back" id="backBtn"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.56 7.25H13a.75.75 0 010 1.5H4.56l3.22 3.22a.75.75 0 010 1.06z"/></svg>Back</button>
      <input class="finput" id="entryFilter" placeholder="Filter entries...">
      <div class="fbadges" id="entryBadges"></div>
    </div>
    <div class="ehdr"><div>Timestamp</div><div>Category / Details</div></div>
    <div class="elist" id="entriesList"></div>
    <div class="estat" id="entriesStatus"></div>
  </div>
</div>

<div class="pop-ov" id="popOv">
  <div class="pop-panel">
    <div class="pop-hdr"><h3 id="popTitle">Details</h3><div class="pop-acts"><button class="pop-x" id="copyJsonBtn" title="Copy JSON">&#128203;</button><button class="pop-x" id="closePopBtn" title="Close">&times;</button></div></div>
    <div class="pop-body" id="popBody"></div>
  </div>
</div>

<script nonce="${nonce}">
(function(){
const vscode = acquireVsCodeApi();
let allSessions=[],curSession=null,filteredEntries=[],selEntry=null,activeFilters=new Set();
const ROW_H=52;

const CAT={
  'Request':      {color:'#0e639c', colorLight:'#08508a', icon:'\\u{1F4AC}'},
  'Slash Command':{color:'#c586c0', colorLight:'#8a00b0', icon:'\\u26A1'},
  'Rules':        {color:'#2e7d6e', colorLight:'#1e6050', icon:'\\u{1F4CF}'},
  'LLM Call':     {color:'#9b59b6', colorLight:'#7b3fa0', icon:'\\u{1F9E0}'},
  'Response':     {color:'#388a34', colorLight:'#2d7029', icon:'\\u2705'},
  'Tool Call':    {color:'#d68c00', colorLight:'#a06d00', icon:'\\u{1F527}'},
  'MCP':          {color:'#6a5acd', colorLight:'#5040b0', icon:'\\u{1F50C}'},
  'Error':        {color:'#a31515', colorLight:'#b81414', icon:'\\u274C'},
};
function catColor(c){
  const cat=CAT[c];
  if(!cat) return '#555';
  return document.documentElement.dataset.theme==='light'?cat.colorLight:cat.color;
}

/* Theme */
function toggleTheme(){
  const n=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=n;
  document.getElementById('thmL').textContent=n==='dark'?'Dark':'Light';
  vscode.setState({...vscode.getState(), theme: n});
}
document.getElementById('thmTogBtn').addEventListener('click', toggleTheme);

/* Restore state */
const savedState = vscode.getState();
if (savedState?.theme) {
  document.documentElement.dataset.theme = savedState.theme;
  document.getElementById('thmL').textContent = savedState.theme === 'dark' ? 'Dark' : 'Light';
}

/* Button handlers */
document.getElementById('refreshBtn').addEventListener('click', loadAll);
document.getElementById('backBtn').addEventListener('click', goBack);
document.getElementById('entryFilter').addEventListener('input', applyFilter);
document.getElementById('popOv').addEventListener('click', function(e){ if(e.target===this) closePop(); });
document.getElementById('closePopBtn').addEventListener('click', closePop);
document.getElementById('copyJsonBtn').addEventListener('click', copyJSON);

/* Message handler from extension */
window.addEventListener('message', event => {
  const msg = event.data;
  switch(msg.command) {
    case 'dataLoaded':
      processLoadedData(msg.historyFiles, msg.logSessions);
      break;
    case 'startLoading':
      document.getElementById('sessionsLoading').style.display='flex';
      document.getElementById('sessionsContent').style.display='none';
      if(curSession) goBack();
      break;
  }
});

function loadAll(){
  document.getElementById('sessionsLoading').style.display='flex';
  document.getElementById('sessionsContent').style.display='none';
  if(curSession) goBack();
  allSessions=[];
  vscode.postMessage({ command: 'loadData' });
}

function processLoadedData(historyFiles, logSessions){
  allSessions=[];

  /* Process chat history files */
  for(const f of (historyFiles||[])){
    try{
      const entries=parseChat(f.content, f.name);
      if(!entries.length) continue;
      const title=entries.find(e=>e.data?.tabTitle)?.data.tabTitle||'';
      const label=title?(title.length>60?title.substring(0,60)+'...':title):f.name.replace('chat-history-','').replace('.json','');
      allSessions.push({id:'chat:'+f.name,type:'chat',label,subtitle:f.name+' \\u2022 '+fmtBytes(f.size),modified:f.modified,entries,stats:summarize(entries)});
    }catch(e){}
  }

  /* Process log sessions */
  for(const s of (logSessions||[])){
    try{
      const entries=parseLog(s.content, s.session);
      if(!entries.length) continue;
      allSessions.push({id:'log:'+s.session,type:'log',label:s.session,subtitle:'VS Code Log \\u2022 '+fmtBytes(s.size),modified:s.modified,entries,stats:summarize(entries)});
    }catch(e){}
  }

  allSessions.sort((a,b)=>{
    const ta=a.entries.length?a.entries[a.entries.length-1].timestamp:new Date(a.modified);
    const tb=b.entries.length?b.entries[b.entries.length-1].timestamp:new Date(b.modified);
    return tb-ta;
  });
  renderSessions();
}

function summarize(entries){const cats={};for(const e of entries)cats[e.category]=(cats[e.category]||0)+1;return{total:entries.length,cats}}

function renderSessions(){
  document.getElementById('sessionsLoading').style.display='none';
  const c=document.getElementById('sessionsContent');c.style.display='block';
  let h='';
  const chats=allSessions.filter(s=>s.type==='chat');
  const logs=allSessions.filter(s=>s.type==='log');
  if(chats.length){h+='<div class="sec-title">Chat History ('+chats.length+' conversations)</div><div class="sgrid">';for(const s of chats)h+=sCard(s);h+='</div>'}
  if(logs.length){h+='<div class="sec-title">Log Sessions ('+logs.length+')</div><div class="sgrid">';for(const s of logs)h+=sCard(s);h+='</div>'}
  if(!h)h='<div class="empty-state"><h3>No Log Sessions Found</h3><p>No Amazon Q log files or chat history were found on this machine.</p><p style="text-align:left;font-size:12px;background:var(--bg3);padding:12px;border-radius:6px;width:100%;max-width:420px"><strong>Locations checked:</strong><br>\u2022 Chat history: <code>~/.aws/amazonq/history/</code><br>\u2022 VS Code logs: <code>&lt;VS Code logs dir&gt;/.../Amazon Q Logs.log</code></p><p style="font-size:12px">Make sure the <strong>Amazon Q for VS Code</strong> extension is installed and you have had at least one chat session. Then click <strong>Refresh</strong>.</p></div>';
  c.innerHTML=h;
  c.querySelectorAll('.scard').forEach(function(card){card.addEventListener('click',function(){openSession(card.dataset.id)})});
}

function sCard(s){
  const ico=s.type==='log'?'\\u{1F4CB}':'\\u{1F4AC}',cls=s.type==='log'?'log':'chat';
  const top=Object.entries(s.stats.cats).sort((a,b)=>b[1]-a[1]).slice(0,4);
  let st='';for(const[c,n]of top)st+='<span class="scard-st"><span class="n">'+n+'</span> '+esc(c)+'</span>';
  let tr='';if(s.entries.length>0){tr=fmtDateS(s.entries[0].timestamp)+' \\u2013 '+fmtTime(s.entries[s.entries.length-1].timestamp)}
  return '<div class="scard" data-id="'+esc(s.id)+'"><div class="scard-hdr"><div class="scard-ico '+cls+'">'+ico+'</div><div style="min-width:0"><div class="scard-ttl">'+esc(s.label)+'</div><div class="scard-sub">'+esc(s.subtitle)+(tr?' \\u2022 '+esc(tr):'')+'</div></div></div><div class="scard-stats"><span class="scard-st"><span class="n">'+s.stats.total+'</span> total</span>'+st+'</div></div>';
}

function openSession(id){
  curSession=allSessions.find(function(s){return s.id===id});if(!curSession)return;
  selEntry=null;activeFilters=new Set(Object.keys(curSession.stats.cats));
  document.getElementById('sessionsPage').classList.remove('active');
  document.getElementById('entriesPage').classList.add('active');
  const lbl=curSession.label.length>50?curSession.label.substring(0,50)+'...':curSession.label;
  document.getElementById('bc').innerHTML='<span class="crumb" id="bcBack">Sessions</span><span style="color:var(--txtM)"> \\u203A </span><span class="cur">'+esc(lbl)+'</span>';
  document.getElementById('bcBack').addEventListener('click', goBack);
  document.getElementById('entryFilter').value='';
  buildBadges();applyFilter();
}

function goBack(){
  curSession=null;selEntry=null;
  document.getElementById('entriesPage').classList.remove('active');
  document.getElementById('sessionsPage').classList.add('active');
  document.getElementById('bc').innerHTML='<span class="cur">Sessions</span>';
}

function buildBadges(){
  const c=document.getElementById('entryBadges');c.innerHTML='';if(!curSession)return;
  const sorted=Object.entries(curSession.stats.cats).sort((a,b)=>b[1]-a[1]);
  for(const[cat,n]of sorted){
    const b=document.createElement('span');b.className='fbadge'+(activeFilters.has(cat)?' active':'');
    b.style.background=catColor(cat);b.textContent=cat+' ('+n+')';
    b.addEventListener('click',function(){if(activeFilters.has(cat))activeFilters.delete(cat);else activeFilters.add(cat);b.classList.toggle('active');applyFilter()});
    c.appendChild(b);
  }
}

function applyFilter(){
  if(!curSession)return;
  const txt=document.getElementById('entryFilter').value.toLowerCase();
  filteredEntries=curSession.entries.filter(function(e){
    if(!activeFilters.has(e.category))return false;
    if(txt){var parts=txt.split(/\\s+/);for(var i=0;i<parts.length;i++){var p=parts[i];if(p.startsWith('!')){var x=p.slice(1);if(x&&(e.name.toLowerCase().includes(x)||e.summary.toLowerCase().includes(x)))return false}else{if(!(e.name+' '+e.summary+' '+e.category).toLowerCase().includes(p))return false}}}
    return true;
  });
  renderEntries();
}

function renderEntries(){
  const list=document.getElementById('entriesList'),stat=document.getElementById('entriesStatus');
  if(!filteredEntries.length){list.innerHTML='<div class="empty-state" style="position:static"><h3>No matching entries</h3><p>Adjust filters or search.</p></div>';stat.innerHTML='<span>0 entries</span>';return}
  const totalH=filteredEntries.length*ROW_H;list.innerHTML='';
  const sp=document.createElement('div');sp.style.height=totalH+'px';sp.style.position='relative';list.appendChild(sp);
  const vc=Math.ceil(list.clientHeight/ROW_H)+20;let lastS=-1;
  function rv(){const st=list.scrollTop,start=Math.max(0,Math.floor(st/ROW_H)-5);if(start===lastS)return;lastS=start;const end=Math.min(filteredEntries.length,start+vc);
    sp.querySelectorAll('.erow').forEach(function(r){r.remove()});
    for(let i=start;i<end;i++){const e=filteredEntries[i],row=document.createElement('div');
      row.className='erow'+(e===selEntry?' sel':'');row.dataset.idx=i;row.style.top=(i*ROW_H)+'px';
      row.innerHTML='<div class="ts">'+fmtTS(e.timestamp)+'</div><div class="nc"><span class="badge" style="background:'+catColor(e.category)+'">'+esc(e.name)+'</span><span class="dc">'+esc(e.summary)+'</span></div>';
      row.addEventListener('click',function(){openPop(i)});sp.appendChild(row)}}
  list.onscroll=function(){requestAnimationFrame(rv)};rv();
  const tot=curSession.entries.length,shown=filteredEntries.length;
  const cats={};for(const e of filteredEntries)cats[e.category]=(cats[e.category]||0)+1;
  const tc=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  let parts2=['<strong>'+shown+'</strong> of '+tot];for(const[c2,n2]of tc)parts2.push(c2+': '+n2);
  stat.innerHTML=parts2.map(function(p){return '<span>'+p+'</span>'}).join('');
}

function openPop(idx){
  selEntry=filteredEntries[idx];
  document.querySelectorAll('.erow.sel').forEach(function(r){r.classList.remove('sel')});
  document.querySelectorAll('.erow[data-idx="'+idx+'"]').forEach(function(r){r.classList.add('sel')});
  const e=selEntry;document.getElementById('popTitle').textContent=e.name;
  document.getElementById('popOv').classList.add('open');
  const col=catColor(e.category);
  let h='<div class="pop-sum"><h2><span class="badge" style="background:'+col+'">'+esc(e.category)+'</span>'+(e.category!==e.name?' '+esc(e.name):'')+'</h2><div class="pop-meta">';
  h+=mi('Timestamp',fmtTSFull(e.timestamp));
  h+=mi('Source',e.source||'');
  if(e.data?.modelId)h+=mi('Model',e.data.modelId);
  if(e.data?.conversationId)h+=mi('Conversation',e.data.conversationId);
  if(e.data?.cwsprChatConversationId)h+=mi('Conversation',e.data.cwsprChatConversationId);
  if(e.data?.cwsprChatMessageId)h+=mi('Message ID',e.data.cwsprChatMessageId);
  if(e.data?.tabTitle)h+=mi('Tab Title',e.data.tabTitle);
  if(e.data?.cwsprChatConversationType)h+=mi('Conv Type',e.data.cwsprChatConversationType);
  if(e.data?.latency!==undefined)h+=mi('Latency',e.data.latency+'ms');
  if(e.data?.cwsprChatTimeToFirstChunk!==undefined)h+=mi('TTFC',e.data.cwsprChatTimeToFirstChunk+'ms');
  if(e.data?.cwsprChatFullResponseLatency!==undefined)h+=mi('Full Latency',e.data.cwsprChatFullResponseLatency+'ms');
  if(e.data?.perfE2ELatency!==undefined)h+=mi('E2E Latency',e.data.perfE2ELatency+'ms');
  if(e.data?.cwsprToolName)h+=mi('Tool',e.data.cwsprToolName);
  if(e.data?.toolName)h+=mi('Tool',e.data.toolName);
  if(e.data?.cwsprChatResponseCode!==undefined)h+=mi('Response Code',e.data.cwsprChatResponseCode);
  if(e.data?.cwsprChatRequestLength!==undefined)h+=mi('Request Len',e.data.cwsprChatRequestLength+' chars');
  if(e.data?.cwsprChatResponseLength!==undefined)h+=mi('Response Len',e.data.cwsprChatResponseLength+' chars');
  if(e.data?.cwsprChatHasCodeSnippet)h+=mi('Has Code','Yes');
  if(e.data?.cwsprChatRuleContextCount>0)h+=mi('Rules Used',e.data.cwsprChatRuleContextCount);
  if(e.data?.cwsprChatFileContextCount>0)h+=mi('Files Attached',e.data.cwsprChatFileContextCount);
  if(e.data?.cwsprChatSourceLinkCount>0)h+=mi('Citations',e.data.cwsprChatSourceLinkCount);
  if(e.data?.result)h+=mi('Result',e.data.result);
  if(e.data?.command)h+=mi('Command',e.data.command);
  if(e.data?.serverName)h+=mi('Server',e.data.serverName);
  if(e.data?.numTools!==undefined)h+=mi('Tools',e.data.numTools);
  if(e.data?.transportType)h+=mi('Transport',e.data.transportType);
  h+='</div></div>';

  if(e.category==='Request'&&e.data?.body)
    h+=sec('User Message','<div class="chat-msg user"><div class="chat-msg-lbl">User</div><div class="chat-msg-body">'+esc(e.data.body)+'</div></div>',true);
  if(e.category==='Slash Command'&&e.data?.body)
    h+=sec('Slash Command','<div class="chat-msg user"><div class="chat-msg-lbl">'+esc(e.name)+'</div><div class="chat-msg-body">'+esc(e.data.body)+'</div></div>',true);
  if(e.category==='Response'&&e.data?.body){
    h+=sec('Agent Response','<div class="chat-msg asst"><div class="chat-msg-lbl">Amazon Q</div><div class="chat-msg-body">'+esc(e.data.body)+'</div></div>',true);
    if(e.data.toolUses?.length){
      let th='';for(const tu of e.data.toolUses){th+='<div class="tool-item"><div class="tn">'+esc(tu.name||'Tool')+'</div>';if(tu.toolUseId)th+='<div class="tid">'+esc(tu.toolUseId)+'</div>';if(tu.input)th+='<div class="tinp">'+esc(JSON.stringify(tu.input,null,2))+'</div>';th+='</div>'}
      h+=sec('Tool Uses ('+e.data.toolUses.length+')',th,true);
    }
  }
  if(e.category==='Tool Call'&&e.data?.input)
    h+=sec('Tool Input','<pre>'+esc(JSON.stringify(e.data.input,null,2))+'</pre>',true);
  h+=sec('Full Data','<pre>'+esc(JSON.stringify(e.data,null,2))+'</pre>',false);
  if(e.raw&&e.raw!==e.data?.body)h+=sec('Raw Log','<pre>'+esc(e.raw)+'</pre>',false);

  const body=document.getElementById('popBody');body.innerHTML=h;body.scrollTop=0;
  body.querySelectorAll('.pop-sh').forEach(function(hdr){
    hdr.addEventListener('click',function(){hdr.querySelector('.arr').classList.toggle('open');hdr.nextElementSibling.classList.toggle('open')});
  });
}

function closePop(){document.getElementById('popOv').classList.remove('open');selEntry=null;document.querySelectorAll('.erow.sel').forEach(function(r){r.classList.remove('sel')})}
function copyJSON(){if(!selEntry)return;
  const text=JSON.stringify(selEntry.data,null,2);
  vscode.postMessage({command:'copyToClipboard',text:text});
}

/* ── Log Parser ── */
function parseLog(text,session){
  const entries=[];
  for(const line of text.split('\\n')){
    const m=line.match(/^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}) \\[(\\w+)\\] (.*)/);
    if(!m)continue;
    const tsStr=m[1],level=m[2],content=m[3];
    const ts=new Date(tsStr.replace(' ','T'));

    const em=content.match(/Emitting (amazonq_\\w+) telemetry: (\\{.*\\})/);
    if(em){
      let d={};try{d=JSON.parse(em[2])}catch{}
      const ev=em[1];
      switch(ev){
        case 'amazonq_invokeLLM':
          entries.push({timestamp:ts,category:'LLM Call',name:'Invoke LLM',
            summary:'Model: '+(d.modelId||'?')+' | '+(d.cwsprChatConversationType||'')+' | Tool: '+(d.cwsprToolName||'none')+' | '+d.latency+'ms',
            data:d,raw:line,source:session});break;
        case 'amazonq_addMessage':{
          const ruleCount=d.cwsprChatRuleContextCount||0;
          entries.push({timestamp:ts,category:'Response',name:'Model Response',
            summary:'Model: '+(d.modelId||'?')+' | Code '+d.cwsprChatResponseCode+' | '+d.cwsprChatFullResponseLatency+'ms | Req: '+d.cwsprChatRequestLength+' -> Res: '+d.cwsprChatResponseLength+' chars'+(d.cwsprChatHasCodeSnippet?' | Has Code':'')+(ruleCount>0?' | '+ruleCount+' rules':''),
            data:d,raw:line,source:session});
          if(ruleCount>0){
            entries.push({timestamp:ts,category:'Rules',name:ruleCount+' Rule(s) Applied',
              summary:d.cwsprChatRuleContextCount+' rules, '+(d.cwsprChatTotalRuleContextCount||0)+' total available, '+(d.cwsprChatRuleContextLength||0)+' chars',
              data:{ruleCount:d.cwsprChatRuleContextCount,totalRules:d.cwsprChatTotalRuleContextCount,ruleLength:d.cwsprChatRuleContextLength,conversationId:d.cwsprChatConversationId,modelId:d.modelId},raw:line,source:session});
          }
          break;}
        case 'amazonq_toolUseSuggested':
          entries.push({timestamp:ts,category:'Tool Call',name:'Tool: '+(d.cwsprToolName||'?'),
            summary:'E2E: '+d.perfE2ELatency+'ms | '+(d.result||'')+' | Conv: '+shortId(d.cwsprChatConversationId),
            data:d,raw:line,source:session});break;
        case 'amazonq_mcpServerInit':
          entries.push({timestamp:ts,category:'MCP',name:'MCP Server Init',
            summary:(d.command||'?')+' | '+d.numTools+' tools | '+d.transportType+' | '+(d.source||''),
            data:d,raw:line,source:session});break;
        case 'amazonq_mcpConfig':
          entries.push({timestamp:ts,category:'MCP',name:'MCP Config',
            summary:d.numActiveServers+' active | Global: '+d.numGlobalServers+' | Project: '+d.numProjectServers,
            data:d,raw:line,source:session});break;
      }
      continue;
    }

    const mcp=content.match(/lserver: (MCP: .+)/);
    if(mcp){
      const msg=mcp[1];
      const execM=msg.match(/Executing command: (.+?) \\(env: (.+?)\\)/);
      if(execM){entries.push({timestamp:ts,category:'MCP',name:'MCP Execute',summary:execM[1]+' (env: '+execM[2]+')',data:{command:execM[1],envVars:execM[2],message:msg},raw:line,source:session});continue}
      const trm=msg.match(/registered tool '(.+?)' for server '(.+?)'/);
      if(trm){entries.push({timestamp:ts,category:'MCP',name:'MCP Tool',summary:trm[1]+' on '+trm[2],data:{toolName:trm[1],serverName:trm[2],message:msg},raw:line,source:session});continue}
      continue;
    }

    if(level==='error'){entries.push({timestamp:ts,category:'Error',name:'Error',summary:content.substring(0,200),data:{message:content},raw:line,source:session});continue}

    const scp=content.match(/sendChatPrompt.*"model-selection":"([^"]+)"/);
    if(scp){entries.push({timestamp:ts,category:'LLM Call',name:'Send Prompt',summary:'Model: '+scp[1],data:{modelId:scp[1],message:content.substring(0,300)},raw:line,source:session});continue}
  }
  return entries;
}

/* ── Chat History Parser ── */
function parseChat(json,filename){
  const entries=[];
  const tabs=json.collections?.find(function(c){return c.name==='tabs'});
  if(!tabs)return entries;
  for(const tab of tabs.data||[]){
    const modelId=tab.modelId||'auto';
    for(const conv of tab.conversations||[]){
      for(const msg of conv.messages||[]){
        const ts=msg.timestamp?new Date(msg.timestamp):null;
        if(!ts||isNaN(ts))continue;
        const base={conversationId:conv.conversationId,tabTitle:tab.title,modelId:modelId};

        if(msg.type==='prompt'){
          const body=msg.body||'';
          const isSlash=body.match(/^\\s*\\/(help|clear|compact|dev|test|review|doc|transform)\\b/i);
          if(isSlash){
            entries.push({timestamp:ts,category:'Slash Command',name:'/'+isSlash[1],
              summary:body.substring(0,200),
              data:Object.assign({},base,{body:body,origin:msg.origin,slashCommand:isSlash[1],editorState:msg.userInputMessageContext?.editorState}),
              raw:body,source:filename});
          }else{
            entries.push({timestamp:ts,category:'Request',name:'User Request',
              summary:body.substring(0,200),
              data:Object.assign({},base,{body:body,origin:msg.origin,editorState:msg.userInputMessageContext?.editorState,images:msg.images?.length||0}),
              raw:body,source:filename});
          }
        }else if(msg.type==='answer'){
          const tus=msg.toolUses||[];
          entries.push({timestamp:ts,category:'Response',
            name:tus.length?'Response (+'+tus.length+' tools)':'Response',
            summary:(msg.body||'').substring(0,200),
            data:Object.assign({},base,{body:msg.body,toolUses:tus}),raw:msg.body,source:filename});
          for(const tu of tus){
            entries.push({timestamp:ts,category:'Tool Call',name:tu.name||'Tool',
              summary:shortId(tu.toolUseId)+' | '+fmtToolInput(tu.input),
              data:Object.assign({},base,{toolUseId:tu.toolUseId,toolName:tu.name,input:tu.input}),
              raw:JSON.stringify(tu,null,2),source:filename});
          }
        }
      }
    }
  }
  return entries;
}
function fmtToolInput(i){if(!i)return '';if(i.path)return i.path;if(i.query)return i.query;if(i.filePath)return i.filePath;return JSON.stringify(i).substring(0,120)}

/* ── Helpers ── */
function fmtTS(d){if(!d||isNaN(d))return '';return p2(d.getMonth()+1)+'/'+p2(d.getDate())+' '+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())}
function fmtTSFull(d){if(!d||isNaN(d))return '';return d.toISOString().replace('T',' ').replace('Z','')}
function fmtDateS(d){if(!d||isNaN(d))return '';const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return m[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()}
function fmtTime(d){if(!d||isNaN(d))return '';return p2(d.getHours())+':'+p2(d.getMinutes())}
function p2(n){return n<10?'0'+n:n}
function shortId(id){return !id?'\\u2014':id.length>12?id.substring(0,8)+'...':id}
function fmtBytes(b){if(!b)return '0 B';if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';return(b/1048576).toFixed(1)+' MB'}
function esc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function mi(l,v){return '<div class="pop-mi"><label>'+esc(l)+'</label><span>'+esc(String(v))+'</span></div>'}
function sec(title,content,open){return '<div class="pop-sec"><div class="pop-sh"><span class="arr '+(open?'open':'')+'">&#9654;</span>'+esc(title)+'<button class="cpb">Copy</button></div><div class="pop-sc '+(open?'open':'')+'">'+content+'</div></div>'}

/* ── Keyboard ── */
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(document.getElementById('popOv').classList.contains('open')){closePop();return}if(curSession){goBack();return}}
  if(!curSession||!selEntry)return;
  const idx=filteredEntries.indexOf(selEntry);
  if(e.key==='ArrowDown'&&idx<filteredEntries.length-1){e.preventDefault();openPop(idx+1);document.getElementById('entriesList').scrollTop=(idx+1)*ROW_H-document.getElementById('entriesList').clientHeight/2}
  if(e.key==='ArrowUp'&&idx>0){e.preventDefault();openPop(idx-1);document.getElementById('entriesList').scrollTop=(idx-1)*ROW_H-document.getElementById('entriesList').clientHeight/2}
});

/* ── Section copy handler (delegated) ── */
document.getElementById('popBody').addEventListener('click', function(e){
  if(e.target.classList.contains('cpb')){
    e.stopPropagation();
    const t=e.target.closest('.pop-sec').querySelector('.pop-sc').innerText;
    vscode.postMessage({command:'copyToClipboard',text:t});
    e.target.textContent='Copied!';setTimeout(function(){e.target.textContent='Copy'},1500);
  }
});

/* Init */
loadAll();
})();
</script>
</body>
</html>`;
}
