
export function* zip<A, B>(a: A[], b: B[]): Generator<[A, B]> {
    const max_i = Math.min(a.length, b.length)
    for (let i = 0; i < max_i; i++) {
        yield [a[i], b[i]]
    }
}

export class ComputationError extends Error {}

export function is_iterable(obj: any): obj is Iterable<any> {
    if (obj == null) {
        return false
    }
    return typeof obj[Symbol.iterator] === "function"
}

export function has_intersection<T>(a: Set<T>, b: Set<T>): boolean {
    for (const value of a) {
        if (b.has(value)) return true
    }
    return false
}
export function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
    const result: Set<T> = new Set()

    for (const value of a) {
        if (b.has(value)) {
            result.add(value)
        }
    }
    
    return result
}

export function extend<T>(container: T[] | Set<T>, values: Iterable<T>) {
    if (container instanceof Array) {
        for (const value of values) {
            container.push(value)
        }
    } else {
        for (const value of values) {
            container.add(value)
        }
    }
}

export type JsonValue =
    | null
    | boolean
    | number
    | string
    | { [key: string]: JsonValue }
    | JsonValue[]

export function json_equal(a: JsonValue, b: JsonValue): boolean {
    if (a instanceof Array) {
        if (!(b instanceof Array)) return false
        if (a.length !== b.length) return false
        return a.every((v, i) => json_equal(v, b[i]))
    }
    if (a instanceof Object) {
        if (!(b instanceof Object) || b instanceof Array) return false

        const a_keys = Object.keys(a)
        const b_keys = Object.keys(b)
        if (a_keys.length != b_keys.length) return false

        for (const key of a_keys) {
            if (!json_equal(a[key], b[key])) return false
        }
        return true
    }

    return a === b
}

export function json_contains(values: Iterable<JsonValue>, value: JsonValue) {
    for (const element of values) {
        if (json_equal(element, value)) return true
    }
    return false
}

export const Epsilon = ""
export const Blank = " "

export type State = string

/**
 * Splits the name of a state containing a numeric version in the
 * format `<name>.<version>`.
 *
 * ```
 * split_state_version("q1.3")
 * // ["q1", 3]
 * split_state_version("no")
 * // ["no", 0]
 * split_state_version("dotted.name.4")
 * // ["dotted.name", 4]
 * split_state_version(".weird")
 * // [".weird", 0]
 * ```
 *
 * @param state
 * @returns A tuple containing the state name and version.
 */
export function split_state_version(state: State): [string, number] {
    const i = state.lastIndexOf(".")

    if (i >= 1) {
        const num = state.slice(i + 1)
        if (num.match(/\d+/)) {
            return [state.slice(0, i), parseInt(num)]
        }
    }

    return [state, 0]
}

export function join_state_version(name: string, version: number) {
    return name + "." + version.toString()
}

export function split_state_set(state: State): Set<State> {
    const states: string[] = []
    let i = 0

    while (state[i]) {
        const p = state[i]

        if (p === "(") {
            let paren_level = 1
            let value = ""
            i++ // (

            while (state[i]) {
                if (state[i] === "(") paren_level++
                if (state[i] === ")") paren_level--

                if (!paren_level) break

                value += state[i]
                i++
            }
            states.push(value)

            i++ // )
            continue
        }

        if (p === ",") {
            i++
            continue
        }

        let value = ""
        while (state[i] && state[i] !== ",") {
            value += state[i]
            i++
        }
        states.push(value)
    }

    return new Set(states)
}

export function join_state_set(states: Iterable<State>, preserve_order: boolean = false) {
    const elements = Array.from(
        states, state => state.includes(",") ? "(" + state + ")" : state
    )

    if (!preserve_order) elements.sort()

    return elements.join(",")
}

/**
 * Makes a map to convert states in `target` that overlaps with any state in `base`. Overlapping
 * states will be mapped to states of same name but with an incremented version.
 *
 * ```
 * make_state_conversion_map(["a","b"], ["a","c"])
 * // {a:"a.1",c:"c"}
 * ```
 *
 * @param base Base states to check for overlap.
 * @param target States that will be mapped to avoid overlap.
 * @returns An object that maps the states in `target` to their respective non-overlapping names.
 */
