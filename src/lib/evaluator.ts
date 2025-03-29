import {
    AstAutomatonAssignment,
    AstBinary,
    AstChar,
    AstFinalState,
    AstFiniteAutomaton,
    AstGrammar,
    AstGrammarAlternative,
    AstGrammarRule,
    AstGrammarSequence,
    AstIdentifier,
    AstInitialState,
    AstList,
    AstNode,
    AstPrint,
    AstPushdownAutomaton,
    AstPushdownTransition,
    AstReenumerate,
    AstRegex,
    AstRegexBinary,
    AstRegexChildren,
    AstRegexLiteral,
    AstRegexUnary,
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
    AstUnary,
} from "./ast"
import {
    FiniteAutomaton,
    TuringMachine,
    type FiniteTransition,
    type TuringTransition,
    type TuringShiftChar,
    StateMachine,
    PushdownAutomaton,
    type PushdownTransition,
} from "./automaton"
import { Grammar, ProductionRule, type SentencialSequence } from "./grammar"
import { SourceLocation, set_location } from "./tokenstream"
import { Visitor, rule, type Class } from "./visitor"



export function get_type(value: any): any {
    const type = typeof value

    if (type !== "object") return type

    return Object.getPrototypeOf(value).constructor
}

export function type_name(value: any): string {
    const cls = get_type(value)

    if (value instanceof LangObject) return cls.type_name
    return cls.name
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

export class NameError extends EvaluationError {
    scope: Scope
    name: string

    constructor(scope: Scope, name: string) {
        super(`Name '${name}' is not declared.`)

        this.scope = scope
        this.name = name
    }
}


export class InvalidOperation extends EvaluationError {
    op: string
    operands: any[]

    constructor(op: string, ...operands: any[]) {
        const operand_msg = operands.map(o => `'${type_name(o)}'`).join(", ")
        const msg = `Invalid operand(s) for ${op}: ${operand_msg}`
        super(msg)

        this.op = op
        this.operands = operands
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

    unwrap(optional: boolean = false) {
        if (!this.defined) {
            if (optional) return null
            throw new PreDefinitionUsageError(this)
        }
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

    subscope(namespace: string[]): Scope | null {
        let scope: Scope = this

        for (const nested_name of namespace) {
            const value = scope.value(nested_name, true)

            if (!(value instanceof LangObject)) return null
            if (!value.scope) return null

            scope = value.scope
        }

        return scope
    }
    path(path: string[]): Binding | null {
        const namespace = path.slice(0, -1)
        const name = path[path.length - 1]

        const scope = this.subscope(namespace)
        if (!scope) return null

        const binding = scope.bindings[name]
        return binding ? binding : null
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

    value(name: string, optional: boolean = false, parent: boolean = true): any {
        const binding = this.bindings[name]
        if (!binding) {
            if (parent && this.parent) return this.parent.value(name)
            if (optional) return null
            throw new NameError(this, name)
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

    entries(): [string, any][] {
        const result: [string, any][] = []
        for (let [name, binding] of Object.entries(this.bindings)) {
            if (binding.defined && !name.startsWith("$")) {
                result.push([name, binding.unwrap()])
            }
        }
        return result
    }

    [Symbol.iterator](): [string, any][] {
        return this.entries()
    }
}


export type ObjectMethod = (...a: any[]) => LangObject | undefined

export type ObjectMethodMap = {[name: string]: ObjectMethod}


export class LangObject {
    static type_name: string = "object"

    value: any
    scope: Scope | null

    declare static methods: ObjectMethodMap

    constructor(value: any, scope: Scope | null = null) {
        this.value = value
        this.scope = scope
    }

    static add_method(name: string, f: ObjectMethod) {
        if (!this.methods) this.methods = {}

        this.methods[name] = f
    }

    get_method(name: string): ObjectMethod | undefined {
        const cls = <typeof LangObject> this.constructor
        const methods: ObjectMethodMap = cls.methods ?? {}

        const method = methods[name]
        if (!method) return undefined

        return method.bind(this)
    }
}

const NotImplemented = new LangObject(null)

interface ObjectMethodDescriptor extends PropertyDescriptor {
    value?: (...args: any) => LangObject | undefined
}

export function object_method(
    target: LangObject,
    name: string,
    descriptor: ObjectMethodDescriptor
) {
    const func = descriptor.value
    if (func) {
        const target_cls = <typeof LangObject> target.constructor
        target_cls.add_method(name, func)
    }
}

export class FiniteObject extends LangObject {
    static type_name: string = "Finite Automaton"

    declare value: FiniteAutomaton

    constructor(value: FiniteAutomaton, scope: Scope | null = null) {
        super(value, scope)
    }

    @object_method
    $union(other: any) {
        if (!(other instanceof FiniteObject)) return NotImplemented

        const automaton = this.value.union(other.value)
        return new FiniteObject(automaton)
    }

    @object_method
    $intersection(other: any) {
        if (!(other instanceof FiniteObject)) return NotImplemented

        const automaton = this.value.intersection(other.value)
        return new FiniteObject(automaton)
    }

    @object_method
    $concatenate(other: any) {
        if (!(other instanceof FiniteObject)) return NotImplemented

        const automaton = this.value.concatenate(other.value)
        return new FiniteObject(automaton)
    }

    @object_method
    $complement() {
        const automaton = this.value.complement()
        return new FiniteObject(automaton)
    }

    @object_method
    $determinize() {
        const automaton = this.value.determinize()
        return new FiniteObject(automaton)
    }

    @object_method
    $minimize() {
        const automaton = this.value.minimize()
        return new FiniteObject(automaton)
    }

    @object_method
    $star() {
        const automaton = this.value.star()
        return new FiniteObject(automaton)
    }

    @object_method
    $reverse() {
        const automaton = this.value.reverse()
        return new FiniteObject(automaton)
    }

    @object_method
    $reenumerate(names: string | string[]) {
        const aut = this.value
        function* gen() {
            let i = 0
            
            while (true) {
                if (Array.isArray(names)) {
                    if (aut.states.size > names.length) {
                        throw new EvaluationError(
                            `Automaton has ${aut.states.size} state(s), but only ${names.length} name(s) were provided.`
                        )
                    }
                    yield names[i]
                }
                else {
                    yield `${names}${i}`
                }
                i += 1
            }
        }

        const automaton = this.value.reenumerate(gen())
        return new FiniteObject(automaton)
    }
}

export class TuringObject extends LangObject {
    static type_name: string = "Turing Machine"
    declare value: TuringMachine

    constructor(value: TuringMachine, scope: Scope | null = null) {
        super(value, scope)
    }
}


export class PushdownObject extends LangObject {
    static type_name: string = "Pushdown Automaton"
    declare value: PushdownAutomaton

    constructor(value: PushdownAutomaton, scope: Scope | null = null) {
        super(value, scope)
    }
}


export class GrammarObject extends LangObject {
    static type_name: string = "Grammar"
    declare value: Grammar

    constructor(value: Grammar, scope: Scope | null = null) {
        super(value, scope)
    }
}


export const object_types: {[name: string]: typeof LangObject} = {
    object: LangObject,
    finite: FiniteObject,
    turing: TuringObject,
    pushdown: PushdownObject,
    grammar: GrammarObject,
}

export class Evaluator extends Visitor<AstNode, Scope, any> {
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
        const obj = new FiniteObject(automaton, child_scope)

        try {
            binding.define(obj)
        } catch (err) {
            if (err instanceof RedefinitionError) throw set_location(err, node.name)
            else throw err
        }
    }

    @rule(AstAutomatonAssignment)
    automaton_assignment(node: AstAutomatonAssignment, scope: Scope) {
        const name = node.target.value
        const binding = scope.declare(name)

        const result = this.invoke(node.expression, scope)

        const assign_type = object_types[node.type]
        const result_type = get_type(result)

        if (assign_type !== result_type) throw set_location(
            new EvaluationError(`Cannot assign '${type_name(result)}' object to ${assign_type.type_name} '${name}'.`),
            node.target
        )

        try {
            binding.define(result)
        } catch (err) {
            if (err instanceof RedefinitionError) throw set_location(err, node.target)
            else throw err
        }
    }

    @rule(AstIdentifier)
    identifier(node: AstIdentifier, scope: Scope): any {
        try {
            return scope.value(node.value)
        }
        catch (err: any) {
            throw set_location(err, node)
        }
    }

    @rule(AstBinary)
    binary(node: AstBinary, scope: Scope): any {
        const left = this.invoke(node.left, scope)
        const right = this.invoke(node.right, scope)

        if (!(left instanceof LangObject)) throw set_location(
            new EvaluationError(`Left operand ${left} of ${node.op} is illegal value.`),
            left
        )

        if (!(right instanceof LangObject)) throw set_location(
            new EvaluationError(`Right operand ${right} of ${node.op} is illegal value.`),
            right
        )

        const left_method = left.get_method("$" + node.op)
        
        if (left_method) {
            const result = left_method(right)
            if (result !== NotImplemented) return result
        }
        
        const right_method = right.get_method("$reverse" + node.op)
        
        if (right_method) {
            const result = right_method(left)
            if (result !== NotImplemented) return result
        }

        throw set_location(
            new InvalidOperation(node.op, left, right), node
        )
    }

    @rule(AstUnary)
    unary(node: AstUnary, scope: Scope): any {
        const operand = this.invoke(node.value, scope)

        if (!(operand instanceof LangObject)) throw set_location(
            new EvaluationError(`Operand ${operand} of ${node.op} is illegal value.`),
            operand
        )

        const method_name = "$" + node.op
        const method = operand.get_method(method_name)
        if (method === undefined) throw set_location(
            new InvalidOperation(node.op, operand), node
        )

        return method()
    }

    @rule(AstReenumerate)
    reenumerate(node: AstReenumerate, scope: Scope): any {
        const operand = this.invoke(node.value, scope)

        if (!(operand instanceof FiniteObject)) throw set_location(
            new EvaluationError(`Operand ${operand} of ${node.op} is illegal value.`),
            operand
        )

        let names = node.names instanceof AstList ?
            node.names.values.map(v => v.value) :
            node.names.value
        return operand.$reenumerate(names)
    }

    @rule(AstRegex)
    regex(node: AstRegex, scope: Scope) {
        const automaton = this.invoke(node.children, scope) as FiniteObject

        return automaton.$minimize().$reenumerate()
    }

    @rule(AstRegexChildren)
    regex_children(node: AstRegexChildren, scope: Scope) {
        let automaton = this.invoke(new AstRegexLiteral({value: ""}), scope) as FiniteObject

        for (const fragment of node.values) {
            const value = this.invoke(fragment, scope) as FiniteObject
            automaton = automaton.$concatenate(value) as FiniteObject
        }

        return automaton
    }

    @rule(AstRegexUnary)
    regex_unary(node: AstRegexUnary, scope: Scope) {
        const value = this.invoke(node.value, scope) as FiniteObject

        const alphabet = value.value.alphabet
        const empty = new FiniteObject(new FiniteAutomaton([], "q0", ["q0"], [], alphabet))
    
        if (node.op === "zero_or_more") {
            return value.$star()
        }
            
        if (node.op === "one_or_more") {
            const value_star = value.$star()
            return value_star.$intersection(empty.$complement())
        }

        if (node.op === "optional") {
            return value.$union(empty)
        }
        
        throw set_location(
            new EvaluationError(`Unknown regex unary operation '${node.op}'.`),
            node
        )
    }

    @rule(AstRegexBinary)
    regex_binary(node: AstRegexBinary, scope: Scope) {
        const left = this.invoke(node.left, scope) as FiniteObject
        const right = this.invoke(node.right, scope) as FiniteObject

        if (node.op === "alternative") return left.$union(right)

        throw set_location(
            new EvaluationError(`Unknown regex binary operation '${node.op}'.`),
            node
        )
    }

    @rule(AstRegexLiteral)
    regex_literal(node: AstRegexLiteral, scope: Scope) {
        const symbols = node.value.split("")

        const initial = "q0"
        const transitions: FiniteTransition[] = []

        for (let i = 0; i < symbols.length; i++) {
            transitions.push([`q${i}`, symbols[i], `q${i+1}`])
        }

        const final = `q${symbols.length}`

        const automaton = new FiniteAutomaton(transitions, initial, [final])
        return new FiniteObject(automaton)
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

    @rule(AstPushdownAutomaton)
    pushdown_automaton(node: AstPushdownAutomaton, scope: Scope) {
        const name = node.target.value
        const stacks = node.stacks.values.map((node) => node.value)
        const tapes = ["Input", ...stacks]

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
                    `Pushdown Automaton '${name}' is missing initial state.`,
                ),
                node.target,
            )

        const automaton = new PushdownAutomaton(
            transitions.unwrap(), initial.unwrap(), final.unwrap(), tapes, [], [], true
        )
        const obj = new PushdownObject(automaton, child_scope)

        try {
            binding.define(obj)
        } catch (err) {
            if (err instanceof RedefinitionError)
                throw set_location(err, node.target)
            else throw err
        }
    }

    @rule(AstPushdownTransition)
    pushdown_transition(node: AstPushdownTransition, scope: Scope) {
        const binding = scope.declare("$transitions")
        if (!binding.defined) binding.define([])
        const transitions = binding.unwrap() as PushdownTransition[]

        if (!scope.is_defined("$tapes"))
            throw set_location(
                new EvaluationError(
                    "Invalid pushdown transition outside of pushdown automaton block (missing tape list reference).",
                ),
                node,
            )
        const tapes = scope.value("$tapes") as string[]

        if (!(node.condition instanceof AstChar)) {
            throw set_location(
                new EvaluationError(
                    `Invalid pushdown automaton condition.`,
                ),
                node.condition,
            )
        }

        const read = [node.condition.value, ...this.turing_list(node.pop, tapes.slice(1))]
        const push = this.turing_list(node.push, tapes.slice(1), null, false)

        transitions.push([node.start.value, read, node.end.value, push])
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
        const obj = new TuringObject(turing, child_scope)

        try {
            binding.define(obj)
        } catch (err) {
            if (err instanceof RedefinitionError)
                throw set_location(err, node.target)
            else throw err
        }
    }

    enforce_turing_single_char(node: AstChar) {
        const value = node.value
        if (value.length > 1) throw set_location(
            new EvaluationError("Multi-character string not allowed in turing conditions."),
            node
        )
    }

    turing_list(
        node: AstList<AstNode>,
        tapes: string[],
        output: string[] | null = null,
        enforce_single_char: boolean = true,
    ): string[] {
        if (output === null) output = tapes.map(() => "")

        let i = 0
        let positional = true

        for (const char of node.values) {
            if (
                char instanceof AstTuringNamedChar ||
                char instanceof AstTuringNamedShiftChar
            ) {
                if (enforce_single_char) this.enforce_turing_single_char(char)

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
                if (enforce_single_char) this.enforce_turing_single_char(char)

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

        return output
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
            this.enforce_turing_single_char(condition)
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

    @rule(AstGrammar)
    grammar(node: AstGrammar, scope: Scope) {
        const name = node.target.value
        const start_symbol = node.start_symbol.value
        
        const child_scope = new Scope(scope)
        const rules = child_scope.declare("$rules", [])

        this.invoke(node.body, child_scope)

        const grammar = new Grammar(rules.unwrap(), start_symbol)
        const object = new GrammarObject(grammar, child_scope)

        try {
            scope.declare(name, object)
        }
        catch (err) {
            if (err instanceof RedefinitionError)
                throw set_location(err, node.target)
            throw err
        }
    }

    @rule(AstGrammarRule)
    grammar_rule(node: AstGrammarRule, scope: Scope) {
        if (!scope.is_defined("$rules", false)) scope.declare("$rules", [])
        const rules = scope.value("$rules") as ProductionRule[]
        
        const head = node.head.value
        const results = this.invoke(node.expression, scope) as SentencialSequence[]

        const rule = new ProductionRule(head, ...results)
        rules.push(rule)
    }

    @rule(AstGrammarAlternative)
    grammar_alternative(node: AstGrammarAlternative, scope: Scope) {
        const values = []

        for (const value of node.values) {
            values.push(...this.invoke(value, scope))
        }
        return values
    }

    @rule(AstGrammarSequence)
    grammar_sequence(node: AstGrammarSequence, scope: Scope) {
        return [node.value]
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
        if (!(value instanceof StateMachine)) {
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

function log(
    scope: Scope,
    level: string,
    message: string,
    resetLine: boolean = false,
) {
    if (scope.is_defined("$post", true)) {
        const post = scope.value("$post")
        post({ type: "log", level, message, resetLine })
    }
}
