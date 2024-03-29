import {
    InvalidSyntax,
    UnexpectedToken,
    type TokenStream,
    UnexpectedEOF,
    type TokenPattern,
    SourceLocation,
} from "./tokenstream"

import {
    AstFiniteAutomaton,
    AstChar,
    AstFinalState,
    AstIdentifier,
    AstInitialState,
    AstNode,
    AstRoot,
    AstStateList,
    AstTransition,
    AstList,
    AstTuringMachine,
    AstTuringCharList,
    AstTuringShiftCharList,
    AstTuringTransition,
    AstTuringShiftChar,
    AstTuringNamedChar,
    AstTuringNamedShiftChar,
    AstStartLocationChar,
    AstEndLocationChar,
    AstTapeList,
    AstString,
    AstPrint,
    AstTest,
    AstAutomatonAssignment,
    AstExpression,
    AstBinary,
    AstUnary,
    AstPushdownAutomaton,
    AstStackList,
    AstPushdownTransition,
    AstGrammar,
    AstGrammarSequence,
    AstGrammarExpression,
    AstGrammarRule,
    AstGrammarAlternative,
} from "./ast"
import { Token, set_location } from "./tokenstream"
import { ParseError } from "./error"
import type { TuringShiftChar } from "./automaton"
import { NonTerminal, Terminal, type SentencialSequence } from "./grammar"

export const keywords = [
    "finite",
    "initial",
    "final",
    "turing",
    "tapes",
    "pushdown",
    "stacks",
    "grammar",
    "start",
    "print",
    "test",
    "union",
    "intersection",
    "complement",
    "determinize",
    "reenumerate",
    "star",
    "reverse",
    "concatenate",
]

export enum Patterns {
    finite = "finite\\b",
    initial = "initial\\b",
    final = "final\\b",
    turing = "turing\\b",
    tapes = "tapes\\b",
    pushdown = "pushdown\\b",
    stacks = "stacks\\b",
    grammar = "grammar\\b",
    start = "start\\b",
    print = "print\\b",
    test = "test\\b",
    union = "union\\b",
    intersection = "intersection\\b",
    complement = "complement\\b",
    determinize = "determinize\\b",
    reenumerate = "reenumerate\\b",
    star = "star\\b",
    reverse = "reverse\\b",
    concatenate = "concatenate\\b",

    opening_parens = "\\(",
    closing_parens = "\\)",
    opening_bracket = "\\{",
    closing_bracket = "\\}",
    opening_square_bracket = "\\[",
    closing_square_bracket = "\\]",
    semicolon = ";",
    colon = ":",
    equals = "=",
    comma = ",",
    quote = '"',
    separation_bar = "\\|",
    singlequote = "'",
    comment = "//.*",
    multiline_comment = "/\\*[\\s\\S]*?\\*/",

    shift_char = ">|<|-",

    word = "\\w+",
    identifier = "[a-zA-Z_][a-zA-Z0-9_]*",
    symbol = "\\S",
}

export function pattern(name: keyof typeof Patterns): TokenPattern {
    return [name, Patterns[name]]
}