export function make_state_conversion_map(
    base: Iterable<State>,
    target: Iterable<State>,
) {
    const visited = new Set(base)
    const state_map: { [key: string]: string } = {}

    for (const state of target) {
        if (!visited.has(state)) {
            state_map[state] = state
            visited.add(state)
            continue
        }
        let [name, version] = split_state_version(state)
        while (true) {
            version++
            const new_state = join_state_version(name, version)
            if (!visited.has(new_state)) {
                state_map[state] = new_state
                visited.add(new_state)
                break
            }
        }
    }
    return state_map
}

export type TapeState = [string, number]

export class Tape {
    value: string
    pos: number
    bounded: boolean

    constructor(value: string = "", pos: number = 0, bounded: boolean = false) {
        this.value = value
        this.pos = pos
        this.bounded = bounded
    }

    is_off_bound(): boolean {
        return this.pos < 0 || this.pos >= this.value.length
    }

    copy() {
        return new Tape(this.value, this.pos, this.bounded)
    }

    shift_left(amount: number = 1) {
        this.shift(-amount)
    }
    shift_right(amount: number = 1) {
        this.shift(amount)
    }
    shift(amount: number) {
        this.pos += amount

        if (this.bounded) {
            this.pos = Math.max(Math.min(this.value.length, this.pos), 0)
            return
        }

        if (this.pos < 0) {
            this.extend_left(Math.abs(this.pos))
        }
        if (this.pos >= this.value.length) {
            this.extend_right(this.pos - this.value.length + 1)
        }
    }

    extend_left(amount: number) {
        this.value = Blank.repeat(amount) + this.value
        this.pos += amount
    }
    extend_right(amount: number) {
        this.value = this.value + Blank.repeat(amount)
    }

    shrink_left(amount: number = 1) {
        this.value = this.value.slice(0, this.value.length - amount)

        this.pos = Math.min(this.pos, this.value.length - 1)
    }

    read(size: number = 1): string {
        if (!this.value.length) return Blank

        return this.value.slice(this.pos, this.pos + size)
    }

    write(char: string) {
        if (this.bounded && this.is_off_bound()) return

        this.value = this.value.slice(0, this.pos) + char + this.value.slice(this.pos + 1)
    }
}

export interface ConfigurationNode {
    state: State
    accepted: boolean
    tapes: TapeState[]
}

export type TransitionSymbol = string | string[]

export function match_read_pattern<R extends TransitionSymbol>(
    pattern: R,
    value: R,
    literal_epsilon: boolean = false,
) {
    if (!literal_epsilon && pattern === Epsilon) return true
    if (typeof pattern === "string") return pattern === value

    for (let i = 0; i < pattern.length; i++) {
        if (!literal_epsilon && pattern[i] === Epsilon) continue
        if (pattern[i] !== value[i]) return false
    }
    return true
}

export type TransitionMapValue<A extends JsonValue[]> = [State, ...A]

export type TransitionSymbolMap<A extends JsonValue[]> = {
    [read: string]: TransitionMapValue<A>[]
}
export type TransitionMapObject<A extends JsonValue[]> = {
    [state: State]: TransitionSymbolMap<A>
}

export type Transition<R extends TransitionSymbol, A extends JsonValue[]> = [
    State,
    R,
    State,
    ...A,
]

export abstract class StateMachine<R extends TransitionSymbol, A extends any[]> {
    initial_state: State
    final_states: Set<State>
    states: Set<State>
    alphabet: Set<string>
    tapes: string[]
    map: TransitionMapObject<A>
    bounded: boolean

    get_transition_map(transitions: Iterable<Transition<R, A>>) {
        const map: TransitionMapObject<A> = {}

        for (const [start, read, state, ...args] of transitions) {
            if (!map[start]) map[start] = {}
            const symbol_map = map[start]

            const key = this.encode_key(read)

            if (!symbol_map[key]) symbol_map[key] = []
            const end_value = symbol_map[key]

            const value: [string, ...A] = [state, ...args]
            if (!json_contains(end_value, value)) end_value.push(value)
        }

        return map
    }

    constructor(
        transitions: Iterable<Transition<R, A>>,
        initial_state: State,
        final_states: Set<State> | State[] = [],
        tapes: number | string[] = 1,
        states: Set<State> | State[] = [],
        alphabet: Set<string> | string[] = [],
        bounded: boolean = false,
    ) {
        this.map = this.get_transition_map(transitions)
        this.initial_state = initial_state
        this.final_states = new Set(final_states)
        this.tapes =
            tapes instanceof Array
                ? tapes
                : Array.from(new Array(tapes), (_, k) => k.toString())
        this.states = new Set([
            initial_state, ...final_states, ...states, ...this.transition_states()
        ])
        this.bounded = bounded

        const symbols = this.transition_alphabet()
        symbols.delete(Epsilon)
        symbols.delete(Blank)
        this.alphabet = new Set([...alphabet, ...symbols])
    }

