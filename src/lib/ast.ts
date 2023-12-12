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

export type AstIdentifierArgs = AstNodeArgs & {
    value: string
}
export class AstIdentifier extends AstNode {
    value: string

    constructor({ value, ...args }: AstIdentifierArgs) {
        super(args)
        this.value = value
    }
}

export type AstListArgs<T> = AstNodeArgs & {
    values: T[]
}
export class AstList<T> extends AstNode {
    values: T[]

    constructor({ values, ...args }: AstListArgs<T>) {
        super(args)
        this.values = values
    }
}

export class AstStateList extends AstList<AstIdentifier> {}

export type AstInitialStateArgs = AstNodeArgs & {
    value: AstIdentifier
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
