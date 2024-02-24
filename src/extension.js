const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class ConsoleLogViewProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }

    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.onDidReceiveMessage(
            (message) => {
                if (message.command === 'openFile') {
                    const openPath = vscode.Uri.file(message.text.path);
                    vscode.workspace
                        .openTextDocument(openPath)
                        .then((doc) => {
                            vscode.window
                                .showTextDocument(doc, {
                                    selection: new vscode.Range(
                                        new vscode.Position(message.text.line, 0),
                                        new vscode.Position(message.text.line, 0)
                                    ),
                                    revealType: vscode.TextEditorRevealType.InCenter,
                                })
                                .catch((error) => {
                                    vscode.window.showErrorMessage(`Nie udało się otworzyć pliku: ${error}`);
                                });
                        })
                        .catch((error) => {
                            vscode.window.showErrorMessage(`Nie udało się otworzyć dokumentu: ${error}`);
                        });
                } else if (message.command === 'toggleComment') {
                    const openPath = vscode.Uri.file(message.text.path);
                    vscode.workspace
                        .openTextDocument(openPath)
                        .then((doc) => {
                            const edit = new vscode.WorkspaceEdit();
                            const position = new vscode.Position(message.text.line, 0);
                            const range = doc.lineAt(position).range;
                            const text = doc.getText(range);
                            let newText;
                            if (message.text.active) {
                                newText = text.replace(/\/\/\s*(console\.log)/, '$1');
                            } else {
                                newText = text.replace(/(console\.log)/, '// $1');
                            }
                            edit.replace(openPath, range, newText);
                            return vscode.workspace.applyEdit(edit);
                        })
                        .catch((error) => {
                            vscode.window.showErrorMessage(`Nie udało się otworzyć dokumentu: ${error}`);
                        });
                } else if (message.command === 'deleteLog') {
                    const openPath = vscode.Uri.file(message.text.path);
                    vscode.workspace
                        .openTextDocument(openPath)
                        .then((doc) => {
                            const edit = new vscode.WorkspaceEdit();
                            const position = new vscode.Position(message.text.line, 0);
                            const range = doc.lineAt(position).range;
                            edit.delete(openPath, range);
                            return vscode.workspace.applyEdit(edit);
                        })
                        .catch((error) => {
                            vscode.window.showErrorMessage(`Nie udało się otworzyć dokumentu: ${error}`);
                        });
                }
            },
            undefined,
            context.subscriptions
        );

        const logs = [];
        vscode.workspace
            .findFiles('**/*.{js,ts,jsx,tsx,mjs,cjs}')
            .then((files) => {
                files.forEach((file) => {
                    const content = fs.readFileSync(file.fsPath, 'utf8');
                    const lines = content.split('\n');

                    lines.forEach((line, i) => {
                        if (line.includes('console.log')) {
                            const isCommented = line.match(/\/\/\s*console\.log/);
                            logs.push({
                                file: file.fsPath,
                                line: i + 1,
                                column: line.indexOf('console.log'),
                                code: line.trim(),
                                active: !isCommented,
                            });
                        }
                    });
                });

                let html = `
            <html>
            <head>
            <head>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/themes/prism-tomorrow.min.css" rel="stylesheet" />
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/prism.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/components/prism-javascript.min.js"></script>
        </head>

                <style>
                * {
                box-sizing: border-box;
                padding: 0;
                margin: 0;
                font-family: Fira Code, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            ul {
                list-style-type: none;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            li {
            
            }
            .location {
                font-size: 0.8em;
                color: gray;
            }
            .code {
                background-color: #242424;
                display: inline-block;
            }
            .buttons {
                margin-top: 5px;
            }
            .buttons button {
                margin-right: 5px;
            }
                </style>
                <script>
                const vscode = acquireVsCodeApi();
                function openFile(path, line) {
                    vscode.postMessage({
                        command: 'openFile',
                        text: { path: path, line: line }
                    });
                }
                function toggleComment(path, line, checkboxId) {
                    const checkbox = document.getElementById(checkboxId);
                    const label = document.getElementById('label' + checkboxId);
                    vscode.postMessage({
                        command: 'toggleComment',
                        text: { path: path, line: line, active: checkbox.checked }
                    });
                    label.textContent = checkbox.checked ? 'Active' : 'Inactive';
                }
                function deleteLog(path, line) {
                    vscode.postMessage({
                        command: 'deleteLog',
                        text: { path: path, line: line }
                    });
                }
            </script>
            </head>
            <body>
            <ul>
            `;
                logs.forEach((log, index) => {
                    const dir = path.dirname(log.file);
                    const parentFolder = path.basename(dir);
                    const file = path.basename(log.file);
                    const correctedPath = log.file.replace(/\\/g, '/'); // zamieniamy podwójne ukośniki na pojedyncze
                    html += `
                <li>
                    <div class="location">${parentFolder}/${file}:${log.line}:${log.column}</div>
                    <pre><code class="language-javascript code" onclick="openFile('${correctedPath}', ${log.line - 1})">${
                        log.code
                    }</code></pre>
                    <div class="buttons">
                        <button onclick="openFile('${correctedPath}', ${log.line - 1})">Open in file</button>
                        <input type="checkbox" id="log${index}" onclick="toggleComment('${correctedPath}', ${
                        log.line - 1
                    }, 'log${index}')" ${log.active ? 'checked' : ''}>
                        <label id="labellog${index}" for="log${index}">${log.active ? 'Active' : 'Inactive'}</label>
                        <button onclick="deleteLog('${correctedPath}', ${log.line - 1})">Delete</button>
                    </div>
                </li>
                `;
                });
                html += '</ul></body></html>';

                webviewView.webview.html = html;
            })
            .catch((error) => {
                vscode.window.showErrorMessage(`Nie udało się znaleźć plików: ${error}`);
            });
    }
}

function activate(context) {
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('consoleLogManagerView', new ConsoleLogViewProvider(context.extensionUri))
    );
}

exports.activate = activate;
