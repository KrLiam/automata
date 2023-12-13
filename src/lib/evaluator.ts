import {
    AstChar,
    AstFinalState,
    AstFiniteAutomaton,
    AstIdentifier,
    AstInitialState,
    AstList,
    AstNode,
    AstPrint,
    AstRoot,
    AstTest,
    AstTransition,
    AstTuringCharList,
    AstTuringMachine,
    AstTuringNamedChar,
    AstTuringNamedShiftChar,
    AstTuringShiftChar,
    AstTuringShiftCharList,
    AstTuringTransition,
} from "./ast"
import {
    FiniteAutomaton,
    TuringMachine,
    type FiniteTransition,
    type TuringTransition,
    type TuringShiftChar,
} from "./automaton"
import { SourceLocation, set_location } from "./tokenstream"
import { Visitor, rule } from "./visitor"

export function type_name(value: any): string {
    const type = typeof value

    if (type !== "object") return type

    return Object.getPrototypeOf(value).constructor.name
}

export class EvaluationError extends Error {
    location: SourceLocation = SourceLocation.invalid
    endLocation: SourceLocation = SourceLocation.invalid
}

export class RedefinitionError extends EvaluationError {
    binding: Binding

    constructor(binding: Binding) {
        super(`Invalid redefinition of name '${binding.name}'.`)

        this.binding = binding
    }
}

export class PreDefinitionUsageError extends EvaluationError {
    binding: Binding

    constructor(binding: Binding) {
        super(`Name '${binding.name}' used before definition.`)

        this.binding = binding
    }
}

export class UndeclaredNameError extends EvaluationError {
    scope: Scope
    name: string

    constructor(scope: Scope, name: string) {
        super(`Name '${name}' is not declared.`)

        this.scope = scope
        this.name = name
    }
}

export class Binding {
    name: string
    defined: boolean = false
    value: any = null

    constructor(name: string) {
        this.name = name
    }

    define(value: any) {
        if (this.defined) throw new RedefinitionError(this)

        this.value = value
        this.defined = true
    }

    unwrap() {
        if (!this.defined) throw new PreDefinitionUsageError(this)
        return this.value
    }
}

export class Scope {
    parent: Scope | null
    bindings: { [name: string]: Binding }

    constructor(parent: Scope | null = null) {
        this.parent = parent
        this.bindings = {}
    }

    declare(name: string, value: any = undefined): Binding {
        let binding = this.bindings[name]

        if (!binding) {
            binding = new Binding(name)
            this.bindings[name] = binding
        }

        if (value !== undefined) {
            binding.define(value)
        }

        return binding
    }

    delete(name: string) {
        if (!this.is_declared(name)) return
        delete this.bindings[name]
    }

    provide<T>(values: { [name: string]: any }, callback: () => T): T {
        for (const [name, value] of Object.entries(values)) {
            this.declare(name, value)
        }

        let result
        try {
            result = callback()
        } finally {
            for (const name of Object.keys(values)) {
                this.delete(name)
            }
        }

        return result
    }

    value(name: string): any {
        const binding = this.bindings[name]
        if (!binding) {
            if (this.parent) return this.parent.value(name)
            throw new UndeclaredNameError(this, name)
        }

        return binding.unwrap()
    }

    is_declared(name: string, parent: boolean = false): boolean {
        const binding = this.bindings[name]
        if (!binding && parent && this.parent) {
            return this.parent.is_declared(name, parent)
        }

        return binding ? true : false
    }

    is_defined(name: string, parent: boolean = false): boolean {
        const binding = this.bindings[name]
        if (!binding) {
            if (parent && this.parent) return this.parent.is_declared(name, parent)
            return false
        }

        return binding.defined
    }

    *[Symbol.iterator]() {
        for (let [name, binding] of Object.entries(this.bindings)) {
            if (binding.defined && !name.startsWith("$")) {
                yield [name, binding.unwrap()]
            }
        }
    }
}

export type ObjectMethodMap = {
    [name: string]: (...a: any[]) => LangObject | undefined
}

export class LangObject {
    value: any
    scope: Scope | null
    methods: ObjectMethodMap

    constructor(
        value: any,
        scope: Scope | null = null,
        methods: ObjectMethodMap | null = null,
    ) {
        this.value = value
        this.scope = scope
        this.methods = methods == null ? {} : methods
    }
}

export class Evaluator extends Visitor<AstNode, Scope, void> {
    @rule(AstNode)
    fallback(node: AstNode) {}

    @rule(AstRoot)
    root(node: AstRoot, scope: Scope): any {
        for (const child of node.children) {
            this.invoke(child, scope)
        }
    }

    @rule(AstFiniteAutomaton)
    finite_automaton(node: AstFiniteAutomaton, scope: Scope) {
        const name = node.name.value
        const binding = scope.declare(name)

        const child_scope = new Scope(scope)
        const initial = child_scope.declare("$initial")
        const final = child_scope.declare("$final", [])
        const transitions = child_scope.declare("$transitions", [])

        this.invoke(node.body, child_scope)

        if (!initial.defined)
            throw set_location(
                new EvaluationError(
                    `Finite automaton '${name}' is missing initial state.`,
                ),
                node.name,
            )

        const automaton = new FiniteAutomaton(
            transitions.unwrap(),
            initial.unwrap(),
            final.unwrap(),
        )
        const obj = new LangObject(automaton, child_scope)

        try {
            binding.define(obj)
        } catch (err) {
            if (err instanceof RedefinitionError) throw set_location(err, node.name)
            else throw err
        }
    }

    @rule(AstInitialState)
    initial(node: AstInitialState, scope: Scope) {
        const name = node.value.value
        const binding = scope.declare("$initial")
        binding.define(name)
    }

