<template>
    <div
        class="container"
        ref="container"
        tabindex="1"
    >
        <div class="top">
            <div class="control">
                <span v-if="is_enumerating">Enumerating...</span>
                <button v-else @click="request_sentences">Continue</button>
            </div>
            <button class="close green" @click="close">X</button>
        </div>

        <div class="body">
            <p class="green text-small">Accepted Sentences</p>

            <ul class="sentences">
                <li v-for="(sentence, i) in ordered_sentences" :key="i">
                    <span class="sentence-index green text-small">{{i+1}}.</span>
                    <SentenceElement :value="sentence"/>
                </li>
            </ul>
        </div>

    </div>
</template>

<script lang="ts" setup>
defineProps<{
    grammar: Grammar
}>()
defineEmits<{
    (e: "close", event: void): void
}>()
</script>

<script lang="ts">
import { Grammar, serialize_sequence, type Sentence } from "@/lib/grammar"
import { defineComponent } from "vue"
import SentenceElement from "./SentenceElement.vue"
import GrammarEnumeratorWorker from "@/workers/grammar_enumerator?worker"
import { recover_prototypes, store_prototypes } from "@/lib/prototypes"
import type { GrammarEnumeratorResponse } from "@/workers/grammar_enumerator"


export default defineComponent({
    components: {
        SentenceElement,
    },
    data: () => ({
        worker: new GrammarEnumeratorWorker(),
        sentences: [] as Sentence[],
        is_enumerating: false,
        production_amount: 50,
    }),
    mounted() {
        this.worker.onmessage = this.worker_message.bind(this)

        this.start()
    },
    beforeUnmount() {
        this.close_worker()
        this.sentences = []
    },
    computed: {
        ordered_sentences() {
            const sentences = [...this.sentences]

            sentences.sort((a, b) => {
                if (a.length !== b.length) return a.length < b.length ? -1 : 1
                return serialize_sequence(a) <= serialize_sequence(b) ? -1 : 1
            })
            return sentences
        },
    },
    methods: {
        close_worker() {
            this.worker.postMessage({type: "close"})
        },
        start() {
            this.worker.postMessage(store_prototypes({
                type: "grammar",
                grammar: this.grammar.copy()
            }))

            this.request_sentences()
        },

        request_sentences() {
            this.worker.postMessage({type: "enumerate", amount: this.production_amount})
            this.is_enumerating = true
        },

        worker_message(event:  MessageEvent<any>) {
            const data = recover_prototypes(event.data) as GrammarEnumeratorResponse

            if (data.type === "sentence") {
                this.sentences.push(data.value)
            }
            else if (data.type === "done") {
                this.is_enumerating = false
            }
            else if (data.type === "closed") {
                this.worker.terminate()
                this.worker = new GrammarEnumeratorWorker()
                this.worker.onmessage = this.worker_message.bind(this)
            }
        },

        close() {
            this.$emit("close")
        },
        container_keydown(ev: KeyboardEvent) {
        }
    },
})
</script>


<style scoped>
.container {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    overflow-x: scroll;
    margin-right: 1rem;
    position: relative;
    
    color: var(--white);
    background: var(--background-13);
}
.container:focus {
    outline: none;
}
.container > .top {
    display: flex;
    flex-direction: row;
    padding: 0 1rem;
    justify-content: space-between;
    font-weight: 500;
}
.container > .top > .control {
    display: flex;
    gap: 1rem;
    align-items: center;
}

.container > .top button.close {
    font-weight: 800;
}

.body {
    padding: 0.5rem 1rem;
}
.sentences {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    /* flex-direction: column;
    align-items: center; */
    font-size: 1.25rem;
}
.sentences > * {
    font-size: 1em;
}
.sentence-index {
    margin-right: 0.25rem;
}

</style>
