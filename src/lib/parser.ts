
import { InvalidSyntax, UnexpectedToken, type TokenStream, UnexpectedEOF, type TokenPattern, SourceLocation } from './tokenstream';

import {AstFiniteAutomaton, AstChar, AstFinalState, AstIdentifier, AstInitialState, AstNode, AstRoot, AstStateList, AstTransition} from './ast';
import { Token, set_location } from './tokenstream';
import {ParseError} from './error';


export enum Patterns {
    finite = "finite\\b",
    initial = "initial\\b",
    final = "final\\b",

    opening_bracket = "\\{",
    closing_bracket = "\\}",
    semicolon = ";",
    comment = "//.+",

    word = "\\w+",
    identifier = "[a-zA-Z_][a-zA-Z0-9_]*",
}

export function pattern(name: keyof typeof Patterns): TokenPattern {
    return [name, Patterns[name]];
}


export function get_default_parsers(): {[key: string]: Parser} {
    return {
        "identifier": new CallParser(parse_identifier),
        "state": delegate("identifier"),
        "state_list": new CallParser(parse_state_list),

        "module": new RootParser(delegate("statement")),
        "root": new RootParser(
            delegate("statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket"),
        ),

        "statement": new ChooseParser(
            option(pattern("initial"), new CallParser(parse_initial_state), true),
            option(pattern("final"), new CallParser(parse_final_states), true),
            option(pattern("finite"), new CallParser(parse_finite_automaton), true),
            option(pattern("identifier"), delegate("transition")),
        ),

        "transition": new CallParser(parse_finite_transition),
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
    prefix: TokenPattern;
    consume?: boolean
}

export function option(
    pattern: TokenPattern, parser: Parser, consume: boolean = false
): ChoosableParser {
    return {
        prefix: pattern,
        consume: consume,
        parse: parser.parse.bind(parser)
    }
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
            const p = parser.prefix;
            const [name, pattern] = p instanceof Array ? p : [p, null];

            this.parsers[name] = parser;
            if (pattern) this.patterns[name] = pattern;
        }
    }

    parse(stream: TokenStream): AstNode {
        const token = stream.syntax(this.patterns).peek();

        if (token) {
            const parser = this.parsers[token.type]
            if (parser) {
                if (!parser.consume) return parser.parse(stream);
                
                stream.next();
                const node = parser.parse(stream);
                return set_location(node, token)
            }
        }
        
        const patternKeys = Object.keys(this.patterns);
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


export class RootParser {
    parser: Parser

    opening_pattern: string | null;
    closing_pattern: string;
    patterns: {[name: string]: string};

    constructor(
        parser: Parser,
        opening: TokenPattern | null = null,
        closing: TokenPattern = "eof",
    ) {
        this.parser = parser;
        this.patterns = {semicolon: ";"};

        if (opening instanceof Array) {
            const [name, pattern] = opening;
            this.patterns[name] = pattern;
            this.opening_pattern = name;
        }
        else {
            this.opening_pattern = opening;
        }

        if (closing instanceof Array) {
            const [name, pattern] = closing;
            this.patterns[name] = pattern;
            this.closing_pattern = name;
        }
        else {
            this.closing_pattern = closing;
        }
    }

    parse(stream: TokenStream) {
        const p = stream.peek();
        const start_location = p ? p.location : SourceLocation.initial;

        const patterns = {...this.patterns, comment: Patterns.comment};
        const ignore = ["comment", "whitespace", "newline"];
        return stream.syntax(patterns, () => stream.ignore(ignore, () => {
            const children: AstNode[] = [];
            
            if (this.opening_pattern) {
                stream.expect(this.opening_pattern);
            }
            let closing: Token | null = null;
            
            const intercepted = stream.intercept([this.closing_pattern]);
    
            let token = intercepted.peek();
            while (token) {
                if (token.type.match(this.closing_pattern)) break;
                
                const statement = this.parser.parse(stream);
                children.push(statement);
    
                const [_, __, closing_token] = intercepted.intercept(["newline"]).expect_multiple(
                    "newline", "semicolon", this.closing_pattern
                );
                if (closing_token) {
                    closing = closing_token
                    break;
                }
    
                token = intercepted.peek();
            }
    
            if (!closing) closing = intercepted.expect(this.closing_pattern);
    
            return set_location(new AstRoot({children}), start_location, closing);
        }));
    }
}

export function parse_identifier(stream: TokenStream) {
    const token = stream.syntax({identifier: Patterns.identifier}, () => {
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

export function parse_initial_state(stream: TokenStream) {
    const value = delegate("state", stream) as AstIdentifier;
    return set_location(new AstInitialState({value}), value);
}

export function parse_final_states(stream: TokenStream) {
    const list = delegate("state_list", stream) as AstStateList;
    return set_location(new AstFinalState({list}), list);
}

export function parse_finite_transition(stream: TokenStream) {
    stream = stream.syntax({colon: ":", arrow: "->"});

    const start = delegate("state", stream) as AstIdentifier;
    stream.expect("colon");
    const condition = delegate("transition:condition", stream);
    stream.expect("arrow");
    const end = delegate("state", stream) as AstIdentifier;

    const node = new AstTransition({start, end, condition})
    return set_location(node, start, end);
}


export function parse_finite_automaton(stream: TokenStream) {
    const name = delegate("identifier", stream) as AstIdentifier;
    const body = delegate("root", stream) as AstRoot;

    const node = new AstFiniteAutomaton({name, body})
    return set_location(node, name, body);
}

export function parse_transition_condition(stream: TokenStream): AstNode {
    stream = stream.syntax({
        unquoted_char: "[a-zA-Z0-9]\\b",
        quote: "\"",
        identifier: Patterns.identifier
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