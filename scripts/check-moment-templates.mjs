import { readConfiguration, createProgram } from '@angular/compiler-cli';
import ts from 'typescript';
const config=readConfiguration('tsconfig.json',{noEmit:true});
const program=createProgram({rootNames:config.rootNames,options:config.options,host:ts.createCompilerHost(config.options)});
const diagnostics=[...config.errors,...program.getTsSyntacticDiagnostics(),...program.getTsSemanticDiagnostics(),...program.getNgStructuralDiagnostics(),...program.getNgSemanticDiagnostics()];
console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:p=>p,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
process.exitCode=diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error)?1:0;
