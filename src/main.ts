import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'

const app = createApp(App)
app.use(VueMonacoEditorPlugin, {
    paths: {
        // The recommended CDN config
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.38.0/min/vs'
    },
})
app.mount('#app')
