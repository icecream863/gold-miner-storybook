import { defineConfig } from 'vite';
export default defineConfig(({command})=>({base:'./',publicDir:command==='build'?false:'public',server:{host:'127.0.0.1',port:5176,strictPort:true},preview:{host:'127.0.0.1',port:4176,strictPort:true},build:{outDir:'.cache/classic-sample-dist',emptyOutDir:true,rollupOptions:{input:'sample.html'}}}));
