import type { SentencialSequence } from "./grammar"
import { SourceLocation } from "./tokenstream"

export type AstNodeArgs = {
    location?: SourceLocation
    endLocation?: SourceLocation
}
export class AstNode {
    location: SourceLocation
    endLocation: SourceLocation

    constructor({
        location = SourceLocation.initial,
        endLocation = SourceLocation.initial,
    }: AstNodeArgs) {
        this.location = location
        this.endLocation = endLocation
    }

    toObject() {
        function convert(value: any) {
            if (value instanceof AstNode) {
                value = value.toObject()
            } else if (value instanceof Array) {
                value = [...value]
                for (let i = 0; i < value.length; i++) {
                    value[i] = convert(value[i])
                }
            }
            return value
        }

        const properties: any = {}
        for (let key of Object.getOwnPropertyNames(this)) {
            // @ts-ignore
            properties[key] = convert(this[key])
        }
        return {
            node: Object.getPrototypeOf(this).constructor.name,
            ...properties,
        }
    }
}


export class AstExpression extends AstNode {}


export type AstUnaryArgs = AstNodeArgs & {
    op: string
    value: AstExpression
}
export class AstUnary extends AstExpression {
    op: string
    value: AstExpression

    constructor({ op, value, ...args }: AstUnaryArgs) {
        super(args)
        this.op = op
        this.value = value
    }
}

export type AstBinaryArgs = AstNodeArgs & {
    op: string
    left: AstExpression
    right: AstExpression
}
export class AstBinary extends AstExpression {
    op: string
    left: AstExpression
    right: AstExpression

    constructor({ op, left, right, ...args }: AstBinaryArgs) {
        super(args)
        this.op = op
        this.left = left
        this.right = right
    }
}


export type AstIdentifierArgs = AstNodeArgs & {
    value: string
}
export class AstIdentifier extends AstExpression {
    value: string

    constructor({ value, ...args }: AstIdentifierArgs) {
        super(args)
        this.value = value
    }
}


export type AstListArgs<T> = AstNodeArgs & {
    values: T[]
}
export class AstList<T> extends AstExpression {
    values: T[]

    constructor({ values, ...args }: AstListArgs<T>) {
        super(args)
        this.values = values
    }

    *[Symbol.iterator]() {
        yield* this.values
    }
}

export class AstStateList extends AstList<AstIdentifier> {}

export type AstInitialStateArgs = AstNodeArgs & {
    value: AstIdentifier
}


export type AstRegexArgs = AstNodeArgs & {
    children: AstRegexFragment
}
export class AstRegex extends AstNode {
    children: AstRegexFragment

    constructor({children, ...args}: AstRegexArgs) {
        super(args)
        this.children = children
    }
}

export type AstRegexFragment = AstRegexChildren | AstRegexLiteral | AstRegexUnary | AstRegexBinary

export class AstRegexChildren extends AstList<AstRegexFragment> {}

export type AstRegexLiteralArgs = AstNodeArgs & {
    value: string
}
export class AstRegexLiteral extends AstNode {
    value: string

    constructor({value, ...args}: AstRegexLiteralArgs) {
        super(args)
        this.value = value
    }
}

export type AstRegexUnaryArgs = AstNodeArgs & {
    value: AstRegexFragment
    op: string
}
export class AstRegexUnary extends AstNode {
    value: AstRegexFragment
    op: string

    constructor({value, op, ...args}: AstRegexUnaryArgs) {
        super(args)
        this.value = value
        this.op = op
    }
}

export type AstRegexBinaryArgs = AstNodeArgs & {
    left: AstRegexFragment
    right: AstRegexFragment
    op: string
}
export class AstRegexBinary extends AstNode {
    left: AstRegexFragment
    right: AstRegexFragment
    op: string

    constructor({left, right, op, ...args}: AstRegexBinaryArgs) {
        super(args)
        this.left = left
        this.right = right
        this.op = op
    }
}



