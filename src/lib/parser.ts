
import { InvalidSyntax, UnexpectedToken, type TokenStream, UnexpectedEOF, type TokenPattern } from './tokenstream';

import {AstAutomataDefinition, AstChar, AstFinalState, AstIdentifier, AstInitialState, AstNode, AstRoot, AstStateList, AstTransition} from './ast';
import { Token, set_location } from './tokenstream';
import {ParseError} from './error';

const PATTERNS = {
    identifier: "[a-zA-Z_][a-zA-Z0-9_]*",
}

export function get_default_parsers(): {[key: string]: Parser} {
    return {
        "identifier": new CallParser(parse_identifier),
        "state": delegate("identifier"),
        "state_list": new CallParser(parse_state_list),
        "root": new CallParser(parse_root),
        "statement": new ChooseParser(
            new InitialStatementParser(),
            new FinalStatementParser(),
            new DefineStatementParser(),
            new TransitionStatementParser(),
        ),
        "transition:condition": new CallParser(parse_transition_condition)
    }
}

export interface Parser {
    parse(stream: TokenStream): AstNode;
}


export function delegate(parserName: string): Parser;
export function delegate(parserName: string, stream: TokenStream): AstNode;
export function delegate(parserName: string, stream: TokenStream | null = null) {
    function f(stream: TokenStream) {
        const parser: Parser = stream.data.parsers[parserName];
        return parser.parse(stream);
    }

    if (stream) return f(stream);

    return new CallParser(f);
}

export class CallParser {
    parse: (stream: TokenStream) => AstNode;
    
    constructor(callback: (stream: TokenStream) => AstNode) {
        this.parse = callback;
    }
}

export class KeywordParser {
    parsers: { [name: string]: Parser; };
    patterns: { [pattern: string]: string; };

    constructor(parsers: {[keyword: string]: Parser}) {
        this.parsers = {};
        this.patterns = {};

        for (let [key, parser] of Object.entries(parsers)) {
            this.add(key, parser);
        }
    }

    add(key: string, parser: Parser) {
        this.parsers[key] = parser;
        this.patterns[key] = key + "\\b";
    }

    parse(stream: TokenStream) {
        const token = stream.syntax(this.patterns, () => (
            stream.expect_any(...Object.keys(this.patterns)) 
        ));
        const parser = this.parsers[token.type];
        const node = parser.parse(stream);
        
        return set_location(node, token);
    }
}

export interface ChoosableParser extends Parser {
    prefix: [string, string];
}

export class ChooseParser {
    parsers: {[name: string]: ChoosableParser};
    patterns: {[name: string]: string};

    constructor(...options: ChoosableParser[]) {
        this.parsers = {}
        this.patterns = {}
        this.addOptions(...options);
    }
    
    addOptions(...options: ChoosableParser[]) {
        for (let parser of options) {
            const [name, pattern] = parser.prefix;
            this.parsers[name] = parser;
            this.patterns[name] = pattern;
        }
    }

    parse(stream: TokenStream): AstNode {
        const patternKeys = Object.keys(this.patterns);

        const token = stream.syntax(this.patterns).peek();

        if (token) {
            const parser = this.parsers[token.type]
            if (parser) {
                return parser.parse(stream);
            }
        }

        const node = stream.peek();
        throw node ? new UnexpectedToken(node, patternKeys) : new UnexpectedEOF();
    }
}


export class AlternativeParser {
    parsers: Parser[];

    constructor(parsers: Parser[]) {
        this.parsers = parsers;
    }

    parse(stream: TokenStream): AstNode {
        const errors: InvalidSyntax[] = [];

        for (let parser of this.parsers) {
            const {result, err} = stream.checkpoint((commit) => {
                const result = parser.parse(stream);
                commit();
                return result;
            });
            if (result) return result;
            if (err) errors.push(err);
        }

        if (errors.length) throw errors[errors.length - 1];
        throw new ParseError("No alternatives matched.");
    }
}