    encode_key(read: R): string {
        return JSON.stringify(read)
    }

    decode_key(key: string): R
    decode_key(key: string, array: true): string[]
    decode_key(key: string, array: boolean = false): R | string[] {
        const value = JSON.parse(key)

        if (array && typeof value === "string") return [value]

        return value
    }

    abstract to_pattern(value: TransitionSymbol): R

    transition(state: string): TransitionSymbolMap<A> | undefined
    transition(state: string, read: null): TransitionSymbolMap<A> | undefined
    transition(state: string, read: R, literal?: boolean): Transition<R, A>[]
    transition(
        state: string,
        read: R | null = null,
        literal: boolean = false,
    ): TransitionSymbolMap<A> | Transition<R, A>[] | undefined {
        const symbol_map = this.map[state]
        if (read === null) return symbol_map

        if (!symbol_map) return []

        const transitions: Transition<R, A>[] = []
        for (let [key, values] of Object.entries(symbol_map)) {
            const pattern = this.decode_key(key)

            if (!match_read_pattern(pattern, read, literal)) continue

            for (const [end_state, ...args] of values) {
                transitions.push([state, pattern, end_state, ...args])
            }
        }

        return transitions
    }

    get_reachable(origin: State, symbol: R | null = null): State[] {
        const reached: State[] = [origin]
        const queue = [origin]

        while (queue.length) {
            const current_state = queue.shift() as State

            const map = this.transition(current_state)
            if (!map) continue

            for (const [key, values] of Object.entries(map)) {
                const pattern = this.decode_key(key)

                if (symbol !== null && !match_read_pattern(pattern, symbol)) continue

                for (const [state] of values) {
                    if (reached.includes(state)) continue

                    reached.push(state)
                    queue.push(state)
                }
            }
        }

        return reached
    }

    get_productive_states(): Set<State> {
        const result: State[] = []

        for (const state of this.states) {
            const reachable = this.get_reachable(state)

            if (reachable.some(state => this.final_states.has(state))) {
                result.push(state)
            }
        }

        return new Set(result)
    }

    compute_closure(symbol: R | null = null) {
        const closure: { [state: State]: Set<State> } = {}

        for (const originState of this.states) {
            const reached = this.get_reachable(originState, symbol)
            closure[originState] = new Set(reached)
        }

        return closure
    }

    has_transition(origin: State, destination: State, symbol: R | null = null): boolean {
        const symbol_map = this.transition(origin)

        if (!symbol_map) return false

        for (let [key, end_values] of Object.entries(symbol_map)) {
            const pattern = this.decode_key(key)

            if (symbol !== null && pattern !== symbol) continue

            const end_states = end_values.map(([state]) => state)
            if (end_states.includes(destination)) return true
        }

        return false
    }

    *traverse(): Generator<[State, R, TransitionMapValue<A>[]]> {
        for (const [state, symbol_map] of Object.entries(this.map)) {
            for (let [key, end_values] of Object.entries(symbol_map)) {
                const read = this.decode_key(key)
                yield [state, read, end_values]
            }
        }
    }

    *transitions(): Generator<Transition<R, A>> {
        for (const [start, read, end_values] of this.traverse()) {
            for (const [state, ...args] of end_values) {
                yield [start, read, state, ...args]
            }
        }
    }

    transition_alphabet(): Set<string> {
        const symbols: string[] = []

        for (const symbol_map of Object.values(this.map)) {
            for (const key of Object.keys(symbol_map)) {
                const read = this.decode_key(key)
                const read_symbols = read instanceof Array ? read : [read]
                // @ts-ignore
                symbols.push(...read_symbols)
            }
        }
        return new Set(symbols)
    }

    transition_states(): Set<State> {
        const states = new Set<string>()

        for (const [start, _, end_values] of this.traverse()) {
            states.add(start)
            extend(
                states,
                end_values.map(([state]) => state),
            )
        }
        return states
    }