export function get_default_parsers(): { [key: string]: Parser<AstNode> } {
    return {
        identifier: new CallParser(parse_identifier),
        state: delegate("identifier"),
        state_list: new ListParser(delegate("state"), AstStateList),
        char_condition: new CallParser(parse_char_condition),
        string: new CallParser(parse_string),

        module: new RootParser(delegate("statement")),
        root: new RootParser(
            delegate("statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket"),
        ),

        statement: new ChooseParser(
            option(pattern("initial"), new CallParser(parse_initial_state), true),
            option(pattern("final"), new CallParser(parse_final_states), true),
            option(pattern("finite"), delegate("finite")),
            option(pattern("turing"), delegate("turing"), true),
            option(pattern("pushdown"), delegate("pushdown")),
            option(pattern("grammar"), delegate("grammar")),
            option(pattern("print"), delegate("print")),
            option(pattern("test"), delegate("test")),
            option(pattern("identifier"), delegate("transition")),
        ),
        print: new CallParser(parse_print_statement),
        test: new CallParser(parse_test_statement),

        "finite": new CallParser(parse_finite_automaton),
        transition: new CallParser(parse_finite_transition),

        "pushdown": new CallParser(parse_pushdown_automaton),
        "pushdown:root": new RootParser(
            delegate("pushdown:statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket"),
        ),
        "pushdown:statement": new ChooseParser(
            option(pattern("initial"), new CallParser(parse_initial_state), true),
            option(pattern("final"), new CallParser(parse_final_states), true),
            option(pattern("finite"), delegate("finite")),
            option(pattern("pushdown"), delegate("pushdown")),
            option(pattern("identifier"), delegate("pushdown:transition")),
        ),
        "pushdown:transition": new CallParser(parse_pushdown_transition),

        "expression": delegate("expression:union"),
        "expression:union": new BinaryParser(
            pattern("union"), delegate("expression:intersection")
        ),
        "expression:intersection": new BinaryParser(
            pattern("intersection"), delegate("expression:concatenate")
        ),
        "expression:concatenate": new BinaryParser(
            pattern("concatenate"), delegate("expression:unary")
        ),
        "expression:unary": new UnaryParser(
            [
                pattern("complement"),
                pattern("determinize"),
                pattern("reenumerate"),
                pattern("complement"),
                pattern("star"),
                pattern("reverse"),
            ],
            delegate("expression:primary")
        ),
        "expression:primary": new CallParser(parse_primary_expression),

        "expression:list:string": new ListParser(
            delegate("string"),
            AstList<AstString>,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
        ),

        turing: new CallParser(parse_turing_machine),
        "turing:tape": delegate("identifier"),
        "turing:tapes": new ListParser(
            delegate("turing:tape"),
            AstTapeList,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
        ),
        "turing:root": new RootParser(
            delegate("turing:statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket"),
        ),
        "turing:statement": new ChooseParser(
            option(pattern("initial"), new CallParser(parse_initial_state), true),
            option(pattern("final"), new CallParser(parse_final_states), true),
            option(pattern("finite"), delegate("finite")),
            option(pattern("pushdown"), delegate("pushdown")),
            option(pattern("turing"), delegate("turing"), true),
            option(pattern("identifier"), delegate("turing:transition")),
        ),
        "turing:transition": new CallParser(parse_turing_transition),
        "turing:chars": new CallParser(parse_turing_chars),
        "turing:chars:list": new ListParser(
            delegate("turing:chars:single"),
            AstTuringCharList,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
        ),
        "turing:chars:single": new AlternativeParser([
            delegate("turing:named_char"),
            delegate("turing:char"),
        ]),
        "turing:named_char": new CallParser(parse_named_char_condition),
        "turing:char": new AlternativeParser([
            delegate("turing:char:special"),
            delegate("char_condition"),
        ]),
        "turing:char:special": new CallParser(parse_turing_special_char),
        "turing:shift": new AlternativeParser([
            delegate("turing:shift:char"),
            delegate("turing:shift:list"),
        ]),
        "turing:shift:list": new ListParser(
            delegate("turing:shift:single"),
            AstTuringShiftCharList,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
        ),
        "turing:shift:single": new AlternativeParser([
            delegate("turing:shift:named_char"),
            delegate("turing:shift:char"),
        ]),
        "turing:shift:named_char": new CallParser(parse_turing_named_shift_char),
        "turing:shift:char": new CallParser(parse_turing_shift_char),

        "grammar": new CallParser(parse_grammar),
        "grammar:root": new RootParser(
            delegate("grammar:statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket")
        ),
        "grammar:statement": new ChooseParser(
            option(pattern("initial"), delegate("initial")),
            option(pattern("symbol"), delegate("grammar:rule")),
        ),
        "grammar:rule": new CallParser(parse_grammar_rule),
        "grammar:expression": delegate("grammar:alternative"),
        "grammar:alternative": new CallParser(parse_grammar_alternative),
        "grammar:sequence": new CallParser(parse_grammar_sequence)
    }
}

export interface Parser<T> {
    parse(stream: TokenStream): T
}

export function delegate(parserName: string): Parser<AstNode>
export function delegate(parserName: string, stream: TokenStream): AstNode
export function delegate(parserName: string, stream: TokenStream | null = null) {
    function delegated(stream: TokenStream) {
        const parser: Parser<AstNode> = stream.data.parsers[parserName]
        if (parser === undefined) {
            throw new Error(`Parser '${parserName}' is undefined.`)
        }
        return parser.parse(stream)
    }

    if (stream) return delegated(stream)

    return new CallParser(delegated)
}

export class CallParser {
    parse: (stream: TokenStream) => AstNode

