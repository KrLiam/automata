<template>
    <div
        class="container"
        ref="container"
        tabindex="1"
        @keydown="container_keydown"
        @focusin="focused = true"
        @focusout="focused = false"
    >
        <div class="top">
            <button class="close green" @click="close">X</button>
            <div class="control">
                <button @click="step">Step <span v-if="focused" class="shortcut_label">(Space)</span></button>
            </div>
        </div>
        <div class="configurations-wrapper">
            <ul class="configurations">
                <li
                    :class="['configuration', instanceStatus(inst)]"
                    v-for="(inst, i) in instances"
                    :key="i"
                >
                    {{ inst.conf.state }}
                </li>
            </ul>
        </div>
        <ul class="tapes">
            <li
                v-for="(tape, i) in tapes"
                :key="i"
                :class="['tape-track', automaton?.bounded ? null : 'unbounded']"
            >
                <div
                    :class="['tape', overflow_left[i] ? 'overflow_left' : null]"
                    :style="tapeStyle(i, ...tape)"
                    @animationend="overflow_left[i] = false"
                >
                    <span
                        v-for="(symbol, i) in tape[0]"
                        :key="`${i}-${symbol}`"
                        :class="[tape[1] === i ? 'head' : null]"
                        >{{ symbol }}</span
                    >
                </div>
            </li>
        </ul>
    </div>
</template>

<script lang="ts" setup>
defineProps<{
    automaton: StateMachine<any, any> | null
    input: string | null
}>()
defineEmits<{
    (e: "close", event: void): void
    (e: "updated-state", event: Instance[]): void
}>()
</script>

<script lang="ts">
import type { ConfigurationNode, StateMachine, Transition } from "../lib/automaton"
import { defineComponent } from "vue"

export function* zip<A, B>(a: A[], b: B[]): Generator<[A, B]> {
    const max_i = Math.min(a.length, b.length)
    for (let i = 0; i < max_i; i++) {
        yield [a[i], b[i]]
    }
}

export interface Instance {
    conf: ConfigurationNode
    next_confs: ConfigurationNode[]
    transitions: Transition<any, any>[]
    selected: boolean
    accepted: boolean | null
}

export default defineComponent({
    components: {},
    watch: {
        input() {},
    },
    data: () => ({
        instances: [] as Instance[],
        overflow_left: [] as boolean[],
        focused: false,
    }),
    mounted() {
        this.start()
    },
    computed: {
        tapes(): [string, number][] {
            const selected = this.selected_instance
            return selected?.conf.tapes ?? []
        },
        selected_instance(): Instance | null {
            const instances = this.instances.filter((inst) => inst.selected)
            if (instances.length != 1) return null

            return instances[0]
        },
    },
    methods: {
        instanceStatus(inst: Instance): string | null {
            if (!inst.selected) return null
            if (inst.accepted !== null)
                return inst.accepted ? "accepted" : "rejected"
            return "selected"
        },
        tapeStyle(i: number, tape: string, pos: number) {
            return {
                left: `calc(50% - 1.2rem + 2.2rem*${-pos})`,
            }
        },

        container_keydown(ev: KeyboardEvent) {
            if (ev.key === " ") {
                this.step()
                return
            }
        },

        close() {
            this.$emit("close")
        },

        start() {
            if (!this.automaton || this.input === null) return

            const container = this.$refs.container as HTMLDivElement | undefined
            if (container) {
                container.focus()
            }

            while (this.instances.length) this.instances.pop()

            const conf = this.automaton.initial_configuration(this.input)
            this.instances.push({
                conf,
                next_confs: this.automaton.step(conf),
                transitions: this.automaton.step_transition(conf),
                accepted: null,
                selected: true,
            })

            console.log("started", [...this.instances])
            this.$emit("updated-state", [...this.instances])
        },

        step() {
            if (!this.automaton) return

            const prev_instance = this.selected_instance

            for (let i = this.instances.length - 1; i >= 0; i--) {
                const instance = this.instances[i]
                if (!instance.selected) continue

                if (instance.accepted !== null) {
                    this.instances.splice(i, 1)
                    continue
                }
                if (!instance.next_confs.length) {
                    instance.accepted = instance.conf.accepted
                    continue
                }

                const automaton = this.automaton
                const new_instances = instance.next_confs.map((conf) => ({
                    conf,
                    next_confs: automaton.step(conf),
                    transitions: automaton.step_transition(conf),
                    selected: false,
                    accepted: conf.accepted ? true : null,
                }))

                const [next, ...remaining] = new_instances
                this.instances.splice(i, 1, next)
                this.instances.push(...remaining)
            }

            if (!this.instances.length) {
                this.$emit("updated-state", [])
                this.close()
                return
            }

            let instance = this.selected_instance
            if (!instance) {
                instance = this.instances[0]
                instance.selected = true
            }

            this.$emit("updated-state", [...this.instances])

            // the tape transition does not work properly when the tape is extended
            // to the left. this manually detects this edge case and switches the
            // animation to a keyframed animation.
            this.overflow_left = []
            const conf = prev_instance?.conf
            if (conf) {
                const next_conf = instance.conf
                for (const [a, b] of zip(conf.tapes, next_conf.tapes)) {
                    const overflowed = a[0].length < b[0].length && b[1] === 0
                    this.overflow_left.push(overflowed ? true : false)
                }
            }
        },
    },
})
</script>

<style scoped>
.container {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
    overflow-x: hidden;

    color: var(--white);
    background: var(--background-13);
}
.container:focus {
    outline: none;
}
.container > * {
    flex-shrink: 0;
}

.container > .top {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 1rem;
}
.configurations-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
}
.configurations {
    display: flex;
    flex-direction: row;
    justify-content: start;
    gap: 0.75rem;
    overflow: scroll;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
}
.configuration {
    flex-shrink: 0;
    display: block;
    min-width: 6rem;
    height: 5rem;
    padding: 0.25rem;

    border-radius: 0.25rem;
    background: var(--background-20);
    text-align: center;
    font-size: 1.25em;
}
.configuration.selected {
    border: 0.25rem solid var(--detail-yellow);
}
.configuration.rejected {
    border: 0.25rem solid var(--detail-red);
}
.configuration.accepted {
    border: 0.25rem solid var(--detail-green);
}
button.close {
    font-weight: 800;
}

.tapes {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.tape-track {
    width: 100%;
    height: 2rem;
    position: relative;
}
.tape-track.unbounded {
    background: var(--lighter-white);
}
.tape-track::after {
    content: "^";
    position: relative;
    left: calc(50% - 0.5rem);
    bottom: -1.4rem;

    color: var(--detail-green);
    font-size: 1.5rem;
    font-weight: 800;
}

@keyframes tape_overflow_left {
    from {
        left: calc(50% - 1.2rem - 2.2rem);
    }
    to {
        left: calc(50% - 1.2rem);
    }
}

.tape {
    display: flex;
    position: absolute;
    background: var(--background-13);
    transition: left 0.15s;
}
.tape.overflow_left {
    animation-name: tape_overflow_left;
    animation-duration: 0.15s;
}
.tape > span {
    display: inline-block;
    width: 2rem;
    height: 2rem;
    padding: 0;
    background: var(--lighter-white);
    margin-right: 0.2rem;

    text-align: center;
    line-height: 2rem;
    color: var(--black);
    font-weight: 500;
    font-size: 1.25rem;
}
.tape > span:first-child {
    margin-left: 0.2rem;
}

.shortcut_label {
    font-size: 0.75em;
    color: var(--detail-green);
}
</style>
