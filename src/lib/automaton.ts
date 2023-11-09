
export class ComputationError extends Error {}

export function is_iterable(obj: any): obj is Iterable<any> {
    if (obj == null) {
        return false;
    }
    return typeof obj[Symbol.iterator] === 'function';
}

export function has_intersection<T>(a: Set<T>, b: Set<T> ): boolean {
    for (const value of a) {
        if (b.has(value)) return true;
    }
    return false;
}

export function extend<T>(container: T[] | Set<T>, values: Iterable<T>) {
    if (container instanceof Array) {
        for (const value of values) {
            container.push(value);
        }
    }
    else {
        for (const value of values) {
            container.add(value);
        }
    }
}

// export function equal(a: any, b: any): boolean {
//     if (a instanceof Array) {
//         if (!(b instanceof Array)) return false;
//         if (a.length !== b.length) return false;
//         return a.every((v, i) => equal(v, b[i]));
//     }
//     if (a instanceof Object) {
//         const a_keys = Object.keys(a);
//         const b_keys = Object.keys(b);
//         for (const key of a_keys) {

//         }
//     }

//     return a === b;
// }


export const Epsilon = "";

export type State = string;

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
    const i = state.lastIndexOf(".");

    if (i >= 1) {
        const num = state.slice(i+1);
        if (num.match(/\d+/)) {
            return [state.slice(0, i), parseInt(num)];
        }
    }

    return [state, 0];
}

export function join_state_version(name: string, version: number) {
    return name + "." + version.toString();
}


export function split_state_set(state: State) {
    return new Set(state.split(","));
}