    constructor(callback: (stream: TokenStream) => AstNode) {
        this.parse = callback
    }
}

export class KeywordParser {
    parsers: { [name: string]: Parser<AstNode> }
    patterns: { [pattern: string]: string }

    constructor(parsers: { [keyword: string]: Parser<AstNode> }) {
        this.parsers = {}
        this.patterns = {}

        for (let [key, parser] of Object.entries(parsers)) {
            this.add(key, parser)
        }
    }

    add(key: string, parser: Parser<AstNode>) {
        this.parsers[key] = parser
        this.patterns[key] = key + "\\b"
    }

    parse(stream: TokenStream) {
        const token = stream.syntax(this.patterns, () =>
            stream.expect_any(...Object.keys(this.patterns)),
        )
        const parser = this.parsers[token.type]
        const node = parser.parse(stream)

        return set_location(node, token)
    }
}

export interface ChoosableParser extends Parser<AstNode> {
    prefix: TokenPattern
    consume?: boolean
}

export function option(
    pattern: TokenPattern,
    parser: Parser<AstNode>,
    consume: boolean = false,
): ChoosableParser {
    return {
        prefix: pattern,
        consume: consume,
        parse: parser.parse.bind(parser),
    }
}

export class ChooseParser {
    parsers: { [name: string]: ChoosableParser }
    patterns: { [name: string]: string }

    constructor(...options: ChoosableParser[]) {
        this.parsers = {}
        this.patterns = {}
        this.addOptions(...options)
    }

    addOptions(...options: ChoosableParser[]) {
        for (let parser of options) {
            const p = parser.prefix
            const [name, pattern] = p instanceof Array ? p : [p, null]

            this.parsers[name] = parser
            if (pattern) this.patterns[name] = pattern
        }
    }

    parse(stream: TokenStream): AstNode {
        const token = stream.syntax(this.patterns).peek()

        if (token) {
            const parser = this.parsers[token.type]
            if (parser) {
                if (!parser.consume) return parser.parse(stream)

                stream.next()
                const node = parser.parse(stream)
                return set_location(node, token.location)
            }
        }

        const patternKeys = Object.keys(this.patterns)
        const node = stream.peek()
        throw node
            ? set_location(new UnexpectedToken(node, patternKeys), node)
            : set_location(
                  new UnexpectedEOF(),
                  stream.tokens[stream.tokens.length - 1],
              )
    }
}

export class AlternativeParser {
    parsers: Parser<AstNode>[]

    constructor(parsers: Parser<AstNode>[]) {
        this.parsers = parsers
    }

    parse(stream: TokenStream): AstNode {
        const errors: InvalidSyntax[] = []

        for (let parser of this.parsers) {
            const { result, err } = stream.checkpoint((commit) => {
                const result = parser.parse(stream)
                commit()
                return result
            })
            if (result) return result
            if (err) errors.push(err)
        }

        if (errors.length) throw errors[errors.length - 1]
        throw new ParseError("No alternatives matched.")
    }
}

export class RootParser {
    parser: Parser<AstNode>

    opening_pattern: string | null
    closing_pattern: string
    patterns: { [name: string]: string }

    constructor(
        parser: Parser<AstNode>,
        opening: TokenPattern | null = null,
        closing: TokenPattern = "eof",
    ) {
        this.parser = parser
        this.patterns = { semicolon: ";" }

        if (opening instanceof Array) {
            const [name, pattern] = opening
            this.patterns[name] = pattern
            this.opening_pattern = name
        } else {
            this.opening_pattern = opening
        }

        if (closing instanceof Array) {
            const [name, pattern] = closing
            this.patterns[name] = pattern
            this.closing_pattern = name
        } else {
            this.closing_pattern = closing
        }
    }

    parse(stream: TokenStream) {
        stream = stream.intercept([this.closing_pattern])

        const p = stream.peek()
        const start_location = p ? p.location : SourceLocation.initial

        const patterns = { ...this.patterns, comment: Patterns.comment }
        const ignore = ["comment", "multiline_comment", "whitespace", "newline"]
        return stream.syntax(patterns, () =>
            stream.ignore(ignore, () => {
                const children: AstNode[] = []

                if (this.opening_pattern) {
                    stream.expect(this.opening_pattern)
                }
                let closing: Token | null = null

                let token = stream.peek()
                while (token) {
                    if (token.type.match(this.closing_pattern)) break

                    const statement = this.parser.parse(stream)
                    children.push(statement)

                    const [_, __, closing_token] = stream
                        .intercept(["newline"])
                        .expect_multiple(
                            "newline",
                            "semicolon",
                            this.closing_pattern,
                        )
                    if (closing_token) {
                        closing = closing_token
                        break
                    }

                    token = stream.peek()
                }

                if (!closing) closing = stream.expect(this.closing_pattern)

                return set_location(
                    new AstRoot({ children }),
                    start_location,
                    closing,
                )
            }),
        )
    }
}

