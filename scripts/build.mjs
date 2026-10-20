import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(app,cli,args){const cwd=path.join(root,'apps',app);const executable=path.join(cwd,'node_modules',cli);if(!existsSync(executable))throw new Error(`Faltan dependencias de ${app}. Ejecuta RECOMPILAR.cmd.`);const result=spawnSync(process.execPath,[executable,...args],{cwd,stdio:'inherit'});if(result.status!==0)process.exit(result.status || 1);}
run('gmail','typescript/bin/tsc',['-b']);
run('gmail','vite/bin/vite.js',['build','--outDir',path.join(root,'extension/apps/gmail'),'--emptyOutDir']);
run('outlook','@angular/cli/bin/ng.js',['build','--configuration','production','--base-href','./','--output-path',path.join(root,'.build/outlook')]);
mkdirSync(path.join(root,'extension/apps/outlook'),{recursive:true});
cpSync(path.join(root,'.build/outlook/browser'),path.join(root,'extension/apps/outlook'),{recursive:true});
console.log('Extensión compilada. Recárgala desde la página de extensiones del navegador.');
