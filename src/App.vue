<script lang="ts" setup>

const MONACO_EDITOR_OPTIONS = {
    automaticLayout: true,
    formatOnType: true,
    formatOnPaste: true,
    "semanticHighlighting.enabled": true,
}
</script>

<script lang="ts">
import { defineComponent } from "vue"
import EditorSeparator from "./components/EditorSeparator.vue"
import MainView from "./components/MainView.vue"
import { example_code } from "./lib/example"
import { recover_prototypes } from "./lib/prototypes"
import { mount as editorMount } from "./lib/language"
import { expose, exposed_default } from "./lib/expose"
import CompilerWorker from "./workers/compiler?worker"

export default defineComponent({
    components: {
        EditorSeparator,
        MainView,
    },
    data() {
        const source = localStorage.editorSource as string
        return {
            compiler: null as Worker | null,
            compilerBusy: false,
            editorWidth: "50%",
            editorHeight: "100%",
            timeout: null as number | null,
            changeInterval: 500,
            code: source ? source : example_code,
            messages: [] as any[],
            objects: {},
        }
    },
    mounted() {
        expose(exposed_default)
        
        this.restartCompiler()
        setTimeout(() => this.compile(this.code), 1000)
    },
    methods: {
        log(level: string, message: string, resetLine: boolean = false) {
            if (resetLine && this.messages.length) {
                this.messages.pop()
            }
            this.messages.push({ level, message })
        },
        clearLog() {
            this.messages = []
        },

        async editorChange(source: string) {
            if (this.timeout) clearInterval(this.timeout)
            this.timeout = setTimeout(() => {
                this.timeout = null
                this.compile(source)
            }, this.changeInterval)

            localStorage.editorSource = source
        },

        restartCompiler() {
            if (this.compiler) {
                this.compiler.terminate()
                this.log("error", "Aborted.")
            }
            this.compiler = new CompilerWorker()
            this.compiler.onmessage = this.compile_response.bind(this)

            this.compilerBusy = false
        },
        async compile(source: string) {
            this.clearLog()

            if (this.compilerBusy) this.restartCompiler()

            if (!this.compiler) {
                this.log("error", "Compiler is broken. Refresh the page.")
                return
            }
            this.log("info", "Compiling...")

            this.compiler.postMessage({ type: "compile", source })
            this.compilerBusy = true
        },
        async compile_response(event: MessageEvent<any>) {
            const data = recover_prototypes(event.data)

            if (data.type === "success") {
                const { ast, tokens, scope, time_taken } = data

                this.log("success", `Done in ${time_taken}ms!`)

                this.objects = {}
                for (const [name, value] of scope) {
                    // @ts-ignore
                    this.objects[name] = value
                }

                expose({$ast: ast, $tokens: tokens, $scope: scope})

                this.compilerBusy = false
            } else if (data.type === "fail") {
                this.log("error", data.message)
                this.compilerBusy = false
            } else if (data.type === "log") {
                this.log(
                    data.level ?? "info",
                    data.message,
                    data.resetLine ? true : false,
                )
            }
        },
    },
})
</script>

<template>
    <main>
        <vue-monaco-editor
            v-model:value="code"
            language="automata"
            :options="MONACO_EDITOR_OPTIONS"
            :class="['editor']"
            :width="editorWidth"
            :height="editorHeight"
            @change="editorChange"
            @mount="editorMount"
        />
        <EditorSeparator />
        <MainView :messages="messages" :objects="objects"></MainView>
    </main>
</template>

<style>
:root {
    --white: #f0f0ff;
    --lighter-white: #f0f8ff;
    --light-gray: #e9e9f5;

    --black: #181818;
    --text: rgba(235, 235, 235, 0.64);

    --error: #f48771;
    --success: #64fa61;
    --background-lighter: #232323;
    --area-background: #212121;
    --background: #181818;
    --separator-background: #252526;
}

body {
    font-size: 16px;
    color: black;
    background: var(--background);
}

main,
#app {
    padding: 0;
    margin: 0;

    width: 100%;
    max-width: 100%;
    height: 100vh;
    max-height: 100%;
}

.editor {
    font-family: "Droid Sans Mono", "monospace";
    color: var(--light-gray);
}

main {
    display: flex;
    width: 100vw;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
}
</style>
