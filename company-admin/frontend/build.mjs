import {build} from 'vite';
import {copyFile,mkdir} from 'node:fs/promises';
await build({configFile:false,base:'/',esbuild:{jsx:'automatic',tsconfigRaw:{compilerOptions:{jsx:'react-jsx'}}}});
for(const route of ['privacy-policy','data-deletion']){
 await mkdir(`dist/${route}`,{recursive:true});
 await copyFile('dist/index.html',`dist/${route}/index.html`);
}