    @rule(AstFinalState)
    final(node: AstFinalState, scope: Scope) {
        const binding = scope.declare("$final")
        if (!binding.defined) binding.define([])

        const states = binding.unwrap() as string[]

        for (const identifier of node.list.values) {
            states.push(identifier.value)
        }
    }

    @rule(AstTransition)
    transition(node: AstTransition, scope: Scope) {
        const binding = scope.declare("$transitions")
        if (!binding.defined) binding.define([])

        const transitions = binding.unwrap() as FiniteTransition[]

        const condition = node.condition

        if (condition instanceof AstChar) {
            const start = node.start.value
            const symbol = condition.value
            const end = node.end.value

            transitions.push([start, symbol, end])
        } else if (condition instanceof AstIdentifier)
            throw set_location(
                new EvaluationError(
                    `Name references in transition conditions are not supported yet.`,
                ),
                condition,
            )
    }

    @rule(AstTuringMachine)
    turing_machine(node: AstTuringMachine, scope: Scope) {
        const name = node.target.value
        const tapes = node.tapes.values.map((node) => node.value)
        const binding = scope.declare(name)

        const child_scope = new Scope(scope)
        child_scope.declare("$tapes", tapes)
        const initial = child_scope.declare("$initial")
        const final = child_scope.declare("$final", [])
        const transitions = child_scope.declare("$transitions", [])

        this.invoke(node.body, child_scope)

        if (!initial.defined)
            throw set_location(
                new EvaluationError(
                    `Turing Machine '${name}' is missing initial state.`,
                ),
                node.target,
            )

        const turing = new TuringMachine(
            transitions.unwrap(),
            initial.unwrap(),
            final.unwrap(),
            tapes,
        )
        const obj = new LangObject(turing, child_scope)

        try {
            binding.define(obj)
        } catch (err) {
            if (err instanceof RedefinitionError)
                throw set_location(err, node.target)
            else throw err
        }
    }

    turing_list(node: AstList<AstNode>, tapes: string[], output: string[]) {
        let i = 0
        let positional = true

        for (const char of node.values) {
            if (
                char instanceof AstTuringNamedChar ||
                char instanceof AstTuringNamedShiftChar
            ) {
                const tape = char.tape.value
                if (!tapes.includes(tape))
                    throw set_location(
                        new EvaluationError(
                            `Tape '${tape}' is not specified in the tape list.`,
                        ),
                        char.tape,
                    )
                output[tapes.indexOf(tape)] = char.value // FIXME support start and end chars
                positional = false
            } else if (
                char instanceof AstChar ||
                char instanceof AstTuringShiftChar
            ) {
                if (!positional)
                    throw set_location(
                        new EvaluationError(
                            "Positional char specified after named char in char list.",
                        ),
                        char,
                    )
                output[i] = char.value
                i++
            }
        }
    }

    @rule(AstTuringTransition)
    turing_transition(node: AstTuringTransition, scope: Scope) {
        const binding = scope.declare("$transitions")
        if (!binding.defined) binding.define([])
        const transitions = binding.unwrap() as TuringTransition[]

        if (!scope.is_defined("$tapes"))
            throw set_location(
                new EvaluationError(
                    "Invalid turing transition outside of turing machine block (missing tape list reference).",
                ),
                node,
            )
        const tapes = scope.value("$tapes") as string[]

        let read: string[] = tapes.map(() => "")
        let shift: TuringShiftChar[] = tapes.map(() => "-")

        const condition = node.condition
        if (condition instanceof AstTuringCharList) {
            this.turing_list(condition, tapes, read)
        } else if (condition instanceof AstChar) {
            read = read.map(() => condition.value)
        } else if (condition instanceof AstIdentifier)
            throw set_location(
                new EvaluationError(
                    `Name references in transition conditions are not supported yet.`,
                ),
                condition,
            )

        let write: string[] = Array.from(read)

        const node_write = node.write
        if (node_write instanceof AstTuringCharList) {
            this.turing_list(node_write, tapes, write)
        }

        const node_shift = node.shift
        if (node_shift instanceof AstTuringShiftCharList) {
            this.turing_list(node_shift, tapes, shift)
        } else {
            shift = shift.map(() => node_shift.value)
        }

        transitions.push([node.start.value, read, node.end.value, write, shift])
    }

    @rule(AstPrint)
    print(node: AstPrint, scope: Scope) {
        const message = node.message.value

        log(scope, "info", message)
    }

    @rule(AstTest)
    test(node: AstTest, scope: Scope) {
        const name = node.target.value

        let obj: LangObject
        try {
            obj = scope.value(name)
        } catch (err) {
            if (err instanceof EvaluationError) throw set_location(err, node.target)
            else throw err
        }

        const value = obj.value
        if (!(value instanceof TuringMachine)) {
            throw set_location(
                new EvaluationError(
                    `Object of type ${type_name(value)} is not testable.`,
                ),
                node.target,
            )
        }

        const header = `--- Testing ${name} ---`
        log(scope, "info", header)

        const entries = node.entries.values

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]
            const line = `${i + 1}. "${entry.value}" `
            
            log(scope, "info", line + "Running")

            const accepted = value.test(entry.value)
            const status = accepted ? "Accepted" : "Rejected"
            log(scope, accepted ? "success" : "error", line + status, true)
        }

        const dashes = header.length - 6
        log(
            scope,
            "info",
            "-".repeat(Math.floor(dashes / 2)) +
                " Done " +
                "-".repeat(Math.ceil(dashes / 2)),
        )
    }
}

function log(scope: Scope, level: string, message: string, resetLine: boolean = false) {
    if (scope.is_defined("$post", true)) {
        const post = scope.value("$post")
        post({ type: "log", level, message, resetLine })
    }
}
