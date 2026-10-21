import {build} from 'vite';
await build({
 configFile:false,
 base:'/admin/',
 resolve:{dedupe:['react','react-dom','react-leaflet','leaflet','lucide-react']},
 esbuild:{jsx:'automatic',tsconfigRaw:{compilerOptions:{jsx:'react-jsx'}}}
});
