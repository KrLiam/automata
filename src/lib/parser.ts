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
    AstRegex,
    AstRegexChildren,
    AstRegexLiteral,
    AstRegexUnary,
    type AstRegexFragment,
    AstRegexBinary,
    AstReenumerate,
} from "./ast"
import { Token, set_location } from "./tokenstream"
import { ParseError } from "./error"
import { zip, type TuringShiftChar } from "./automaton"
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
    "as",
    "star",
    "reverse",
    "concatenate",
    "minimize",
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
    as = "as\\b",
    star = "star\\b",
    reverse = "reverse\\b",
    concatenate = "concatenate\\b",
    minimize = "minimize\\b",

    opening_parens = "\\(",
    closing_parens = "\\)",
    opening_bracket = "\\{",
    closing_bracket = "\\}",
    opening_square_bracket = "\\[",
    closing_square_bracket = "\\]",
    opening_angle_bracket = "<",
    closing_angle_bracket = ">",

    semicolon = ";",
    colon = ":",
    equals = "=",
    comma = ",",
    quote = '"',
    vertical_bar = "\\|",
    asterisk = "\\*",
    plus = "\\+",
    ampersand = "&",
    dot = "\\.",
    tilde = "~",
    question_mark = "\\?",
    singlequote = "'",
    comment = "//.*",
    multiline_comment = "/\\*[\\s\\S]*?\\*/",

    shift_char = ">|<|-",

    word = "\\w+",
    identifier = "[a-zA-Z_][a-zA-Z0-9_]*",
    symbol = "\\S",

    terminal = "[a-z0-9]",
    uppercase_nonterminal = "[A-Z]",
}

export function pattern(name: keyof typeof Patterns): TokenPattern {
    return [name, Patterns[name]]
}

