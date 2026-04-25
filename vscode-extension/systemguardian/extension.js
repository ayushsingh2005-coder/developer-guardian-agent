'use strict';

const vscode = require('vscode');
const { GoogleGenAI } = require('@google/genai');

// ── Risk analyzer ──────────────────────────────────────────
function analyzeCommand(command) {
  const lowerCmd = command.toLowerCase().trim();
  let score = 0;
  let match = null;

  if (lowerCmd.includes('rm -rf')) {
    const dangerPaths = ['/', '~', '/etc', '/home'];
    const onDanger = dangerPaths.some(p => lowerCmd.includes(p));
    score = onDanger ? 95 : 50;
    match = onDanger ? 'Recursive delete on critical path' : 'Recursive delete';
  } else if (lowerCmd.includes('git push --force') || lowerCmd.includes('git push -f')) {
    score = lowerCmd.includes('main') || lowerCmd.includes('master') ? 90 : 45;
    match = 'Force push detected';
  } else if (lowerCmd.includes('chmod 777')) {
    score = 85; match = 'Full permissions granted globally';
  } else if (lowerCmd.includes('docker system prune')) {
    score = 70; match = 'Docker full prune';
  } else if (lowerCmd.includes('dd if=') && lowerCmd.includes('of=')) {
    score = 90; match = 'Direct disk write';
  } else if (lowerCmd.includes('mkfs')) {
    score = 95; match = 'Disk format command';
  } else if (lowerCmd.includes(':(){:|:&};:')) {
    score = 100; match = 'Fork bomb detected';
  } else if ((lowerCmd.includes('curl') || lowerCmd.includes('wget')) &&
             (lowerCmd.includes('| sh') || lowerCmd.includes('| bash'))) {
    score = 90; match = 'Remote script execution via pipe';
  } else if (lowerCmd.includes('sudo') && !lowerCmd.includes('apt-get update')) {
    score = 40; match = 'Sudo usage detected';
  }

  const level = score >= 70 ? 'dangerous' : score >= 30 ? 'warning' : 'safe';
  return { level, score, match: match || 'No specific risk pattern' };
}

// ── Gemini AI explanation ──────────────────────────────────
async function getExplanation(command, score, apiKey) {
  try {
    const client = new GoogleGenAI({ apiKey });
    const prompt = `You are a terminal security expert.
Analyze this command and respond ONLY in valid JSON, no markdown.

Command: ${command}
Risk Score: ${score}/100

Return JSON with these exact keys:
- "explanation": what this command does and why it is risky
- "consequences": worst case scenario
- "saferAlternative": safer command to use instead
- "safeWhen": when is it actually safe to run`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const raw = response.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    return {
      explanation: `AI unavailable: ${err.message}`,
      consequences: 'Could not determine consequences.',
      saferAlternative: 'Review the command carefully.',
      safeWhen: 'When you are absolutely certain.'
    };
  }
}

