import { defineConfig } from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5276,strictPort:true},build:{outDir:'work/scenarios/dist',rollupOptions:{input:'scenario-demo.html'},chunkSizeWarningLimit:1600}});