    is_deterministic() {
        for (const state of this.states) {
            const transitions = this.transition(state)
            if (!transitions) continue

            const reads = Object.keys(transitions).map(key => this.decode_key(key, true))

            for (let i = 0; i < reads.length; i++) {
                for (let j = i + 1; j < reads.length; j++) {
                    const pairs = Array.from(zip(reads[i], reads[j]))

                    // for each pair of symbol arrays, check if none of the char pairs are exclusive.
                    // e.g ["a", ""] and ["b", ""] are exclusive because it's not possible to read
                    // "a" and "b" in the first tape at the same time.
                    if (!pairs.some(([a, b]) => (a && b && a !== b))) return false
                }
            }
        }

        for (const [_, symbol, end_values] of this.traverse()) {
            if (symbol === Epsilon) {
                return false
            }
            if (end_values.length > 1) {
                return false
            }
        }

        return true
    }

    initial_configuration(input: string): ConfigurationNode {
        const input_tape: TapeState = [input, 0]
        const extra_tapes: TapeState[] = this.tapes.slice(1).map(() => ["", 0])

        const state = this.initial_state
        const tapes = [input_tape, ...extra_tapes]
        return {
            state,
            accepted: this.is_acceptable(state, tapes),
            tapes,
        }
    }

    abstract apply_transition(transition: Transition<R, A>, tapes: Tape[]): void

    abstract is_acceptable(state: State, tapes: TapeState[]): boolean

    step_transition(node: ConfigurationNode): Transition<R, A>[] {
        const state = node.state
        const tapes = node.tapes.map(
            ([value, pos]) => new Tape(value, pos, this.bounded),
        )

        const max_read_length = Math.max(
            1,
            ...Array.from(this.alphabet, (str) => str.length),
        )

        let transitions: Transition<R, A>[] = []
        for (let size = max_read_length; size >= 1; size--) {
            const read_chars = tapes.map((t) => t.read(size))
            const read = this.to_pattern(read_chars)
            transitions.push(...this.transition(state, read))
        }

        return transitions
    }

    step(node: ConfigurationNode): ConfigurationNode[] {
        const tapes = node.tapes.map(
            ([value, pos]) => new Tape(value, pos, this.bounded),
        )

        const transitions = this.step_transition(node)
        const confs: ConfigurationNode[] = []

        for (const transition of transitions) {
            const new_tapes = tapes.map((t) => t.copy())
            this.apply_transition(transition, new_tapes)

            const new_state = transition[2]
            const tape_state: TapeState[] = new_tapes.map((t) => [t.value, t.pos])

            confs.push({
                state: new_state,
                accepted: this.is_acceptable(new_state, tape_state),
                tapes: tape_state,
            })
        }

        return confs
    }

    *compute(input: string): Generator<ConfigurationNode[]> {
        let confs: ConfigurationNode[] = [this.initial_configuration(input)]

        while (confs.length) {
            yield [...confs]

            const next_confs = []
            for (const conf of confs) {
                if (conf.accepted) continue

                next_confs.push(...this.step(conf))
            }
            confs = next_confs
        }
    }

    test(input: string) {
        for (const confs of this.compute(input)) {
            if (confs.some((conf) => conf.accepted)) return true
        }
        return false
    }

    abstract reenumerate(names: Iterable<string>): StateMachine<R, A>

    protected reenumerated_states(names: Iterable<string>) {
        const ordered_states = this.get_reachable(this.initial_state)
        const name_map: { [name: string]: string } = {}

        if (ordered_states.length) {
            for (const name of names) {
                if (!ordered_states.length) break
                name_map[ordered_states[0]] = name
                ordered_states.shift()
            }
        }

        const transitions: Transition<R, A>[] = Array.from(
            this.transitions(),
            ([start, symbol, end, ...args]) => [
                name_map[start],
                symbol,
                name_map[end],
                ...args,
            ],
        )
        const final = Array.from(this.final_states, (s) => name_map[s])
        const initial = name_map[this.initial_state]
        const states = Array.from(this.states, (s) => name_map[s])

        return { transitions, states, initial, final }
    }
}

export type FiniteTransition = Transition<string, []>
export type FiniteTransitionMap = {
    [state: string]: { [symbol: string]: Set<State> }
}

