import { type Grammar, type SentencialSequence, type Sentence, is_sentence, serialize_sequence } from "@/lib/grammar"
import { recover_prototypes, store_prototypes } from "@/lib/prototypes"


export type GrammarEnumeratorRequest = {
    type: "grammar",
    grammar: Grammar,
} | {
    type: "enumerate"
    amount: number
} | {
    type: "close"
}

export type GrammarEnumeratorResponse = {
    type: "sentence",
    value: Sentence,
} | {
    type: "done"
} | {
    type: "closed"
}

const enumerator = {
    grammar: null as Grammar | null,
    sequences: [] as SentencialSequence[],
    max_sequence_amount: 50_000,

    init(grammar: Grammar) {
        this.grammar = grammar
        this.sequences = [this.grammar.start_sequence()]
    },

    close() {
        while (this.sequences.length) this.sequences.pop()
    },

    add_active_sequence(sequence: SentencialSequence) {
        if (this.sequences.length >= this.max_sequence_amount) {
            const i = Math.floor(Math.random() * this.sequences.length)
            this.sequences.splice(i, 1)
        }
        this.sequences.push(sequence)
    },

    *enumerate(sentence_amount: number): Generator<Sentence, void, void> {
        if (!this.grammar) return

        let count = 0

        while (count < sentence_amount) {
            const sequence = this.sequences.shift()
            if (!sequence) break

            const new_sequences = this.grammar.rewrite(sequence)

            for (const new_sequence of new_sequences) {
                if (is_sentence(new_sequence)) {
                    count++
                    yield new_sequence
                }
                else {
                    this.add_active_sequence(new_sequence)
                }
            }
        }
    },
}

onmessage = function(event) {
    const data = recover_prototypes(event.data) as GrammarEnumeratorRequest

    if (data.type === "grammar") {
        enumerator.init(data.grammar)
    }
    else if (data.type === "enumerate") {
        for (const sentence of enumerator.enumerate(data.amount)) {
            postMessage(store_prototypes({
                type: "sentence",
                value: sentence,
            }))
        }
        postMessage({type: "done"})    }
    else if (data.type ==="close") {
        enumerator.close()
        postMessage({type:"closed"})
    }
}
