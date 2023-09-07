
import { InvalidSyntax, type TokenStream } from './tokenstream';

import {AstFinalState, AstIdentifier, AstInitialState, AstNode, AstRoot, AstStateList} from './ast';
import { Token, set_location } from './tokenstream';


export function get_default_parsers(): {[key: string]: Parser} {
    return {
        "identifier": new CallParser(parse_identifier),
        "state": delegate("identifier"),
        "state_list": new CallParser(parse_state_list),
        "root": new CallParser(parse_root),
        "statement": new AlternativeParser([
            new KeywordParser({
                "initial": new CallParser(parse_initial_statement),
                "final": new CallParser(parse_final_statement),
            }),
        ]),
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
    parsers: {[key: string]: Parser};

    constructor(parsers: {[key: string]: Parser}) {
        this.parsers = parsers;
    }

    parse(stream: TokenStream): AstNode {
        const keys = Object.keys(this.parsers)

        let patterns: {[key: string]: string} = {};
        for (let key of keys) {
            patterns[key] = `${key}\\b`;
        }

        const keyword = stream.syntax(patterns, () => {
            const result = stream.expect_multiple(...keys);
            return result.find((v) => v instanceof Token) as Token;
        });


        const parser = this.parsers[keyword.value];
        return set_location(parser.parse(stream), keyword.location);
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
        throw new InvalidSyntax("No alternatives matched.");
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
    const token = stream.syntax({identifier: "[a-zA-Z_][a-zA-Z0-9_]*"}, () => {
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

export function parse_initial_statement(stream: TokenStream) {
    const value = delegate("state", stream) as AstIdentifier;
    return set_location(new AstInitialState({value}), value);
}

export function parse_final_statement(stream: TokenStream) {
    const list = delegate("state_list", stream) as AstStateList;
    return set_location(new AstFinalState({list}), list);
}