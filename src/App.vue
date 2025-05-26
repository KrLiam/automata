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
import MainView from "./components/MainView.vue"
import SplitView from "./components/SplitView.vue"
import { example_code, example_graphs } from "./lib/example"
import { recover_prototypes } from "./lib/prototypes"
import { mount as editorMount } from "./lib/language"
import { expose, exposed_default } from "./lib/expose"
import CompilerWorker from "./workers/compiler?worker"
import type { LangObject, Scope } from "./lib/evaluator"
import type { CompileSuccessResponse } from "./workers/compiler"

export default defineComponent({
    components: {
        MainView,
        SplitView,
    },
    data() {
        const source = localStorage.editorSource
        return {
            compiler: null as Worker | null,
            locked_compilation: false as boolean,
            pending_compilation: false as boolean,
            compilerBusy: false,
            timeout: null as number | null,
            changeInterval: 400,
            code: typeof source === "string" ? source : "",
            messages: [] as any[],
            objects: null as Scope | null,
        }
    },
    mounted() {
        document.addEventListener('keydown', function(event) {
        // Check if Ctrl + S is pressed
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault(); // Prevent the browser's Save dialog
            window.open('https://i1.rgstatic.net/ii/profile.image/277723235799047-1443225787410_Q512/Jerusa-Marchi.jpg', '_blank'); // Open Google in a new tab
        }
        });
        if (!this.code.length) this.load_example_code()

        expose(exposed_default)

        this.restartCompiler()
        setTimeout(() => this.compile(this.code), 1000)

        window.addEventListener("storage", (event) => {
            if (event.key !== "editorSource") return
            this.code = event.newValue ?? ""
            this.requestCompilation()
        })
    },
    methods: {
        load_example_code() {
            this.code = example_code
            localStorage.saved_graphs = JSON.stringify(example_graphs)
        },

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
            localStorage.editorSource = source

            if (this.timeout) clearInterval(this.timeout)
            this.timeout = setTimeout(() => {
                this.timeout = null
                this.requestCompilation()
            }, this.changeInterval)
        },

        lockCompilation() {
            if (this.compilerBusy) this.restartCompiler()
            this.locked_compilation = true
        },
        unlockCompilation() {
            this.locked_compilation = false
            if (this.pending_compilation) this.requestCompilation()
        },
        requestCompilation() {
            if (this.locked_compilation) {
                this.pending_compilation = true
                return
            }
            this.pending_compilation = false

            this.compile(this.code)
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
                const { ast, tokens, scope, time_taken } =
                    data as CompileSuccessResponse

                this.log("success", `Done in ${time_taken}ms!`)

                this.objects = scope

                expose({ $ast: ast, $tokens: tokens, $scope: scope })

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
        <SplitView
            class="main-split"
            :direction="'horizontal'"
            :initial="45"
            :separator_size="25"
        >
            <template v-slot:left>
                <vue-monaco-editor
                    v-model:value="code"
                    language="automata"
                    :options="MONACO_EDITOR_OPTIONS"
                    :class="['editor']"
                    :width="'100%'"
                    :height="'100%'"
                    @change="editorChange"
                    @mount="editorMount"
                />
            </template>
            <template v-slot:right>
                <MainView
                    :messages="messages"
                    :objects="objects"
                    @lock-compilation="lockCompilation"
                    @unlock-compilation="unlockCompilation"
                    @log="log($event[0], $event[1], $event[2])"
                ></MainView>
            </template>
        </SplitView>
    </main>
</template>

<style>
:root {
    --white: #f0f0ff;
    --lighter-white: #f0f8ff;
    --light-gray: #e9e9f5;

    --black: #181818;
    --text: rgba(235, 235, 235, 0.64);

    --detail-green: #00bd7e;
    --detail-yellow: #e1b217;
    --detail-red: #f83939;
    --detail-gray: #c0c0c0;

    --error: #f48771;
    --success: #64fa61;
    --background-9: #181818;
    --background-12: #1e1e1e;
    --background-13: #212121;
    --background-15: #252525;
    --background-20: #333333;
    --select: #607fef;
    --detail-15: #3a3a3a;
}

html {
    overscroll-behavior: contain;
}
body {
    font-size: 16px;
    color: black;
    background: var(--background-9);
    overscroll-behavior: contain;
}

* {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.1) rgba(0, 0, 0, 0);
}
*:hover {
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0);
}
*::-webkit-scrollbar {
    width: 0.25rem;
}
*::-webkit-scrollbar-corner {
    display: none;
}
*::-webkit-scrollbar-track {
    display: none;
}

*::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
}
*::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
}

ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
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

* {
    font-family: "Droid Sans", monospace;
    font-size: 15px;
    font-weight: 400;
}
main {
    display: flex;
    width: 100vw;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    font-family: "Droid Sans Mono", "monospace";
}

.main-split > .separator {
    background: var(--background-12);
    border-left: var(--detail-15) solid 0.1em;
}

.editor {
    color: var(--light-gray);
    background: var(--background-12);
}
</style>