export class AstInitialState extends AstNode {
    value: AstIdentifier

    constructor({ value, ...args }: AstInitialStateArgs) {
        super(args)
        this.value = value
    }
}

export type AstFinalStateArgs = AstNodeArgs & {
    list: AstStateList
}
export class AstFinalState extends AstNode {
    list: AstStateList

    constructor({ list, ...args }: AstFinalStateArgs) {
        super(args)
        this.list = list
    }
}

export type AstTransitionArgs = AstNodeArgs & {
    start: AstIdentifier
    end: AstIdentifier
    condition: AstNode
}
export class AstTransition extends AstNode {
    start: AstIdentifier
    end: AstIdentifier
    condition: AstNode

    constructor({ start, end, condition, ...args }: AstTransitionArgs) {
        super(args)
        this.start = start
        this.end = end
        this.condition = condition
    }
}

export type AstCharArgs = AstNodeArgs & {
    value: string
}
export class AstChar extends AstNode {
    value: string

    constructor({ value, ...args }: AstCharArgs) {
        super(args)
        this.value = value
    }
}

export type AstStringArgs = AstNodeArgs & {
    value: string
}
export class AstString extends AstNode {
    value: string

    constructor({ value, ...args }: AstStringArgs) {
        super(args)
        this.value = value
    }
}

export type AstPrintArgs = AstNodeArgs & {
    message: AstString
}
export class AstPrint extends AstNode {
    message: AstString

    constructor({ message, ...args }: AstPrintArgs) {
        super(args)
        this.message = message
    }
}

export type AstTestArgs = AstNodeArgs & {
    target: AstIdentifier
    entries: AstList<AstString>
}
export class AstTest extends AstNode {
    target: AstIdentifier
    entries: AstList<AstString>

    constructor({ target, entries, ...args }: AstTestArgs) {
        super(args)
        this.target = target
        this.entries = entries
    }
}

export type AstRootArgs = AstNodeArgs & {
    children: AstNode[]
}
export class AstRoot extends AstNode {
    children: AstNode[]

    constructor({ children, ...args }: AstRootArgs) {
        super(args)
        this.children = children
    }
}

export class AstModuleRoot extends AstRoot {}

export type AstFiniteAutomatonArgs = AstNodeArgs & {
    name: AstIdentifier
    body: AstRoot
}
export class AstFiniteAutomaton extends AstNode {
    name: AstIdentifier
    body: AstRoot

    constructor({ name, body, ...args }: AstFiniteAutomatonArgs) {
        super(args)
        this.name = name
        this.body = body
    }
}


export class AstStackList extends AstList<AstIdentifier> {}

export type AstPushdownAutomatonArgs = AstNodeArgs & {
    target: AstIdentifier
    stacks: AstStackList
    body: AstRoot
}
export class AstPushdownAutomaton extends AstNode {
    target: AstIdentifier
    stacks: AstStackList
    body: AstRoot

    constructor({ target, stacks, body, ...args }: AstPushdownAutomatonArgs) {
        super(args)
        this.target = target
        this.stacks = stacks
        this.body = body
    }
}

export type AstPushdownTransitionArgs = AstTransitionArgs & {
    pop: AstTuringCharList
    push: AstTuringCharList
}
export class AstPushdownTransition extends AstTransition {
    pop: AstTuringCharList
    push: AstTuringCharList

    constructor({ pop, push, ...args }: AstPushdownTransitionArgs) {
        super(args)
        this.pop = pop
        this.push = push
    }
}


export class AstTapeList extends AstList<AstIdentifier> {}

export type AstTuringMachineArgs = AstNodeArgs & {
    target: AstIdentifier
    tapes: AstTapeList
    body: AstRoot
}
export class AstTuringMachine extends AstNode {
    target: AstIdentifier
    tapes: AstTapeList
    body: AstRoot

