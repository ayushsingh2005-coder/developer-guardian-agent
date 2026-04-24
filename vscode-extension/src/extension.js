const vscode = require('vscode');
const path = require('path');
// Require the core analyzer from our parent package so logic is shared
const analyzer = require('../../src/core/analyzer');

function activate(context) {
    console.log('Developer Guardian Extension is now active!');

    // In a real advanced integration, we would listen to terminal data streams
    // VS Code provides pseudoterminal APIs or onDidWriteData.
    // For this prototype, we simulate checking the active terminal's last input
    // or providing a command palette action to analyze.

    let disposable = vscode.commands.registerCommand('developer-guardian.analyzeLastCommand', async () => {
        const userInput = await vscode.window.showInputBox({
            prompt: "Enter a command to simulate Guardian analysis",
            placeHolder: "rm -rf /"
        });

        if (userInput) {
            // Note: Since extension runs in VS Code's context, cwd might be workspace root
            const analysis = analyzer.analyzeCommand(userInput);
            
            if (analysis.level === 'dangerous') {
                vscode.window.showErrorMessage(`🚨 DANGEROUS COMMAND [Score: ${analysis.score}/100]: ${analysis.match}. This could be destructive!`);
            } else if (analysis.level === 'warning') {
                vscode.window.showWarningMessage(`⚠️ WARNING [Score: ${analysis.score}/100]: ${analysis.match}. Proceed with caution.`);
            } else {
                vscode.window.showInformationMessage(`✅ SAFE [Score: ${analysis.score}/100]: Command looks fine.`);
            }
        }
    });

    context.subscriptions.push(disposable);

    // Terminal data listener example (relies on specific VS Code API capabilities)
    // Here we would parse input and show hover/inline notifications.
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