export class FiniteAutomaton extends StateMachine<string, []> {
    constructor(
        transitions: Iterable<FiniteTransition>,
        initial_state: State,
        final_states: Set<State> | State[] = [],
        states: Set<State> | State[] = [],
        alphabet: Set<string> | string[] = [],
    ) {
        super(transitions, initial_state, final_states, 1, states, alphabet, true)
    }

    to_pattern(value: TransitionSymbol): string {
        if (value instanceof Array) return value[0]
        return value
    }

    apply_transition(transition: FiniteTransition, tapes: Tape[]): void {
        const [_, read] = transition

        if (read === Epsilon) return

        for (const tape of tapes) {
            tape.shift(read.length)
        }
    }

    is_acceptable(state: string, tapes: TapeState[]): boolean {
        if (!this.final_states.has(state)) return false

        const [string, pos] = tapes[0]
        return pos >= string.length
    }

    determinize() {
        const epsilon_closure = this.compute_closure(Epsilon)
        const initial_state = join_state_set(epsilon_closure[this.initial_state])
        const transitions: FiniteTransition[] = []
        const final_states: Set<State> = new Set()

        const visited: Set<State> = new Set()
        const remaining: State[] = [initial_state]

        while (remaining.length) {
            const state_name = remaining.shift() as State

            if (visited.has(state_name)) continue
            visited.add(state_name)

            const state_set = split_state_set(state_name)

            for (const symbol of this.alphabet) {
                const end_state_set: Set<State> = new Set()

                for (const state of state_set) {
                    const end_values = this.transition(state, symbol, true)
                    if (!end_values.length) continue

                    for (const [_, __, end_state] of end_values) {
                        for (const closed_end_state of epsilon_closure[end_state]) {
                            end_state_set.add(closed_end_state)
                        }
                    }
                }

                if (!end_state_set.size) continue
                const end_state_name = join_state_set(end_state_set)

                const transition: FiniteTransition = [
                    state_name,
                    symbol,
                    end_state_name,
                ]
                transitions.push(transition)

                if (
                    !remaining.includes(end_state_name) &&
                    !visited.has(end_state_name)
                ) {
                    remaining.push(end_state_name)
                }
            }

            if (has_intersection(this.final_states, state_set)) {
                final_states.add(state_name)
            }
        }

        return new FiniteAutomaton(
            transitions,
            initial_state,
            final_states,
            [],
            this.alphabet,
        )
    }

    discard_useless_states() {
        const reachable_states = this.get_reachable(this.initial_state)
        const productive_states = this.get_productive_states()
    
        const unreachable_states = Array.from(this.states).filter(state => !reachable_states.includes(state))
        const dead_states = Array.from(this.states).filter(state => !productive_states.has(state))

        const discarded =  new Set([...unreachable_states, ...dead_states])

        const transitions = Array.from(this.transitions()).filter(
            ([start, _, end]) => !discarded.has(start) && !discarded.has(end)
        )
        const final_states = Array.from(this.final_states).filter(state => !discarded.has(state))
        const states = Array.from(this.states).filter(state => !discarded.has(state))

        return new FiniteAutomaton(
            transitions,
            this.initial_state,
            final_states,
            states,
            this.alphabet
        )
    }

    get_equivalent_states() {
        let classes: Set<State>[] = [
            new Set(Array.from(this.states).filter(state => !this.final_states.has(state))),
            new Set(this.final_states)
        ]
        while (true) {
            for (const symbol of this.alphabet) {

                let next_classes_map: {[key: string]: Set<State>} = {}

                for (const state of this.states) {
                    const transitions = this.transition(state, symbol)

                    let i = -1
                    if (transitions.length) {
                        const [_, __, end_state] = transitions[0]
                        i = classes.findIndex(cls => cls.has(end_state))
                    }

                    const is_final = this.final_states.has(state)
                    const key = `${i};${is_final}`

                    if (!next_classes_map[key]) next_classes_map[key] = new Set()
                    next_classes_map[key].add(state)
                }

                const next_classes = Object.values(next_classes_map)

                const classes_str = join_state_set(classes.map(set => join_state_set(set)))
                const next_classes_str = join_state_set(next_classes.map(set => join_state_set(set)))
                if (classes_str === next_classes_str) return classes

                classes = next_classes
            }
        }
    }

    is_minimum() {
        if (!this.is_deterministic()) return false

        const reachable_states = this.get_reachable(this.initial_state)
        if (reachable_states.length < this.states.size) return false

        const productive_states = this.get_productive_states()
        if (productive_states.size < this.states.size) return false

        const equivalent_states = this.get_equivalent_states()
        if (equivalent_states.length < this.states.size) return false

        return true
    }