export function parse_identifier(stream: TokenStream) {
    const token = stream.syntax({ identifier: Patterns.identifier }, () => {
        return stream.expect("identifier")
    })
    const node = new AstIdentifier({ value: token.value })
    return set_location(node, token)
}

export class ListParser<T extends AstNode> {
    parser: Parser<T>
    cls: new (...args: any) => AstList<T>

    opening_pattern: string | null
    closing_pattern: string | null
    separator_pattern: string
    patterns: { [name: string]: string }

    constructor(
        parser: Parser<T>,
        cls: new (...args: any) => AstList<T>,
        opening: TokenPattern | null = null,
        closing: TokenPattern | null = null,
        separator: TokenPattern = pattern("comma"),
    ) {
        this.parser = parser
        this.cls = cls
        this.patterns = {}

        if (opening instanceof Array) {
            const [name, pattern] = opening
            this.patterns[name] = pattern
            this.opening_pattern = name
        } else {
            this.opening_pattern = opening
        }

        if (closing instanceof Array) {
            const [name, pattern] = closing
            this.patterns[name] = pattern
            this.closing_pattern = name
        } else {
            this.closing_pattern = closing
        }

        if (separator instanceof Array) {
            const [name, pattern] = separator
            this.patterns[name] = pattern
            this.separator_pattern = name
        } else {
            this.separator_pattern = separator
        }
    }

    parse(stream: TokenStream): AstList<T> {
        const start_location = stream.location
        let end_location: SourceLocation | null = null

        const values: AstNode[] = []

        return stream.syntax(this.patterns, () => {
            const intercepted = stream.intercept(["newline", this.separator_pattern])

            if (this.opening_pattern && !stream.get(this.opening_pattern)) {
                const element = this.parser.parse(stream)
                const node = new this.cls({ values: [element] })
                return set_location(node, element)
            }

            let token = stream.peek()
            while (token) {
                if (token.type === this.closing_pattern) {
                    stream.expect()
                    end_location = token.endLocation
                    break
                }

                const node = this.parser.parse(stream)
                values.push(node)

                const separator = intercepted.get(this.separator_pattern)
                if (!separator) {
                    if (this.closing_pattern) {
                        const end_token = stream.expect(this.closing_pattern)
                        end_location = end_token.endLocation
                    }
                    break
                }

                token = stream.peek()
            }

            if (!end_location) {
                end_location = start_location
                if (values.length) {
                    end_location = values[values.length - 1].endLocation
                }
            }

            const node = new this.cls({ values })
            return set_location(node, start_location, end_location)
        })
    }
}


export class BinaryParser {
    operator: string
    parser: Parser<AstExpression>

    patterns: {[name: string]: string}

    constructor(operator: TokenPattern, parser: Parser<AstExpression>) {
        this.parser = parser;
        
        const [name, pattern] = operator
        this.operator = name
        this.patterns = {}
        this.patterns[name] = pattern
    }

    parse_operands(stream: TokenStream): AstExpression[] {
        const left = this.parser.parse(stream)

        const keyword = stream.syntax(this.patterns, () => stream.get(this.operator))
        if (!keyword) return [left]

        return [left, ...this.parse_operands(stream)]
    }

    parse(stream: TokenStream): AstExpression {
        let [left, ...operands] = this.parse_operands(stream)

        if (!operands.length) return left

        let right: AstExpression
        [right, ...operands] = operands

        let result = set_location(
            new AstBinary({op: this.operator, left, right}),
            left,
            right
        )
        for (const operand of operands) {
            result = set_location(
                new AstBinary({op: this.operator, left: result, right: operand}),
                result,
                operand
            )
        }
        return result
    }
}


export class UnaryParser {
    operators: string[]
    parser: Parser<AstExpression>

    patterns: {[name: string]: string}