export function get_default_parsers(): { [key: string]: Parser<AstNode> } {
    return {
        identifier: new CallParser(parse_identifier),
        state: delegate("identifier"),
        state_list: new ListParser(
            delegate("state"),
            AstStateList,
            null,
            null,
            pattern("comma")
        ),
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
            [pattern("union"), pattern("vertical_bar")],
            delegate("expression:intersection"),
            {vertical_bar: "union"}
        ),
        "expression:intersection": new BinaryParser(
            [pattern("intersection"), pattern("ampersand")],
            delegate("expression:concatenate"),
            {ampersand: "intersection"}
        ),
        "expression:concatenate": new BinaryParser(
            [pattern("concatenate"), pattern("dot")],
            delegate("expression:reenumerate"),
            {dot: "concatenate"}
        ),
        "expression:reenumerate": new CallParser(parse_reenumerate),
        "expression:reenumerate:names": new ChooseParser(
            option("quote", delegate("string")),
            option("singlequote", delegate("string")),
            option("opening_square_bracket", delegate("expression:list:string")),
        ),

        "expression:unary": new UnaryParser(
            [
                pattern("complement"),
                pattern("tilde"),
                pattern("determinize"),
                pattern("reenumerate"),
                pattern("star"),
                pattern("reverse"),
                pattern("minimize"),
            ],
            delegate("expression:star"),
            false,
            {tilde: "complement"}
        ),
        "expression:star": new UnaryParser(
            [pattern("asterisk")],
            delegate("expression:primary"),
            true,
            {asterisk: "star"}
        ),
        "expression:primary": new CallParser(parse_primary_expression),

        "regex": new CallParser(parse_regex),
        "regex:alternative": new CallParser(parse_regex_alternative),
        "regex:sequence": new CallParser(parse_regex_sequence),
        "regex:unary": new CallParser(parse_regex_unary),
        "regex:primary": new ChooseParser(
            option(pattern("opening_parens"), delegate("regex:parens")),
            option(null, delegate("regex:literal")),
        ),
        "regex:parens": new CallParser(parse_regex_parens),
        "regex:literal": new CallParser(parse_regex_literal),

        "expression:list:string": new ListParser(
            delegate("string"),
            AstList<AstString>,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
            pattern("comma"),
            false
        ),

        turing: new CallParser(parse_turing_machine),
        "turing:tape": delegate("identifier"),
        "turing:tapes": new ListParser(
            delegate("turing:tape"),
            AstTapeList,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket"),
            pattern("comma"),
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
            pattern("comma"),
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
            pattern("comma")
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
        "grammar:sequence": new CallParser(parse_grammar_sequence),
        "grammar:term": new ChooseParser(
            option(pattern("opening_angle_bracket"), delegate("grammar:explicit_nonterminal")),
            option(pattern("singlequote"), delegate("grammar:quoted_terminal")),
            option(pattern("quote"), delegate("grammar:quoted_terminal")),
            option(pattern("uppercase_nonterminal"), delegate("grammar:uppercase_nonterminal")),
            option(pattern("terminal"), delegate("grammar:terminal")),
        ),
        "grammar:explicit_nonterminal": new CallParser(parse_grammar_explicit_nonterminal),
        "grammar:quoted_terminal": new CallParser(parse_grammar_quoted_terminal),
        "grammar:uppercase_nonterminal": new CallParser(parse_grammar_uppercase_nonterminal),
        "grammar:terminal": new CallParser(parse_grammar_terminal),
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
    pattern: TokenPattern | null,
    parser: Parser<AstNode>,
    consume: boolean = false,
): ChoosableParser {
    return {
        prefix: pattern ?? ["any", "."],
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
    separator_pattern: string | null
    allow_single_element: boolean
    patterns: { [name: string]: string }

    constructor(
        parser: Parser<T>,
        cls: new (...args: any) => AstList<T>,
        opening: TokenPattern | null = null,
        closing: TokenPattern | null = null,
        separator: TokenPattern | null = pattern("comma"),
        allow_single_element: boolean = true,
    ) {
        this.parser = parser
        this.cls = cls
        this.allow_single_element = allow_single_element
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
            const intercepted = stream.intercept([
                "newline",
                ...(this.separator_pattern ? [this.separator_pattern] : [])
            ])

            if (
                this.opening_pattern && !stream.get(this.opening_pattern)
                && this.allow_single_element
            ) {
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

                if (this.separator_pattern) {
                    const separator = intercepted.get(this.separator_pattern)
                    if (!separator) {
                        if (this.closing_pattern) {
                            const end_token = stream.expect(this.closing_pattern)
                            end_location = end_token.endLocation
                        }
                        break
                    }
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
    parser: Parser<AstExpression>
    
    patterns: {[name: string]: string}
    operation_map: {[pattern_name: string]: string}

    constructor(
        operators: TokenPattern[],
        parser: Parser<AstExpression>,
        operation_map: {[pattern_name: string]: string} = {}
    ) {
        this.parser = parser;
        
        this.patterns = {}
        this.operation_map = {...operation_map}

        for (const operator of operators) {
            const [name, pattern] = operator
            this.patterns[name] = pattern
        }
    }

    parse(stream: TokenStream): AstExpression {
        const operands: AstExpression[] = []
        const operators: string[] = []

        while (true) {
            const value = this.parser.parse(stream)
            operands.push(value)
    
            const keyword = stream.syntax(
                this.patterns,
                () => stream.get(...Object.keys(this.patterns))
            )
            if (!keyword) break

            const op = this.operation_map[keyword.type] ?? keyword.type
            operators.push(op)
        }

        if (operands.length === 1) return operands[0]

        let node = operands[0]
        for (let [right, op] of zip(operands.slice(1), operators)) {
            node = set_location(new AstBinary({op, left: node, right,}), node, right)
        }

        return node
    }
}


export class UnaryParser {
    parser: Parser<AstExpression>
    postfix: boolean
    
    operators: string[]
    patterns: {[name: string]: string}
    operation_map: {[pattern_name: string]: string}

    constructor(
        operators: TokenPattern[],
        parser: Parser<AstExpression>,
        postfix: boolean = false,
        operation_map: {[pattern_name: string]: string} = {}
    ) {
        this.parser = parser;
        this.postfix = postfix
        
        this.operators = []
        this.patterns = {}
        this.operation_map = {...operation_map}

        for (const operator of operators) {
            const [name, pattern] = operator

            this.operators.push(name)
            this.patterns[name] = pattern
        }
    }
    
    parse(stream: TokenStream): AstExpression {
        let keyword: Token | null, value: AstExpression
        
        if (this.postfix) {
            value = this.parser.parse(stream)

            keyword = stream.syntax(this.patterns, () => stream.get(...this.operators))
            if (!keyword) return value
        }
        else {
            keyword = stream.syntax(this.patterns, () => stream.get(...this.operators))
            if (!keyword) return this.parser.parse(stream)
    
            value = this.parse(stream)
        }

        const op = this.operation_map[keyword.type] ?? keyword.type
        
        return set_location(
            new AstUnary({op, value}),
            keyword,
            value
        )
    }
}

export function parse_reenumerate(stream: TokenStream): AstExpression {
    let keyword = stream.get("reenumerate")
    if (!keyword) return delegate("expression:unary", stream)

    const value = delegate("expression:unary", stream)

    let names: AstList<AstString> | AstString = new AstString({value: "q"})
    let end: any = null

    if (stream.get("as")) {
        names = delegate("expression:reenumerate:names", stream) as AstList<AstString> | AstString
    }

    return set_location(new AstReenumerate({op: "reenumerate", value, names}), keyword, end ?? keyword)
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

    let location = stream.location
    const token = stream.peek()
    if (token == null) {
        throw set_location(new InvalidSyntax("Expected char condition."), location)
    }

    let node: AstIdentifier | AstChar

    if (token.match("unquoted_char")) {
        stream.next()
        node = set_location(
            new AstChar({ value: token.value }),
            token,
        )
    } else if (token.match("quote")) {
        let string = delegate("string", stream) as AstString
        node = set_location(new AstChar({ value: string.value }), string)
    } else {
        // prettier-ignore
        node = set_location(
            // @ts-ignore
            new AstIdentifier({ value: token.value }), token,
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
    const token = stream.peek()

    if (token?.match("opening_parens")) {
        stream.expect()
        const expression = delegate("expression", stream)
        const closing_parens = stream.expect("closing_parens")

        return set_location(expression, token, closing_parens)
    }

    if (token?.match("opening_angle_bracket")) {
        return delegate("regex", stream)
    }

    return delegate("identifier", stream)
}


export function parse_regex(stream: TokenStream): AstRegex {
    const open_bracket = stream.expect("opening_angle_bracket")

    const children = stream.ignore(["whitespace"], () => 
        delegate("regex:alternative", stream) as AstRegexFragment
    )

    const close_bracket = stream.expect("closing_angle_bracket")

    return set_location(new AstRegex({children}), open_bracket, close_bracket)
}

export function parse_regex_alternative(stream: TokenStream): AstRegexFragment {
    const left = delegate("regex:sequence", stream) as AstRegexFragment

    const operator = stream.get("vertical_bar")
    if (!operator) return left
    
    const right = parse_regex_alternative(stream)

    return set_location(
        new AstRegexBinary({op: "alternative", left, right}),
        left,
        right
    )
}

export function parse_regex_sequence(stream: TokenStream) {
    const closing_patterns = ["vertical_bar", "closing_angle_bracket", "closing_parens"]

    const values: AstRegexFragment[] = []

    stream.peek()
    const location = stream.location

    while (true) {
        const token = stream.peek()
        if (token && closing_patterns.includes(token.type)) break
        
        const value = delegate("regex:unary", stream) as AstRegexFragment
        values.push(value)
    }

    if (values.length === 1) return values[0]

    const end_location = values[values.length - 1] ?? location

    return set_location(
        new AstRegexChildren({values: values}), location, end_location
    )
}

export function parse_regex_unary(stream: TokenStream) {
    const operations: {[pattern: string]: string} = {
        plus: "one_or_more",
        asterisk: "zero_or_more",
        question_mark: "optional",
    }
    
    const value = delegate("regex:primary", stream) as AstRegexFragment

    const operator = stream.get("plus", "asterisk", "question_mark")
    if (!operator) return value

    return set_location(
        new AstRegexUnary({op: operations[operator.type], value}),
        value,
        operator
    )
}

export function parse_regex_parens(stream: TokenStream) {
    stream.expect("opening_parens")
    const value = delegate("regex:alternative", stream)
    stream.expect("closing_parens")

    return value
}

export function parse_regex_literal(stream: TokenStream) {
    return stream.syntax({regex_literal: String.raw`[^\s()*+?|\\]`, backslash: String.raw`\\`}, () => {
        let token: Token

        if (stream.get("backslash")) {
            token = stream.intercept(["whitespace", "newline"], () => stream.syntax({char: "."}, () => {
                return stream.expect("char")
            }))
        }
        else {
            token = stream.expect("regex_literal")
        }

        return set_location(new AstRegexLiteral({value: token.value}), token)
    })
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

        if (!stream.get("vertical_bar")) break
    }

    return set_location(new AstGrammarAlternative({values}), values[0], values[values.length - 1])
}

export function parse_grammar_sequence(stream: TokenStream) {
    const patterns = {
        opening_angle_bracket: Patterns.opening_angle_bracket,
        quote: Patterns.quote,
        singlequote: Patterns.singlequote,
        uppercase_nonterminal: Patterns.uppercase_nonterminal,
        terminal: Patterns.terminal,
    }
    const pattern_keys = Object.keys(patterns)

    return stream.syntax(patterns, () => {
        const start = delegate("grammar:term", stream) as AstGrammarExpression
        stream = stream.intercept(["newline"]).ignore(["whitespace"])
    
        const terms = [start]
    
        let token = stream.peek()
        while (token && pattern_keys.includes(token.type)) {
            const term = delegate("grammar:term", stream) as AstGrammarExpression
            terms.push(term)
    
            token = stream.peek()
        }
    
        const sequence: SentencialSequence = []
        for (const term of terms) {
            if (term instanceof AstGrammarSequence) {
                sequence.push(...term.value)
                continue
            }
    
            throw set_location(
                new InvalidSyntax("Invalid term on grammar rule sequence."), term
            )
        }
    
        return set_location(
            new AstGrammarSequence({value: sequence}),
            terms[0],
            terms[terms.length - 1]
        )
    })
}

export function parse_grammar_explicit_nonterminal(stream: TokenStream) {
    const open = stream.expect("opening_angle_bracket")

    const identifier = delegate("identifier", stream) as AstIdentifier

    const close = stream.get("closing_angle_bracket")
    if (!close) throw set_location(
        new InvalidSyntax(`Unclosed non-terminal variable.`), open,
    )

    const nonterminal = new NonTerminal(identifier.value)
    return set_location(new AstGrammarSequence({value: [nonterminal]}), open, close)
}

export function parse_grammar_quoted_terminal(stream: TokenStream) {
    const string = delegate("string", stream) as AstString
    const terminal = new Terminal(string.value)

    return set_location(new AstGrammarSequence({value:[terminal]}), string)
}

export function parse_grammar_uppercase_nonterminal(stream: TokenStream) {
    const token = stream.syntax({uppercase_nonterminal: Patterns.uppercase_nonterminal}, () =>
        stream.expect("uppercase_nonterminal")
    )
    const nonterminal = new NonTerminal(token.value)

    return set_location(new AstGrammarSequence({value:[nonterminal]}), token)
}

export function parse_grammar_terminal(stream: TokenStream) {
    const token = stream.syntax({terminal: Patterns.terminal}, () => stream.expect("terminal"))
    const terminal = new Terminal(token.value)

    return set_location(new AstGrammarSequence({value:[terminal]}), token)
}