    minimize(): FiniteAutomaton {
        let automaton: FiniteAutomaton = this

        if (!automaton.is_deterministic()) {
            automaton = automaton.determinize()
        }

        automaton = automaton.discard_useless_states()

        const equivalent_states = automaton.get_equivalent_states()
        const merged_states = equivalent_states.map(set => join_state_set(set))

        const state_map: {[state: State]: State} = {}
        for (const [merged_state, state_set] of zip(merged_states, equivalent_states)) {
            for (const state of state_set) {
                state_map[state] = merged_state
            }
        }

        const transitions: FiniteTransition[] = Array.from(
            automaton.transitions(),
            ([start, read, end]) => ([state_map[start], read, state_map[end]])
        )

        const initial_state = state_map[automaton.initial_state]
        const final_states = Array.from(automaton.final_states, state => state_map[state])

        return new FiniteAutomaton(
            transitions,
            initial_state,
            final_states,
            merged_states,
            automaton.alphabet
        )
    }

    union(automaton: FiniteAutomaton): FiniteAutomaton {
        const { u } = make_state_conversion_map(this.states, ["u"])
        const state_map = make_state_conversion_map(
            [...this.states, u],
            automaton.states,
        )

        const states = [
            ...this.states,
            ...Array.from(automaton.states, (s) => state_map[s]),
            u,
        ]

        const automaton_transitions: FiniteTransition[] = Array.from(
            automaton.transitions(),
            ([start, symbol, end]) => [state_map[start], symbol, state_map[end]],
        )
        const transitions: FiniteTransition[] = [
            ...this.transitions(),
            ...automaton_transitions,
            [u, Epsilon, this.initial_state],
            [u, Epsilon, state_map[automaton.initial_state]],
        ]

        const final = [
            ...this.final_states,
            ...Array.from(automaton.final_states, (s) => state_map[s]),
        ]
        const alphabet = [...this.alphabet, ...automaton.alphabet]

        return new FiniteAutomaton(transitions, u, final, states, alphabet)
    }

    concatenate(automaton: FiniteAutomaton) {
        const state_map = make_state_conversion_map(
            this.states, automaton.states,
        )
        
        const states = [
            ...this.states,
            ...Array.from(automaton.states, (s) => state_map[s])
        ]

        const automaton_transitions: FiniteTransition[] = Array.from(
            automaton.transitions(),
            ([start, symbol, end]) => [state_map[start], symbol, state_map[end]],
        )
        const forward_transitions = Array.from(
            this.final_states,
            final => [final, Epsilon, state_map[automaton.initial_state]] as FiniteTransition
        )
        const transitions: FiniteTransition[] = [
            ...this.transitions(),
            ...automaton_transitions,
            ...forward_transitions
        ]

        const final = Array.from(automaton.final_states, s => state_map[s])
        const alphabet = [...this.alphabet, ...automaton.alphabet]

        return new FiniteAutomaton(transitions, this.initial_state, final, states, alphabet)

    }

    complement() {
        // create a rejection state
        const { r } = make_state_conversion_map(this.states, ["r"])

        const new_transitions: FiniteTransition[] = []
        for (const origin of this.states) {
            for (const symbol of this.alphabet) {
                const trans = this.transition(origin, symbol)
                if (!trans.length) new_transitions.push([origin, symbol, r])
            }
        }

        const epsilon_closure = this.compute_closure(Epsilon)

        const states = [...this.states]
        const final_states = [
            ...Array.from(this.states).filter(state => (
                !has_intersection(this.final_states, epsilon_closure[state]))
            )
        ]

        // only add the rejection state if necessary
        if (new_transitions.length) {
            states.push(r)
            final_states.push(r)

            for (const symbol of this.alphabet) {
                new_transitions.push([r, symbol, r])
            }
        }

        return new FiniteAutomaton(
            [...this.transitions(), ...new_transitions],
            this.initial_state,
            final_states,
            states,
            this.alphabet,
        )
    }

    star() {
        const transitions: FiniteTransition[] = Array.from(
            this.final_states, origin => [origin, Epsilon, this.initial_state]
        )

        return new FiniteAutomaton(
            [...this.transitions(), ... transitions],
            this.initial_state,
            this.final_states,
            this.states,
            this.alphabet
        )
    }