// ── Webview HTML ───────────────────────────────────────────
function getWebviewHtml(command, analysis, explanation) {
  const color = analysis.level === 'dangerous'
    ? '#ff4444' : analysis.level === 'warning'
    ? '#ffaa00' : '#44ff88';

  const icon = analysis.level === 'dangerous' ? '🚨'
    : analysis.level === 'warning' ? '⚠️' : '✅';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 24px;
      font-size: 14px;
    }
    .command {
      background: #2d2d2d;
      border-left: 3px solid ${color};
      padding: 12px 16px;
      border-radius: 6px;
      font-family: monospace;
      color: #f8f8f2;
      margin-bottom: 20px;
      word-break: break-all;
    }
    .score {
      font-size: 26px;
      font-weight: bold;
      color: ${color};
      margin-bottom: 20px;
    }
    .card {
      background: #252526;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #333;
    }
    .card-label {
      font-size: 11px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }
    .card-value { color: #d4d4d4; line-height: 1.6; }
    .alt { color: #44ff88; }
  </style>
</head>
<body>
  <div class="command">> ${command}</div>
  <div class="score">${icon} ${analysis.level.toUpperCase()} — ${analysis.score}/100</div>

  <div class="card">
    <div class="card-label">📌 Rule Matched</div>
    <div class="card-value">${analysis.match}</div>
  </div>

  ${explanation ? `
  <div class="card">
    <div class="card-label">🧠 Explanation</div>
    <div class="card-value">${explanation.explanation}</div>
  </div>
  <div class="card">
    <div class="card-label">💣 Consequences</div>
    <div class="card-value">${explanation.consequences}</div>
  </div>
  <div class="card">
    <div class="card-label">🛠️ Safer Alternative</div>
    <div class="card-value alt">${explanation.saferAlternative}</div>
  </div>
  <div class="card">
    <div class="card-label">✅ Safe When</div>
    <div class="card-value">${explanation.safeWhen}</div>
  </div>
  ` : `
  <div class="card">
    <div class="card-label">⚠️ AI Unavailable</div>
    <div class="card-value">
      Set your API key via:<br/>
      <code>Ctrl+Shift+P → Guardian: Set Gemini API Key</code>
    </div>
  </div>
  `}
</body>
</html>`;
}

// ── Extension activate ─────────────────────────────────────
function activate(context) {

  // Command 1: Analyze selected text
  const analyzeCmd = vscode.commands.registerCommand(
    'systemguardian.analyzeCommand',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Guardian: Open a file and select a command first.');
        return;
      }

      const selected = editor.document.getText(editor.selection).trim();
      if (!selected) {
        vscode.window.showWarningMessage('Guardian: Select a command in the editor first.');
        return;
      }

      const analysis = analyzeCommand(selected);
      const config = vscode.workspace.getConfiguration('systemguardian');
      const apiKey = config.get('apiKey');

      vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '🛡️ Guardian analyzing...' },
        async () => {
          const explanation = apiKey
            ? await getExplanation(selected, analysis.score, apiKey)
            : null;
          const panel = vscode.window.createWebviewPanel(
            'guardianResult', '🛡️ Guardian Analysis',
            vscode.ViewColumn.Beside, {}
          );
          panel.webview.html = getWebviewHtml(selected, analysis, explanation);
        }
      );
    }
  );

  // Command 2: Open Guardian Terminal
  const openShell = vscode.commands.registerCommand(
    'systemguardian.openShell',
    () => {
      const terminal = vscode.window.createTerminal({ name: '🛡️ Guardian Shell' });
      terminal.sendText('guardian on');
      terminal.show();
    }
  );

  // Command 3: Set API Key
  const setKey = vscode.commands.registerCommand(
    'systemguardian.setApiKey',
    async () => {
      const key = await vscode.window.showInputBox({
        prompt: '🔑 Enter your Gemini API Key',
        password: true,
        placeHolder: 'AIzaSy...',
        validateInput: (val) => val && val.length > 10 ? null : 'Key too short'
      });
      if (key) {
        await vscode.workspace.getConfiguration('systemguardian')
          .update('apiKey', key.trim(), vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✅ Guardian: API Key saved successfully!');
      }
    }
  );

  // Command 4: Show Status
  const showStatus = vscode.commands.registerCommand(
    'systemguardian.showStatus',
    () => {
      const config = vscode.workspace.getConfiguration('systemguardian');
      const apiKey = config.get('apiKey');
      const safeMode = config.get('safeMode');
      vscode.window.showInformationMessage(
        `🛡️ Guardian | API Key: ${apiKey ? '✅ Set' : '❌ Not set'} | Safe Mode: ${safeMode ? 'ON' : 'OFF'}`
      );
    }
  );

  context.subscriptions.push(analyzeCmd, openShell, setKey, showStatus);

  // Welcome message
  vscode.window.showInformationMessage(
    '🛡️ SystemGuardian active! Use Ctrl+Shift+P → Guardian commands.',
    'Set API Key', 'Open Guardian Shell'
  ).then(choice => {
    if (choice === 'Set API Key') {
      vscode.commands.executeCommand('systemguardian.setApiKey');
    } else if (choice === 'Open Guardian Shell') {
      vscode.commands.executeCommand('systemguardian.openShell');
    }
  });
}

function deactivate() {}

module.exports = { activate, deactivate };