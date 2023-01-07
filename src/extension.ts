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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "replicated" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('replicated.lint', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		if (vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders.length > 0 : false) {
			(vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders : []).forEach(function (fldr) {
				const absolutePath = fldr.uri.path;
				const manifestFldr = vscode.workspace.getConfiguration('replicated').get("manifestsFolder");
				
				
				getlintdata(path.join(absolutePath, String(manifestFldr)));
					
				
			});
		}
	});

	context.subscriptions.push(disposable);
}

function getlintdata(fldr: string) {
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
			vscode.window.showInformationMessage('Replicated Lint results: '  + rawData);
		});
		
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
