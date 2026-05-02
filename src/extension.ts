import * as vscode from 'vscode';
import { LogViewerPanel } from './logViewerPanel';
import { LogViewerSidebarProvider } from './logViewerPanel';

export function activate(context: vscode.ExtensionContext) {
  // Register the sidebar webview provider
  const sidebarProvider = new LogViewerSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('amazonq-logviewer.viewer', sidebarProvider)
  );

  // Register command to open in editor panel (full view)
  context.subscriptions.push(
    vscode.commands.registerCommand('amazonq-logviewer.open', () => {
      LogViewerPanel.createOrShow(context.extensionUri);
    })
  );

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('amazonq-logviewer.refresh', () => {
      if (LogViewerPanel.currentPanel) {
        LogViewerPanel.currentPanel.refresh();
      }
      sidebarProvider.refresh();
    })
  );
}

export function deactivate() {}