export function join_state_set(states: Set<State>) {
    return Array.from(states).sort().join(",");
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
export function make_state_conversion_map(base: Iterable<State>, target: Iterable<State>) {
    const visited = new Set(base);
    const state_map: {[key: string]: string} = {};

    for (const state of target) {
        if (!visited.has(state)) {
            state_map[state] = state;
            visited.add(state);
            continue;
        }
        let [name, version] = split_state_version(state);
        while (true) {
            version++;
            const new_state = join_state_version(name, version);
            if (!visited.has(new_state)) {
                state_map[state] = new_state;
                visited.add(new_state);
                break;
            }
        }
    }
    return state_map;
}


export type FiniteTransition = [State, string, State];
export type FiniteTransitionMap = {[state: string]: {[symbol: string]: State | Set<State>}}

export class FiniteAutomaton {
    states: Set<State>;
    alphabet: Set<string>;
    transition_map: FiniteTransitionMap;
    initial_state: State;
    final_states: Set<State>;

    static get_transition_map(transitions: Iterable<FiniteTransition>): FiniteTransitionMap {
        const map: FiniteTransitionMap = {};
    
        for (let transition of transitions) {
            const [start, symbol, end] = transition;
    
            if (!map[start]) {
                map[start] = {};
            }
            const symbol_map = map[start];
            const end_state = symbol_map[symbol];
    
            if (end_state === end) continue;
    
            if (end_state instanceof Set) {
                end_state.add(symbol)
            }
            else if (!end_state) {
                symbol_map[symbol] = end;
            }
            else {
                symbol_map[symbol] = new Set([end_state, end])
            }
        }
    
        return map;
    }
    
    static* get_transitions(map: FiniteTransitionMap): Generator<FiniteTransition> {
        for (const [start_state, symbol_map] of Object.entries(map)) {
            for (const [symbol, end_states] of Object.entries(symbol_map)) {
                if (end_states instanceof Set) {
                    for (const state of end_states) {
                        yield [start_state, symbol, state];
                    }
                    continue;
                }
                yield [start_state, symbol, end_states];
            }
        }
    }
    
    static get_alphabet(transitions: FiniteTransition[] | FiniteTransitionMap): Set<string> {
        if (transitions instanceof Array) {
            transitions = this.get_transition_map(transitions);
        }
    
        const alphabet = new Set<string>();
    
        for (const symbol_map of Object.values(transitions)) {
            for (const symbol of Object.keys(symbol_map)) {
                if (symbol === Epsilon) continue;
                alphabet.add(symbol);
            }
        }
    
        return alphabet;
    }
    
    static get_states(transitions: FiniteTransition[] | FiniteTransitionMap): Set<State> {
        if (transitions instanceof Array) {
            transitions = this.get_transition_map(transitions);
        }
    
        const states = new Set<string>();
    
        for (const [start_state, symbol_map] of Object.entries(transitions)) {
            states.add(start_state);
    
            for (const end_state of Object.values(symbol_map)) {
                if (end_state instanceof Set) {
                    for (const state of end_state) {
                        states.add(state);
                    }
                    continue;
                }
    
                states.add(end_state);
            }
        }
    
        return states;
    }
    

    constructor(
        transitions: Iterable<FiniteTransition>,
        initial_state: State,
        final_states: Set<State> | State[] | null = null,
        states: Set<State> | State[] | null = null,
        alphabet: Set<string> | string[] | null = null,
    ) {
        if (final_states instanceof Array) {
            final_states = new Set(final_states);
        }
        if (states instanceof Array) {
            states = new Set(states);
        }
        if (alphabet instanceof Array) {
            alphabet = new Set(alphabet);
        }

        this.transition_map = FiniteAutomaton.get_transition_map(transitions);
        this.initial_state = initial_state;
        this.final_states = final_states ? final_states : new Set();
        this.states = states ? states : FiniteAutomaton.get_states(this.transition_map);
        this.alphabet = alphabet ? alphabet : FiniteAutomaton.get_alphabet(this.transition_map);
    }

    transition(state: State, symbol: string | null): Set<string> | undefined {
        const symbol_map = this.transition_map[state];
        if (!symbol_map) return;

        let states: State[] = [];

        if (symbol !== null) {
            const end_states = symbol_map[symbol];
            if (typeof end_states === "string") states = [end_states];
            else if (end_states) states = [...end_states];
        }
        else {
            const values = Object.values(symbol_map);
            for (const value of values) {
                if (typeof value === "string") states.push(value);
                else states = [...states, ...value];
            }
        }
        if (!states.length) return;

        return new Set(states);
    }

    *traverse_transition_map(): Generator<[State, string, State | Set<State>]> {
        for (const [start_state, symbol_map] of Object.entries(this.transition_map)) {
            for (const [symbol, end_states] of Object.entries(symbol_map)) {
                yield [start_state, symbol, end_states];
            }
        }

    }

    *traverse_transitions(): Generator<FiniteTransition> {
        yield* FiniteAutomaton.get_transitions(this.transition_map);
    }
    
    is_deterministic() {
        for (const [_, symbol, end_states] of this.traverse_transition_map()) {
            if (symbol === Epsilon) {
                return false;
            }
            if (end_states instanceof Set && end_states.size > 1) {
                return false;
            }
        }
        return true;
    }

    get_reachable(origin: State, symbol: string | null = null) {
        const reached = [];
        const queue = [origin];
    
        while (queue.length) {
            const state = queue.shift() as string;
            reached.push(state);
    
            const end_states = this.transition(state, symbol)
            if (!end_states) continue;
    
            for (const end_state of end_states) {
                if (!reached.includes(end_state) && !queue.includes(end_state)) {
                    queue.push(end_state);
                }
            }
        }

        return reached;
    }

    compute_closure(symbol: string | null = null) {
        const closure: {[state: State]: Set<State>} = {};

        for (const originState of this.states) {
            const reached = this.get_reachable(originState, symbol);
            closure[originState] = new Set(reached);
        }

        return closure;
    }

    determinize() {
        const epsilon_closure = this.compute_closure(Epsilon);
        const initial_state = join_state_set(epsilon_closure[this.initial_state]);
        const transitions: FiniteTransitionMap = {};
        const final_states: Set<State> = new Set();
        
        const remaining: State[] = [initial_state];

        while (remaining.length) {
            const state_name = remaining.shift() as State;

            if (transitions[state_name]) continue;
            transitions[state_name] = {};

            const state_set = split_state_set(state_name);

            for (const symbol of this.alphabet) {
                const end_state_set: Set<State> = new Set();

                for (const state of state_set) {
                    const end_states = this.transition(state, symbol);
                    if (!end_states) continue;

                    for (const end_state of end_states) {
                        for (const closed_end_state of epsilon_closure[end_state]) {
                            end_state_set.add(closed_end_state);
                        }
                    }
                }

                if (!end_state_set.size) continue;
                const end_state_name = join_state_set(end_state_set);

                transitions[state_name][symbol] = end_state_name;

                if (!remaining.includes(end_state_name) && !transitions[end_state_name]) {
                    remaining.push(end_state_name);
                }
            }

            if (has_intersection(this.final_states, state_set)) {
                final_states.add(state_name);
            }
        }

        return new FiniteAutomaton(
            FiniteAutomaton.get_transitions(transitions),
            initial_state,
            final_states,
            null,
            this.alphabet
        );
    }

    union(automaton: FiniteAutomaton): FiniteAutomaton {
        const {u} = make_state_conversion_map(this.states, ["u"]);
        const state_map = make_state_conversion_map([...this.states, u], automaton.states);

        const states = [
            ...this.states,
            ...Array.from(automaton.states, s => state_map[s]),
            u
        ]

        const automaton_transitions: FiniteTransition[] = Array.from(
            automaton.traverse_transitions(),
            ([start, symbol, end]) => [state_map[start], symbol, state_map[end]]
        );
        const transitions: FiniteTransition[] = [
            ...this.traverse_transitions(),
            ...automaton_transitions,
            [u, Epsilon, this.initial_state],
            [u, Epsilon, state_map[automaton.initial_state]],
        ];

        const final = [
            ...this.final_states,
            ...Array.from(automaton.final_states, s => state_map[s])
        ];
        const alphabet = [...this.alphabet, ...automaton.alphabet];

        return new FiniteAutomaton(transitions, u, final, states, alphabet);
    }

    complement() {
        const final = new Set(this.states);
        for (const state of this.final_states) {
            final.delete(state);
        }
        return new FiniteAutomaton(this.traverse_transitions(), this.initial_state, final, this.states, this.alphabet);
    }

    intersection(automaton: FiniteAutomaton) {
        const result = this.union(automaton).determinize();

        const final_states_union = new Set([...this.final_states, ...automaton.final_states]);

        const final_states: Set<State> = new Set();
        for (let state of result.states) {
            const state_set = split_state_set(state);

            if (Array.from(state_set).every(s => final_states_union.has(s))) {
                final_states.add(state);
            }
        }

        return new FiniteAutomaton(
            result.traverse_transitions(),
            result.initial_state,
            final_states,
            result.states,
            result.alphabet,
        );
    }

    renumerate(names: Iterable<string>) {
        const ordered_states = this.get_reachable(this.initial_state);
        const name_map: {[name: string]: string} = {};

        if (ordered_states.length) {
            for (const name of names) {
                if (!ordered_states.length) break;
                name_map[ordered_states[0]] = name;
                ordered_states.shift();
            }
        }

        const states = Array.from(this.states, s => name_map[s]);
        const transitions: FiniteTransition[] = Array.from(
            this.traverse_transitions(),
            ([start, symbol, end]) => [name_map[start], symbol, name_map[end]]
        );
        const final = Array.from(this.final_states, s => name_map[s]);
        const initial = name_map[this.initial_state];

        return new FiniteAutomaton(transitions, initial, final, states, this.alphabet);
    }
}

export function format_transition_table(automaton: FiniteAutomaton) {
    const columns = [];
    
    const states = Array.from(automaton.states).sort();
    const alphabet = Array.from(automaton.alphabet).sort();

    const states_column = ["    δ"];
    for (const state of states) {
        let prefix = "";
        if (state === automaton.initial_state) prefix += "-> "; 
        if (automaton.final_states.has(state)) prefix += "*";

        const value = prefix.padStart(4, " ") + state;
        states_column.push(value);
    }
    columns.push(states_column);

    for (const symbol of [Epsilon, ...alphabet]) {
        const column = [symbol === Epsilon ? "ε" : symbol];

        for (const state of states) {
            const end_state = automaton.transition(state, symbol);
            const value = end_state ? join_state_set(end_state) : "-";
            column.push(value);
        }

        columns.push(column);
    }

    for (const column of columns) {
        const max_length = Math.max(...column.map(s => s.length));
        for (let i = 0; i < column.length; i++) {
            column[i] = column[i].padEnd(max_length, " ");
        }
    }

    const lines = [];
    for (let i = 0; i < columns[0].length; i++) {
        const line = columns.map(column => column[i]).join("   ");
        lines.push(line);
    }

    return lines.join("\n");
}


export type TuringShiftChar = ">" | "<" | "-";

export type TuringTransition = [State, string[], State, string[], TuringShiftChar[]];

export type TuringTransitionMapValue = {state: State, write_chars: string[], shift: TuringShiftChar[]};
export type TuringTransitionSymbolMap = {
    [read_chars: string]: TuringTransitionMapValue | TuringTransitionMapValue[]
};
export type TuringTransitionMapObject = {[state: State]: TuringTransitionSymbolMap};


export class TuringTransitionMap {
    map: TuringTransitionMapObject;

    match_values(a: TuringTransitionMapValue, b:  TuringTransitionMapValue) {
        return (
            // match state
            a.state === b.state &&
            // match write_chars array
            a.write_chars.length === b.write_chars.length &&
            a.write_chars.every((v, i) => v === b.write_chars[i]) &&
            // match shift array
            a.shift.length === b.shift.length &&
            a.shift.every((v, i) => v === b.shift[i])
        );
    }

    has_value(values: Iterable<TuringTransitionMapValue>, value: TuringTransitionMapValue) {
        for (const element of values) {
            if (this.match_values(element, value)) return true;
        }
        return false;
    }

    constructor(transitions: Iterable<TuringTransition>) {
        const map: TuringTransitionMapObject = {}

        for (const [start, read_chars, state, write_chars, shift] of transitions) {
            if (!map[start]) map[start] = {};
            const symbol_map = map[start];
            
            const key = JSON.stringify(read_chars);

            const end_value = symbol_map[key]
            const value = {state, write_chars, shift};
    
            if (end_value instanceof Array) {
                if (this.has_value(end_value, value)) continue;
                end_value.push(value);
            }
            else if (!end_value) {
                symbol_map[key] = value;
            }
            else {
                const values = this.match_values(end_value, value) ? end_value : [end_value, value];
                symbol_map[key] = values
            }

        }

        this.map = map;
    }

    get(state: string): TuringTransitionSymbolMap | undefined;
    get(state: string, read_chars: string[]
    ): TuringTransitionMapValue[];
    get(state: string, read_chars: string[] | null = null
    ): TuringTransitionSymbolMap | TuringTransitionMapValue[] | undefined {
        const symbol_map = this.map[state];
        if (read_chars === null) return symbol_map;

        const transitions: TuringTransitionMapValue[] = [];
        for (let [key, value] of Object.entries(symbol_map)) {
            const pattern = JSON.parse(key);

            let match = true;
            for (let i = 0; i < pattern.length; i++) {
                if (pattern[i] && read_chars[i] && pattern[i] !== read_chars[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                const values = value instanceof Array ? value : [value];
                for (const v of values) {
                    transitions.push(v);
                }
            }
        }
        
        return transitions;
    }

    *traverse(): Generator<
        [string, string[], TuringTransitionMapValue | TuringTransitionMapValue[]]
    > {
        for (const [state, symbol_map] of Object.entries(this.map)) {
            for (let [key, end_value] of Object.entries(symbol_map)) {
                const read_chars = JSON.parse(key);
                yield [state, read_chars, end_value]
            }
        }
    }

    *transitions(): Generator<TuringTransition> {
        for (const [start, read_chars, end_value] of this.traverse()) {
            if (end_value instanceof Array) {
                for (const {state, write_chars, shift} of end_value) {
                    yield [start, read_chars, state, write_chars, shift];
                }
            }
            else {
                const {state, write_chars, shift} = end_value;
                yield [start, read_chars, state, write_chars, shift];
            }
        }
    }

    tape_amount() {
        const [symbol_map, ..._] = Object.values(this.map);
        const [key, ...__] = Object.keys(symbol_map);

        const read_chars = JSON.parse(key);

        return read_chars.length;
    }

    alphabet(): Set<string> {
        const alphabet = new Set<string>();
    
        for (const symbol_map of Object.values(this.map)) {
            for (const [key, end_value] of Object.entries(symbol_map)) {
                const chars: string[] = JSON.parse(key);

                if (end_value instanceof Array) {
                    end_value.forEach(v => extend(chars, v.write_chars));
                }
                else {
                    extend(chars, end_value.write_chars);
                }

                for (const char of chars) {
                    if (char === Epsilon) continue;
                    alphabet.add(char);
                }

            }
        }
    
        return alphabet;
    }
    
    states(): Set<State> {
        const states = new Set<string>();
    
        for (const [start, symbol_map] of Object.entries(this.map)) {
            states.add(start);

            for (const [_, end_value] of Object.entries(symbol_map)) {
                if (end_value instanceof Array) {
                    extend(states, end_value.map(v => v.state));
                }
                else {
                    states.add(end_value.state);
                }
            }
        }
    
        return states;
    }
}


export type TuringTapeState = [string, number];
export type TuringConfiguration = [State, TuringTapeState[]];

export class TuringTape {
    value: string;
    pos: number; 

    constructor(value: string = "", pos: number = 0) {
        this.value = value;
        this.pos = pos;
    }

    shift_left(amount: number = 1) {
        this.shift(-amount);
    }
    shift_right(amount: number = 1) {
        this.shift(amount);
    }
    shift(amount: number) {
        this.pos += amount;

        if (this.pos < 0) {
            this.extend_left(Math.abs(this.pos));
        }
        if (this.pos >= this.value.length) {
            this.extend_right(this.pos - this.value.length + 1);
        }
    }

    extend_left(amount: number) {
        this.value = " ".repeat(amount) + this.value;
        this.pos += amount;
    }
    extend_right(amount: number) {
        this.value = this.value + " ".repeat(amount);
    }

    read() {
        if (!this.value.length) return " ";

        return this.value[this.pos];
    }

    write(char: string) {
        this.value = this.value.slice(0, this.pos) + char + this.value.slice(this.pos+1);
    }
}


export class TuringMachine {
    states: Set<State>;
    alphabet: Set<string>;
    transition_map: TuringTransitionMap;
    initial_state: State;
    final_states: Set<State>;
    tapes: string[];

    constructor(
        transitions: Iterable<TuringTransition>,
        initial_state: State,
        final_states: Set<State> | State[] | null = null,
        tapes: string[] | null = null,
        states: Set<State> | State[] | null = null,
        alphabet: Set<string> | string[] | null = null,
    ) {
        if (final_states instanceof Array) {
            final_states = new Set(final_states);
        }
        if (states instanceof Array) {
            states = new Set(states);
        }
        if (alphabet instanceof Array) {
            alphabet = new Set(alphabet);
        }

        this.transition_map = new TuringTransitionMap(transitions);
        this.initial_state = initial_state;
        this.final_states = final_states ? final_states : new Set();
        this.states = states ? states : this.transition_map.states();
        this.alphabet = alphabet ? alphabet : this.transition_map.alphabet();

        if (!tapes) {
            const length = this.transition_map.tape_amount();
            tapes = Array.from(new Array(length), (_, i) => String.fromCharCode(65 + i));
        }
        this.tapes = tapes;
    }
    
    is_deterministic() {
        for (const [_, read_chars, end_value] of this.transition_map.traverse()) {
            // still needs to check for Epsilon

            if (end_value instanceof Array && end_value.length > 1) {
                return false;
            }
        }
        return true;
    }

    get_reachable(origin: State) {
        const reached = [];
        const queue = [origin];
    
        while (queue.length) {
            const state = queue.shift() as string;
            reached.push(state);
    
            const symbol_map = this.transition_map.get(state)
            if (!symbol_map) continue;

            for (let end_value of Object.values(symbol_map)) {
                if (!(end_value instanceof Array)) end_value = [end_value];

                for (const {state} of end_value) {
                    if (!reached.includes(state) && !queue.includes(state)) {
                        queue.push(state);
                    }
                }
            }
    
        }

        return reached;
    }

    union(other: TuringMachine): TuringMachine {
        if (this.tapes.length !== other.tapes.length) throw new Error(
            `Cannot make union of turing machines of different tape amount.`
        );

        const {u} = make_state_conversion_map(this.states, ["u"]);
        const state_map = make_state_conversion_map([...this.states, u], other.states);

        const states = [
            ...this.states,
            ...Array.from(other.states, s => state_map[s]),
            u
        ]

        const other_transitions: TuringTransition[] = Array.from(
            other.transition_map.transitions(),
            ([start, read_chars, end, write_chars, shift]) => [
                state_map[start], read_chars, state_map[end], write_chars, shift
            ]
        );
        const epsilon = Array.from(new Array(this.tapes.length), () => Epsilon);
        const shift: TuringShiftChar[] = Array.from(new Array(this.tapes.length), () => "-");
        const transitions: TuringTransition[] = [
            ...this.transition_map.transitions(),
            ...other_transitions,
            [u, epsilon, this.initial_state, epsilon, shift],
            [u, epsilon, state_map[other.initial_state], epsilon, shift],
        ];

        const final = [
            ...this.final_states,
            ...Array.from(other.final_states, s => state_map[s])
        ];
        const alphabet = [...this.alphabet, ...other.alphabet];

        return new TuringMachine(transitions, u, final, this.tapes, states, alphabet);
    }

    renumerate(names: Iterable<string>) {
        const ordered_states = this.get_reachable(this.initial_state);
        const name_map: {[name: string]: string} = {};

        if (ordered_states.length) {
            for (const name of names) {
                if (!ordered_states.length) break;
                name_map[ordered_states[0]] = name;
                ordered_states.shift();
            }
        }

        const states = Array.from(this.states, s => name_map[s]);
        const transitions: TuringTransition[] = Array.from(
            this.transition_map.transitions(),
            ([start, read_chars, end, write_chars, shift]) => [
                name_map[start], read_chars, name_map[end], write_chars, shift
            ]
        );
        const final = Array.from(this.final_states, s => name_map[s]);
        const initial = name_map[this.initial_state];

        return new TuringMachine(
            transitions,
            initial,
            final,
            this.tapes,
            states,
            this.alphabet
        );
    }

    *compute(input: string): Generator<TuringConfiguration> {
        const input_tape = new TuringTape(input);
        const tapes = [
            input_tape,
            ...Array.from(new Array(this.tapes.length - 1), () => new TuringTape())
        ];

        let state = this.initial_state;

        const shift_number = {
            ">": 1,
            "<": -1,
            "-": 0,
        };

        while (true) {
            yield [state, tapes.map(t => [t.value, t.pos])];

            if (this.final_states.has(state)) {
                break;
            };

            const read_chars = tapes.map(tape => tape.read());
            const transitions = this.transition_map.get(state, read_chars)

            if (!transitions.length) break;

            if (transitions.length > 1) throw new ComputationError("Unsupported deterministic computation.");

            const transition = transitions[0];

            state = transition.state;
            for (let i = 0; i < tapes.length; i++ ) {
                const tape = tapes[i];
                const write_char = transition.write_chars[i];
                const shift = transition.shift[i];

                if (write_char) tape.write(write_char);
                tape.shift(shift_number[shift]);
            }
        }
    }

    test(input: string) {
        for (const [state, _] of this.compute(input)) {
            if (this.final_states.has(state)) return true;
        }
        return false;
    }
}