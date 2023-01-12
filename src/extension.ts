// The module 'vscode' contains the VS Code extensibility API	
// Import the module and reference it with the alias vscode in your code below
import {promisify} from 'node:util';
import stream from 'node:stream';
import * as vscode from 'vscode';
import * as tar from 'tar';
import got, { PlainResponse } from 'got';
import * as fs from 'fs';
import path = require('path/posix');
import { allowedNodeEnvironmentFlags } from 'node:process';
import { languages, Diagnostic, DiagnosticSeverity } from 'vscode';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "replicated" is now active!');
	let diagnosticCollection = languages.createDiagnosticCollection("replicated");
	let enableOnSave = false;

	let d1 = vscode.commands.registerCommand('replicated.lint.enable', () => {
		diagnosticCollection.clear();
		enableOnSave = true;
		processFolders(diagnosticCollection);
	});

	let d2 = vscode.commands.registerCommand('replicated.lint.disable', () => {
		diagnosticCollection.clear();
		enableOnSave = false;
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let d3 = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
		if (enableOnSave) {
			diagnosticCollection.clear();
			processFolders(diagnosticCollection);
		}
	});

	context.subscriptions.push(d1,d2,d3);
}

function processFolders(diagnosticCollection: vscode.DiagnosticCollection) {
	if (vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders.length > 0 : false) {
		(vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders : []).forEach(function (fldr) {
			const absolutePath = fldr.uri.path;
			const manifestFldr = vscode.workspace.getConfiguration('replicated').get("manifestsFolder");
			
			getlintdata(path.join(absolutePath, String(manifestFldr)), diagnosticCollection);
				
		});
	}
}

function getlintdata(fldr: string, diagnosticCollection: vscode.DiagnosticCollection) {
	const pipeline = promisify(stream.pipeline);

	let readable = tar.c({}, [fldr]);
	const lintstream = got.stream.post('https://lint.replicated.com/v1/lint');
	
	pipeline(
		readable,
		lintstream,
		new stream.PassThrough()
	);

	lintstream.on('response',async (response:PlainResponse) => {
		console.log('success: ' + response.statusCode);
		let rawData = '';
		response.on('data',  (chunk) => { rawData += chunk; });
		response.on('end', () => {
			let lintResults = JSON.parse(rawData);
			let map = new Map();


			lintResults.lintExpressions.forEach(function (lintExpression: { path: string; }) {
				if (map.has(lintExpression.path)) {
					var exps = map.get(lintExpression.path);
					exps.push(lintExpression);
					map.set(lintExpression.path,exps);
				} else {
					map.set(lintExpression.path, [lintExpression]);
				}
			});

			
			for (let key of map.keys()) {
				let diagnostics : Diagnostic[] = [];
				for (let lexpr of map.get(key)) {
					for (let pos of lexpr.positions) {
						let range = new vscode.Range(new vscode.Position(pos.start.line-1,0),new vscode.Position(pos.start.line-1,0));
						let message = "Replicated: " + lexpr.message;
						let severity = DiagnosticSeverity.Warning;
						if (lexpr.type === "info") {
							severity = DiagnosticSeverity.Information;
						}
						if (lexpr.type === "error") {
							severity = DiagnosticSeverity.Error;
						}
						diagnostics.push(new Diagnostic(range, message, severity));
					}
				}
				diagnosticCollection.set(vscode.Uri.file(key), diagnostics);
			}
		});
		
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