export function parse_root(stream: TokenStream) {
    const patterns = {
        opening_bracket: "\\{", closing_bracket: "\\}", semicolon: ";"
    };
    const node = stream.syntax(patterns, () => {
        const children: AstNode[] = [];

        const opening = stream.expect("opening_bracket");
        let closing: Token | null = null;
        
        let token = stream.peek();
        while (token) {
            if (token.type == "closing_bracket") break;
            
            const statement = delegate("statement", stream);
            children.push(statement);

            const intercepted = stream.intercept(["newline", "eof"]);
            const [_, __, closing_bracket, ___] = intercepted.expect_multiple(
                "newline", "semicolon", "closing_bracket", "eof",
            );
            if (closing_bracket) {
                closing = closing_bracket;
                break;
            }

            token = stream.peek();
        }

        if (!closing) closing = stream.expect("closing_bracket");

        return set_location(new AstRoot({children}), opening, closing);
    });

    return node;
}

export function parse_identifier(stream: TokenStream) {
    const token = stream.syntax({identifier: PATTERNS.identifier}, () => {
        return stream.expect("identifier");
    });
    const node = new AstIdentifier({value: token.value});
    return set_location(node, token);
}

export function parse_state_list(stream: TokenStream) {
    stream = stream.syntax({comma: ","});

    const values: AstIdentifier[] = [];

    const token = stream.peek();
    while (token) {
        const node = delegate("state", stream) as AstIdentifier;
        values.push(node);

        const comma = stream.intercept(["newline"]).get("comma");
        if (!comma) break;
    }

    const node = new AstStateList({values});
    return set_location(node, values[0], values[values.length - 1]);
}

export class InitialStatementParser {
    prefix: TokenPattern = ["initial", "initial\\b"];

    parse(stream: TokenStream) {
        stream = stream.syntax({initial: "initial\\b"});
        const keyword = stream.expect("initial");
        const value = delegate("state", stream) as AstIdentifier;
        return set_location(new AstInitialState({value}), keyword, value);
    }
}

export class FinalStatementParser {
    prefix: TokenPattern = ["final", "final\\b"];

    parse(stream: TokenStream) {
        stream = stream.syntax({final: "final\\b"});
        const keyword = stream.expect("final");
        const list = delegate("state_list", stream) as AstStateList;
        return set_location(new AstFinalState({list}), keyword, list);
    }
}

export class TransitionStatementParser {
    prefix: TokenPattern = ["identifier", PATTERNS.identifier]

    parse(stream: TokenStream) {
        stream = stream.syntax({colon: ":", arrow: "->"});

        const start = delegate("state", stream) as AstIdentifier;
        stream.expect("colon");
        const condition = delegate("transition:condition", stream);
        stream.expect("arrow");
        const end = delegate("state", stream) as AstIdentifier;

        const node = new AstTransition({start, end, condition})
        return set_location(node, start, end);
    }
}


export class DefineStatementParser {
    prefix: TokenPattern = ["define", "define\\b"];

    parse(stream: TokenStream) {
        stream = stream.syntax({define: "define\\b"});

        const keyword = stream.expect("define");
        const name = delegate("identifier", stream) as AstIdentifier;
        const body = delegate("root", stream) as AstRoot;

        const node = new AstAutomataDefinition({name, body})
        return set_location(node, keyword, body);
    }
}

export function parse_transition_condition(stream: TokenStream): AstNode {
    stream = stream.syntax({
        unquoted_char: "[a-zA-Z0-9]\\b",
        quote: "\"",
        identifier: PATTERNS.identifier
    });

    const [unquoted_char, quote, identifier] = stream.expect_multiple(
        "unquoted_char", "quote", "identifier"
    );

    let node;

    if (unquoted_char) {
        node = new AstChar({value: unquoted_char.value});
    }
    else if (quote) {
        const quoted_char = stream.intercept(["whitespace", "newline"], () => {
            const quoted_char = stream.syntax({char: "\\S"}, () => stream.get("char"));
            stream.expect("quote");
            return quoted_char;
        }); 
        node = new AstChar({value: quoted_char ? quoted_char.value : ""});
    }
    else {
        // @ts-ignore
        node = new AstIdentifier({value: identifier.value});
    }

    return node
}