    constructor({ target, tapes, body, ...args }: AstTuringMachineArgs) {
        super(args)
        this.target = target
        this.tapes = tapes
        this.body = body
    }
}

export class AstStartLocationChar extends AstChar {}

export class AstEndLocationChar extends AstChar {}

export type AstTuringShiftCharArgs = AstNodeArgs & {
    value: ">" | "<" | "-"
}
export class AstTuringShiftChar extends AstNode {
    value: ">" | "<" | "-"

    constructor({ value, ...args }: AstTuringShiftCharArgs) {
        super({ ...args })
        this.value = value
    }
}

export type AstTuringNamedShiftCharArgs = AstTuringShiftCharArgs & {
    tape: AstIdentifier
}
export class AstTuringNamedShiftChar extends AstTuringShiftChar {
    tape: AstIdentifier

    constructor({ tape, ...args }: AstTuringNamedShiftCharArgs) {
        super(args)
        this.tape = tape
    }
}

export class AstTuringShiftCharList extends AstList<AstTuringShiftChar> {}

export type AstTuringNamedCharArgs = AstNodeArgs & {
    tape: AstIdentifier
    char: AstChar
}
export class AstTuringNamedChar extends AstChar {
    tape: AstIdentifier
    char: AstChar

    constructor({ tape, char, ...args }: AstTuringNamedCharArgs) {
        super({ ...args, value: char.value })
        this.tape = tape
        this.char = char
    }
}

export class AstTuringCharList extends AstList<AstChar | AstTuringNamedChar> {}

export type AstTuringTransitionArgs = AstTransitionArgs & {
    write: AstTuringCharList
    shift: AstTuringShiftChar | AstTuringShiftCharList
}
export class AstTuringTransition extends AstTransition {
    write: AstTuringCharList
    shift: AstTuringShiftChar | AstTuringShiftCharList

    constructor({ write, shift, ...args }: AstTuringTransitionArgs) {
        super(args)
        this.write = write
        this.shift = shift
    }
}


export type AstAutomatonAssignmentArgs = AstNodeArgs & {
    type: string
    target: AstIdentifier
    expression: AstExpression
}
export class AstAutomatonAssignment extends AstNode {
    type: string
    target: AstIdentifier
    expression: AstExpression

    constructor({ type, target, expression, ...args }: AstAutomatonAssignmentArgs) {
        super(args)
        this.type = type
        this.target = target
        this.expression = expression
    }
}


export type AstGrammarArgs = AstNodeArgs & {
    target: AstIdentifier
    start_symbol: AstIdentifier
    body: AstRoot
}
export class AstGrammar extends AstNode {
    target: AstIdentifier
    start_symbol: AstIdentifier
    body: AstRoot

    constructor({ target, body, start_symbol, ...args }: AstGrammarArgs) {
        super(args)
        this.target = target
        this.start_symbol = start_symbol
        this.body = body
    }
}


export class AstGrammarExpression extends AstNode {}

export type AstGrammarSequenceArgs = AstNodeArgs & {
    value: SentencialSequence
}
export class AstGrammarSequence extends AstGrammarExpression {
    value: SentencialSequence

    constructor({ value, ...args }: AstGrammarSequenceArgs) {
        super(args)
        this.value = value
    }
}

export type AstGrammarAlternativeArgs = AstNodeArgs & {
    values: AstGrammarExpression[]
}
export class AstGrammarAlternative extends AstGrammarExpression {
    values: AstGrammarExpression[]

    constructor({ values, ...args }: AstGrammarAlternativeArgs) {
        super(args)
        this.values = values
    }
}

export type AstGrammarRuleArgs = AstNodeArgs & {
    head: AstGrammarSequence
    expression: AstGrammarExpression
}
export class AstGrammarRule extends AstNode {
    head: AstGrammarSequence
    expression: AstGrammarExpression

    constructor({ head, expression, ...args }: AstGrammarRuleArgs) {
        super(args)
        this.head = head
        this.expression = expression
    }
}