    constructor(operators: TokenPattern[], parser: Parser<AstExpression>) {
        this.parser = parser;
        
        this.operators = []
        this.patterns = {}

        for (const operator of operators) {
            const [name, pattern] = operator

            this.operators.push(name)
            this.patterns[name] = pattern
        }
    }
    
    parse(stream: TokenStream): AstExpression {
        const keyword = stream.syntax(this.patterns, () => stream.get(...this.operators))
        if (!keyword) return this.parser.parse(stream)

        const value = this.parse(stream)

        return set_location(
            new AstUnary({op: keyword.type, value}),
            keyword,
            value
        )
    }
}


export function parse_string(stream: TokenStream): AstString {
    const [quote, singlequote] = stream.expect_multiple("quote", "singlequote")
    const opening = (quote ?? singlequote) as Token

    let escape_chars: { [char: string]: string } = {
        n: "\n",
        "\\": "\\",
    }
    escape_chars[opening.value] = opening.value
    const escaped_pattern = Object.keys(escape_chars).join("|").replace("\\", "\\\\")

    const patterns = {
        quote: quote ? '"' : null,
        singlequote: singlequote ? "'" : null,
        backslash: "\\\\",
        text: `[^\\n\\\\${opening.value}]+`,
    }
    return stream.syntax(patterns, () =>
        stream.intercept(["whitespace", "newline"], () => {
            let value = ""

            let closing
            while (true) {
                const token = stream.get("backslash", "text", opening.type)
                if (!token) {
                    throw set_location(
                        new InvalidSyntax(`Unterminated string literal.`),
                        opening,
                    )
                }

                if (token.match("backslash")) {
                    const char = stream.syntax(
                        { escaped_char: escaped_pattern },
                        () => stream.expect("escaped_char"),
                    )
                    value += escape_chars[char.value]
                } else if (token.match("text")) {
                    value += token.value
                } else {
                    break
                }
            }

            return set_location(new AstString({ value }), opening, closing)
        }),
    )
}

export function parse_print_statement(stream: TokenStream) {
    const print_keyword = stream.get("print")
    const string = delegate("string", stream) as AstString

    return set_location(
        new AstPrint({ message: string }),
        print_keyword ?? string,
        string,
    )
}

export function parse_test_statement(stream: TokenStream): AstTest {
    const keyword = stream.get("test")
    const target = delegate("identifier", stream) as AstIdentifier

    const entries = delegate("expression:list:string", stream) as AstList<AstString>

    return set_location(new AstTest({ target, entries }), keyword ?? target, entries)
}

export function parse_initial_state(stream: TokenStream) {
    const value = delegate("state", stream) as AstIdentifier
    return set_location(new AstInitialState({ value }), value)
}

export function parse_final_states(stream: TokenStream) {
    const list = delegate("state_list", stream) as AstStateList
    return set_location(new AstFinalState({ list }), list)
}

export function parse_finite_transition(stream: TokenStream) {
    stream = stream.syntax({ colon: ":", arrow: "->" })

    const start = delegate("state", stream) as AstIdentifier
    const condition = delegate("char_condition", stream)
    stream.expect("arrow")
    const end = delegate("state", stream) as AstIdentifier

    const node = new AstTransition({ start, end, condition })
    return set_location(node, start, end)
}

export function parse_finite_automaton(stream: TokenStream) {
    const keyword = stream.get("finite")
    const name = delegate("identifier", stream) as AstIdentifier

    if (stream.get("equals")) {
        const expression = delegate("expression", stream)

        return set_location(
            new AstAutomatonAssignment({type: "finite", target: name, expression}),
            keyword ??
            name, expression
        )
    }

    const body = delegate("root", stream) as AstRoot

    const node = new AstFiniteAutomaton({ name, body })
    return set_location(node, keyword ?? name, body)
}

export function parse_char_condition(stream: TokenStream): AstIdentifier | AstChar {
    stream = stream.syntax({
        unquoted_char: "[a-zA-Z0-9]\\b",
        quote: '"',
        identifier: Patterns.identifier,
    })

    const [unquoted_char, quote, identifier] = stream.expect_multiple(
        "unquoted_char",
        "quote",
        "identifier",
    )

    let node

    if (unquoted_char) {
        node = set_location(
            new AstChar({ value: unquoted_char.value }),
            unquoted_char,
        )
    } else if (quote) {
        node = stream.intercept(["whitespace", "newline"], () => {
            const quoted_char = stream.syntax({ char: '[^\\n\\r\\t"]+' }, () =>
                stream.get("char"),
            )
            const closing_quote = stream.expect("quote")

            return set_location(
                new AstChar({ value: quoted_char ? quoted_char.value : "" }),
                quote,
                closing_quote,
            )
        })
    } else {
        // prettier-ignore
        node = set_location(
            // @ts-ignore
            new AstIdentifier({ value: identifier.value }), identifier,
        )
    }

    return node
}