    reverse() {
        const transitions: FiniteTransition[] = Array.from(
            this.transitions(),
            ([origin, symbol, dest]) => [dest, symbol, origin]
        )

        let initial: State
        let finals: State[] = [this.initial_state]

        if (this.final_states.size > 1) {
            const { i } = make_state_conversion_map(this.states, ["i"])

            initial = i

            for (const final of this.final_states) {
                transitions.push([initial, Epsilon, final])
            }
        }
        else if (this.final_states.size == 1) {
            initial = Array.from(this.final_states)[0]
        }
        else {
            // no final state
            initial = this.initial_state
            finals = []
        }

        return new FiniteAutomaton(
            transitions,
            initial,
            finals,
            [...this.states, initial],
            this.alphabet
        )
    }

    intersection(automaton: FiniteAutomaton) {    
        const initial_state: [string, string] = [this.initial_state, automaton.initial_state]
        const alphabet: string[] = Array.from(this.alphabet).filter(symbol => automaton.alphabet.has(symbol))

        const transitions: FiniteTransition[] = []
        const states: Set<string> = new Set()
        const remaining: [string, string][] = [initial_state]

        function add_transition(origin: [State, State], symbol: string, dest: [State, State]) {
            const origin_str = join_state_set(origin, true)
            const dest_str = join_state_set(dest, true)

            transitions.push([origin_str, symbol, dest_str])
            if (!states.has(dest_str)) remaining.push(dest)
        }
        
        while (remaining.length) {
            const origin = remaining.pop() as [string, string]
            const [origin_a, origin_b] = origin
            
            states.add(join_state_set(origin, true))

            for (const symbol of alphabet) {
                for (const [_, __, dest_a] of this.transition(origin_a, symbol, true)) {
                    for (const [_, __, dest_b] of automaton.transition(origin_b, symbol, true)) {
                        add_transition(origin, symbol, [dest_a, dest_b])
                    }
                }
            }

            for (const [_, __, dest_a] of this.transition(origin_a, "", true)) {
                add_transition(origin, "", [dest_a, origin_b])
            }
            for (const [_, __, dest_b] of automaton.transition(origin_b, "", true)) {
                add_transition(origin, "", [origin_a, dest_b])
            }
        }

        const final_states: Set<string> = new Set()
        for (const final_a of this.final_states) {
            for (const final_b of automaton.final_states) {
                const state = join_state_set([final_a, final_b], true)
                if (states.has(state)) final_states.add(state)
            }
        }

        return new FiniteAutomaton(
            transitions,
            join_state_set(initial_state, true),
            final_states,
            states,
            alphabet,
        )
    }

    reenumerate(names: Iterable<string>): FiniteAutomaton {
        const { transitions, initial, final, states } =
            this.reenumerated_states(names)
        return new FiniteAutomaton(
            transitions,
            initial,
            final,
            states,
            this.alphabet,
        )
    }
}

export function format_transition_table(automaton: FiniteAutomaton) {
    const columns = []

    const states = Array.from(automaton.states).sort()
    const alphabet = Array.from(automaton.alphabet).sort()

    const states_column = ["    δ"]
    for (const state of states) {
        let prefix = ""
        if (state === automaton.initial_state) prefix += "-> "
        if (automaton.final_states.has(state)) prefix += "*"

        const value = prefix.padStart(4, " ") + state
        states_column.push(value)
    }
    columns.push(states_column)

    for (const symbol of [Epsilon, ...alphabet]) {
        const column = [symbol === Epsilon ? "ε" : symbol]

        for (const state of states) {
            const end_values = automaton.transition(state, symbol)
            const end_states = end_values.map(([state]) => state)
            const value = end_states.length ? join_state_set(end_states) : "-"
            column.push(value)
        }

        columns.push(column)
    }

    for (const column of columns) {
        const max_length = Math.max(...column.map((s) => s.length))
        for (let i = 0; i < column.length; i++) {
            column[i] = column[i].padEnd(max_length, " ")
        }
    }

    const lines = []
    for (let i = 0; i < columns[0].length; i++) {
        const line = columns.map((column) => column[i]).join("   ")
        lines.push(line)
    }

    return lines.join("\n")
}


export type PushdownTransition = Transition<string[], [string[]]>
export type PushdownTransitionMapValue = TransitionMapValue<[string[]]>

