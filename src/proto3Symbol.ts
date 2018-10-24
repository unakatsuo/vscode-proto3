'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import proto = require('google-protobuf/google/protobuf/descriptor_pb');
import { Proto3Compiler } from './proto3Compiler';

export class Proto3DocumentSymbolProvider implements vscode.DocumentSymbolProvider {
	private compiler: Proto3Compiler;

	private proto3KindToCodeKind: { [key: string]: vscode.SymbolKind } = {
		'package': vscode.SymbolKind.Package,
		'import': vscode.SymbolKind.Namespace,
		'message': vscode.SymbolKind.Struct,
		'enum': vscode.SymbolKind.Enum,
	};

	constructor(compiler: Proto3Compiler) {
		this.compiler = compiler;
	}

	public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
		console.log("Enter provideDocumentSymbols");
		return this.compileToDescriptor(document.fileName, token).then(descpb => {
			return this.convertToCodeSymbols(descpb);
		});
	}

	private convertToCodeSymbols(fsetpb: proto.FileDescriptorSet): vscode.SymbolInformation[] {
		console.log("Enter convertToCodeSymbols");
		
		/*
		let find = (): vscode.Location =>{
			
			for(let l in descpb.sourceCodeInfo.locationList) {
			return new vscode.Location(
				vscode.Uri.file(l),
				new vscode.Position(0, 0));
			}
		}
*/
		let symbols: vscode.SymbolInformation[] = [];
		fsetpb.getFileList().forEach((fdescpb) => {
			//let loc = find();
			let filepath = vscode.Uri.file(fdescpb.getName());

			fdescpb.getEnumTypeList().forEach((enumpb)=>{
				let loc = new vscode.Location(filepath, new vscode.Position(0, 0));
				symbols.push(new vscode.SymbolInformation(enumpb.getName(), vscode.SymbolKind.Enum, '', loc));
				enumpb.getValueList().forEach((evpb)=>{
					let loc = new vscode.Location(filepath, new vscode.Position(0, 0));
					symbols.push(new vscode.SymbolInformation(evpb.getName(), vscode.SymbolKind.EnumMember, enumpb.getName(), loc));
				});
			});
			fdescpb.getMessageTypeList().forEach(((descpb)=>{
				let loc = new vscode.Location(filepath, new vscode.Position(0, 0));
				symbols.push(new vscode.SymbolInformation(descpb.getName(), vscode.SymbolKind.Struct, '', loc));
				let c = new vscode.SymbolInformation(descpb.getName(), vscode.SymbolKind.Struct, '', loc);
				descpb.getFieldList().forEach((fieldpb)=>{
					let loc = new vscode.Location(filepath, new vscode.Position(0, 0));
					symbols.push(new vscode.SymbolInformation(fieldpb.getName(), vscode.SymbolKind.Property, c.containerName, loc));
				});
			}));
			fdescpb.getSourceCodeInfo().getLocationList().forEach((lpb)=>{
				console.log(lpb.getPathList());
			});

			//symbols.push(new vscode.SymbolInformation(msgtype.name, vscode.SymbolKind.Struct, " ", loc));
		});

		return symbols;
	}

	private compileToDescriptor(fileName: string, token: vscode.CancellationToken): Promise<proto.FileDescriptorSet> {
		let protopath = path.relative(vscode.workspace.rootPath, fileName);

		let outpath = path.join(os.tmpdir(), "xxx.raw.pb")
		let args = this.compiler.getProtocOptions()
			.concat("--descriptor_set_out=" + outpath)
			.concat("--include_source_info")
			.concat(protopath);

		let p: cp.ChildProcess;

		if (!token) {
			token.onCancellationRequested(() => {
				if (!p) { return; }
				try {
					p.kill();
				} catch (e) {
					console.log('Failed to kill protoc: ' + e);
				}
			});
		}
		console.log("Enter compileToDescriptor: " + outpath);

		return new Promise((resolve, reject) => {
			console.log("Exec: " + this.compiler.getProtocPath() + " " + args.join(" "));
			p = cp.execFile(this.compiler.getProtocPath(), args, { cwd: vscode.workspace.rootPath }, (err, stdout, stderr) => {
				if (err && stdout.length == 0 && stderr.length == 0) {
					return reject(err);
				}
				console.log("Finished to run protoc: ");

				fs.readFile(outpath, (err, buf) => {
					if (err) {
						return reject(err);
					}

					try {
						let fsetpb = proto.FileDescriptorSet.deserializeBinary(Uint8Array.from(buf));
						return resolve(fsetpb);
					}catch(err) {
						console.log(err);
						return reject(err);
					}
				});
			});
		});
	}
}

import path = require('path');
import os = require('os');
import fs = require('fs');