export function parse_pushdown_automaton(stream: TokenStream) {
    const keyword = stream.get("pushdown")
    const target = delegate("identifier", stream) as AstIdentifier

    let stacks: AstStackList
    if (stream.get("stacks")) {
        stacks = delegate("turing:tapes", stream) as AstStackList
    }
    else {
        stacks = new AstStackList({values: [new AstIdentifier({value: "S"})]})
    }
    
    const body = delegate("pushdown:root", stream) as AstRoot

    const node = new AstPushdownAutomaton({ target, stacks, body })
    return set_location(node, keyword ?? target, body)
}

export function parse_pushdown_transition(stream: TokenStream) {
    stream = stream.syntax({ arrow: "->" })

    const start = delegate("state", stream) as AstIdentifier

    stream.intercept(["whitespace"]).expect("whitespace")

    const condition = delegate("turing:char", stream) as AstTuringCharList
    const pop = delegate("turing:chars", stream) as AstTuringCharList

    stream.expect("arrow")

    const end = delegate("state", stream) as AstIdentifier
    const push = delegate("turing:chars", stream) as AstTuringCharList

    return set_location(
        new AstPushdownTransition({ start, condition,  pop, end, push }),
        start,
        push,
    )
}


export function parse_turing_machine(stream: TokenStream) {
    const target = delegate("identifier", stream) as AstIdentifier

    let tapes: AstList<AstIdentifier>
    if (stream.get("tapes")) {
        tapes = delegate("turing:tapes", stream) as AstList<AstIdentifier>
    }
    else {
        tapes = new AstList({values: [new AstIdentifier({value: "I"})]})
    }

    const body = delegate("turing:root", stream) as AstRoot

    const node = new AstTuringMachine({ target, tapes, body })
    return set_location(node, target, body)
}

export function parse_turing_transition(stream: TokenStream) {
    stream = stream.syntax({ arrow: "->" })

    const start = delegate("state", stream) as AstIdentifier
    stream.intercept(["whitespace"]).expect("whitespace")
    const condition = delegate("turing:chars", stream) as AstTuringCharList
    stream.expect("arrow")
    const end = delegate("state", stream) as AstIdentifier
    const write = delegate("turing:chars", stream) as AstTuringCharList
    const shift = delegate("turing:shift", stream) as
        | AstTuringShiftChar
        | AstTuringShiftCharList

    return set_location(
        new AstTuringTransition({ start, condition, end, write, shift }),
        start,
        shift,
    )
}

export function parse_turing_shift_char(stream: TokenStream) {
    return stream.syntax({ shift_char: Patterns.shift_char }, () => {
        const token = stream.expect("shift_char")
        const value = token.value as TuringShiftChar
        return set_location(new AstTuringShiftChar({ value }), token)
    })
}

export function parse_turing_named_shift_char(stream: TokenStream) {
    return stream.syntax({ colon: Patterns.colon }, () => {
        const name = delegate("identifier", stream) as AstIdentifier
        stream.expect("colon")
        const char = delegate("turing:shift:char", stream) as AstTuringShiftChar

        return set_location(
            new AstTuringNamedShiftChar({ tape: name, value: char.value }),
            name,
            char,
        )
    })
}

export function parse_named_char_condition(stream: TokenStream) {
    return stream.syntax({ colon: Patterns.colon }, () => {
        const tape = delegate("identifier", stream) as AstIdentifier
        stream.expect("colon")
        const char = delegate("turing:char", stream)

        if (!(char instanceof AstChar))
            throw set_location(
                new InvalidSyntax(
                    `Invalid named char value. Only literal chars allowed.`,
                ),
                char,
            )

        return set_location(new AstTuringNamedChar({ tape, char }), tape, char)
    })
}

export function parse_turing_special_char(stream: TokenStream) {
    const patterns = { caret: "\\^", dollar_sign: "\\$" }
    return stream.syntax(patterns, () => {
        const [caret, dollar_sign] = stream.expect_multiple("caret", "dollar_sign")

        if (caret) {
            return set_location(new AstStartLocationChar({ value: "^" }), caret)
        }
        return set_location(
            new AstEndLocationChar({ value: "$" }),
            dollar_sign as Token,
        )
    })
}