export class PushdownAutomaton extends StateMachine<string[], [string[]]> {
    to_pattern(value: TransitionSymbol): string[] {
        if (value instanceof Array) return value
        return this.tapes.map(() => value)
    }

    apply_transition(transition: PushdownTransition, tapes: Tape[]): void {
        const [_, [read, ...pop_chars], ___, push_chars] = transition
        const [input, ...stacks] = tapes

        if (read) input.shift_right()

        for (let i = 0; i < stacks.length; i++) {
            const stack = stacks[i]
            const pop_char = pop_chars[i]
            const push_char = push_chars[i]

            if (pop_char) {
                stack.shrink_left()
            }
            if (push_char) {
                if (stack.read() !== Blank) stack.shift_right()
                if (stack.is_off_bound()) stack.extend_right(1)

                stack.write(push_char)
            }
        }
    }

    is_acceptable(state: string, tapes: TapeState[]): boolean {
        if (!this.final_states.has(state)) return false

        const [[input_tape, input_pos], ...stacks] = tapes

        if (input_pos < input_tape.length) return false

        for (const [tape, pos] of stacks) {
            if (tape[pos] && tape[pos] !== Blank) return false
        }

        return true
    }

    reenumerate(names: Iterable<string>): PushdownAutomaton {
        const { transitions, initial, final, states } =
            this.reenumerated_states(names)
        return new PushdownAutomaton(
            transitions,
            initial,
            final,
            this.tapes,
            states,
            this.alphabet,
        )
    }
}



export type TuringShiftChar = ">" | "<" | "-"
export type TuringTransition = Transition<string[], [string[], TuringShiftChar[]]>
export type TuringTransitionMapValue = TransitionMapValue<
    [string[], TuringShiftChar[]]
>

export const shift_number: { [ch: string]: number } = {
    ">": 1,
    "<": -1,
    "-": 0,
}

export class TuringMachine extends StateMachine<
    string[],
    [string[], TuringShiftChar[]]
> {
    to_pattern(value: TransitionSymbol): string[] {
        if (value instanceof Array) return value
        return this.tapes.map(() => value)
    }

    apply_transition(transition: TuringTransition, tapes: Tape[]): void {
        const [_, __, ___, write_chars, shift_chars] = transition

        for (let i = 0; i < tapes.length; i++) {
            const tape = tapes[i]
            const write_char = write_chars[i]
            const shift_char = shift_chars[i]

            if (write_char) tape.write(write_char)
            tape.shift(shift_number[shift_char])
        }
    }

    is_acceptable(state: string, _: TapeState[]): boolean {
        return this.final_states.has(state)
    }

    union(other: TuringMachine): TuringMachine {
        if (this.tapes.length !== other.tapes.length)
            throw new Error(
                `Cannot make union of turing machines of different tape amount.`,
            )

        const { u } = make_state_conversion_map(this.states, ["u"])
        const state_map = make_state_conversion_map(
            [...this.states, u],
            other.states,
        )

        const states = [
            ...this.states,
            ...Array.from(other.states, (s) => state_map[s]),
            u,
        ]

        const other_transitions: TuringTransition[] = Array.from(
            other.transitions(),
            ([start, read_chars, end, write_chars, shift]) => [
                state_map[start],
                read_chars,
                state_map[end],
                write_chars,
                shift,
            ],
        )
        const epsilon = Array.from(new Array(this.tapes.length), () => Epsilon)
        const shift: TuringShiftChar[] = Array.from(
            new Array(this.tapes.length),
            () => "-",
        )
        const transitions: TuringTransition[] = [
            ...this.transitions(),
            ...other_transitions,
            [u, epsilon, this.initial_state, epsilon, shift],
            [u, epsilon, state_map[other.initial_state], epsilon, shift],
        ]

        const final = [
            ...this.final_states,
            ...Array.from(other.final_states, (s) => state_map[s]),
        ]
        const alphabet = [...this.alphabet, ...other.alphabet]

        return new TuringMachine(transitions, u, final, this.tapes, states, alphabet)
    }

    reenumerate(names: Iterable<string>): TuringMachine {
        const { transitions, initial, final, states } =
            this.reenumerated_states(names)
        return new TuringMachine(
            transitions,
            initial,
            final,
            this.tapes,
            states,
            this.alphabet,
        )
    }
}
