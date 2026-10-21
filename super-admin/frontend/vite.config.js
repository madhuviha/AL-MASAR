import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 const proxyTarget=env.VITE_PROXY_TARGET||'http://127.0.0.1:3001';
 return {plugins:[react()],base:'/admin/',resolve:{dedupe:['react','react-dom']},server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/inviha-api':{target:proxyTarget,rewrite:p=>p.replace(/^\/inviha-api/,'')}}}};
});