export function parse_turing_chars(stream: TokenStream): AstTuringCharList {
    return stream.syntax(
        { opening_square_bracket: Patterns.opening_square_bracket },
        () => {
            const { result } = stream.checkpoint(() =>
                stream.get("opening_square_bracket"),
            )
            if (result) {
                return delegate("turing:chars:list", stream) as AstTuringCharList
            }

            const char = delegate("turing:chars:single", stream)

            if (!(char instanceof AstChar))
                throw set_location(new InvalidSyntax(`Invalid char value.`), char)

            return set_location(new AstTuringCharList({ values: [char] }), char)
        },
    )
}

export function parse_primary_expression(stream: TokenStream) {
    const parens = stream.get("opening_parens")

    if (parens) {
        const expression = delegate("expression", stream)
        const closing_parens = stream.expect("closing_parens")

        return set_location(expression, parens, closing_parens)
    }

    return delegate("identifier", stream)
}

export function parse_grammar(stream: TokenStream) {
    const keyword = stream.get("grammar")
    const target = delegate("identifier", stream) as AstIdentifier

    let start_symbol = new AstIdentifier({value: "S"})
    if (stream.get("start")) {
        start_symbol = delegate("identifier", stream) as AstIdentifier    
    }

    const body = delegate("grammar:root", stream) as AstRoot

    return set_location(new AstGrammar({target, start_symbol, body}), keyword ?? target, body)
}

export function parse_grammar_rule(stream: TokenStream) {
    stream = stream.syntax({ arrow: "->" })

    const head = delegate("grammar:sequence", stream) as AstGrammarSequence
    stream.expect("arrow")
    const expression = delegate("grammar:expression", stream) as AstGrammarExpression

    return set_location(new AstGrammarRule({head, expression}), head, expression)
}

export function parse_grammar_alternative(stream: TokenStream) {
    const values: AstGrammarExpression[] = []

    while (true) {
        const value = delegate("grammar:sequence", stream) as AstGrammarExpression
        values.push(value)

        if (!stream.get("separation_bar")) break
    }

    return set_location(new AstGrammarAlternative({values}), values[0], values[values.length - 1])
}

export function parse_grammar_sequence(stream: TokenStream) {    
    const patterns = {
        opening_angle_bracket: "<",
        closing_angle_bracket: ">",
        nonterminal_symbol: "[A-Z]",
        terminal_symbol: "[a-z0-9]+",
        escaped_terminal: String.raw`\\.`,
    }
    return stream.syntax(patterns, () => {
        const sequence: SentencialSequence = []

        const {result: string} = stream.checkpoint(commit => {
            const string = delegate("string", stream) as AstString
            commit()
            return string
        })
        if (string) {
            const symbol = new Terminal(string.value)
            return set_location(new AstGrammarSequence({value: [symbol]}), string)
        }
        
        const [
            opening_angle_bracket,
            nonterminal_symbol,
            terminal_symbol,
            escaped_terminal
        ] = stream.expect_multiple(
            "opening_angle_bracket",
            "nonterminal_symbol",
            "terminal_symbol",
            "escaped_terminal",
        )
        stream = stream.intercept(["newline"])

        let start = (
            opening_angle_bracket ??
            nonterminal_symbol ??
            terminal_symbol ??
            escaped_terminal
        ) as Token
        let end = start

        let token: Token | null = start
        while (token) {
            if (token.type === "opening_angle_bracket") {
                const identifier = delegate("identifier", stream) as AstIdentifier

                if (!stream.get("closing_angle_bracket")) throw set_location(
                    new InvalidSyntax(`Unclosed non-terminal variable.`),
                    token,
                )

                sequence.push(new NonTerminal(identifier.value))
            }
            else if (token.type === "nonterminal_symbol") {
                sequence.push(new NonTerminal(token.value))
            }
            else if (token.type === "escaped_terminal") {
                sequence.push(new Terminal(token.value[1]))
            }
            else {
                sequence.push(new Terminal(token.value))
            }

            end = token
            token = stream.get(
                "opening_angle_bracket",
                "nonterminal_symbol",
                "terminal_symbol",
                "escaped_terminal",
            )
        }

        return set_location(new AstGrammarSequence({value: sequence}), start, end)
    })
}
