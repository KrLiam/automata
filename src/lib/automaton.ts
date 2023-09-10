
export const Epsilon = "";

export type State = string;

export type TransitionTuple = [State, string, State];

export class Transition {
    start: State;
    symbol: string;
    end: State;

    constructor(start: State, symbol: string, end: State) {
        this.start = start;
        this.symbol = symbol;
        this.end = end;

        Object.freeze(this);
    }

    static from([start, symbol, end]: TransitionTuple | Transition): Transition {
        return new Transition(start, symbol, end);
    }

    [Symbol.iterator]() {
        return [this.start, this.symbol, this.end][Symbol.iterator]();
    }
}


export type TransitionMap = {[state: string]: {[symbol: string]: State | Set<State>}}

export function get_transition_map(transitions: (Transition|TransitionTuple)[]): TransitionMap {
    const map: TransitionMap = {};

    for (let transition of transitions) {
        if (transition instanceof Array) {
            transition = Transition.from(transition);
        }

        if (!map[transition.start]) {
            map[transition.start] = {};
        }
        const symbol_map = map[transition.start];
        const end_state = symbol_map[transition.symbol];

        if (end_state === transition.end) continue;

        if (end_state instanceof Set) {
            end_state.add(transition.symbol)
        }
        else if (!end_state) {
            symbol_map[transition.symbol] = transition.end;
        }
        else {
            symbol_map[transition.symbol] = new Set([end_state, transition.end])
        }
    }

    return map;
}

export function get_alphabet(transitions: (Transition|TransitionTuple)[] | TransitionMap): Set<string> {
    if (transitions instanceof Array) {
        transitions = get_transition_map(transitions);
    }

    const alphabet = new Set<string>();

    for (let symbol_map of Object.values(transitions)) {
        for (let symbol of Object.keys(symbol_map)) {
            alphabet.add(symbol);
        }
    }

    return alphabet;
}

export function get_states(transitions: (Transition|TransitionTuple)[] | TransitionMap): Set<State> {
    if (transitions instanceof Array) {
        transitions = get_transition_map(transitions);
    }

    const states = new Set<string>();

    for (let [start_state, symbol_map] of Object.entries(transitions)) {
        states.add(start_state);

        for (let end_state of Object.values(symbol_map)) {
            if (end_state instanceof Set) {
                for (let state of end_state) {
                    states.add(state);
                }
                continue;
            }

            states.add(end_state);
        }
    }

    return states;
}


export class FiniteAutomaton {
    states: Set<State>;
    alphabet: Set<string>;
    transition_map: TransitionMap;
    initial_state: State;
    final_states: Set<State>;

    constructor(
        transitions: (Transition|TransitionTuple)[] | TransitionMap,
        initial_state: State,
        final_states: Set<State> | State[] | null = null,
        states: Set<State> | State[] | null = null,
        alphabet: Set<string> | null = null,
    ) {
        if (transitions instanceof Array) {
            transitions = get_transition_map(transitions);
        }
        if (final_states instanceof Array) {
            final_states = new Set(final_states);
        }
        if (states instanceof Array) {
            states = new Set(states);
        }

        this.transition_map = transitions;
        this.initial_state = initial_state;
        this.final_states = final_states ? final_states : new Set();
        this.states = states ? states : get_states(transitions);
        this.alphabet = alphabet ? alphabet : get_alphabet(transitions);
    }

    *traverse_transition_map(): Generator<[State, string, State | Set<State>]> {
        for (let [start_state, symbol_map] of Object.entries(this.transition_map)) {
            for (let [symbol, end_states] of Object.entries(symbol_map)) {
                yield [start_state, symbol, end_states];
            }
        }

    }

    *traverse_transitions(): Generator<TransitionTuple> {
        for (let [start_state, symbol, end_states] of this.traverse_transition_map()) {
            if (end_states instanceof Set) {
                for (let state of end_states) {
                    yield [start_state, symbol, state];
                }
                continue;
            }
            yield [start_state, symbol, end_states];
        }
    }
    
    is_deterministic() {
        for (let [_, symbol, end_states] of this.traverse_transition_map()) {
            if (symbol === Epsilon) {
                return false;
            }
            if (end_states instanceof Set && end_states.size > 1) {
                return false;
            }
        }
        return true;
    }
}