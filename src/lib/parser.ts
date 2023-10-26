
import { InvalidSyntax, UnexpectedToken, type TokenStream, UnexpectedEOF, type TokenPattern, SourceLocation } from './tokenstream';

import {AstFiniteAutomaton, AstChar, AstFinalState, AstIdentifier, AstInitialState, AstNode, AstRoot, AstStateList, AstTransition, AstList, AstTuringMachine, AstTuringCharList, AstTuringShiftCharList, AstTuringTransition, AstTuringShiftChar, AstTuringNamedChar, AstTuringNamedShiftChar, AstStartLocationChar, AstEndLocationChar, AstTapeList} from './ast';
import { Token, set_location } from './tokenstream';
import {ParseError} from './error';
import type { TuringShiftChar } from './automaton';


export enum Patterns {
    finite = "finite\\b",
    initial = "initial\\b",
    final = "final\\b",
    turing = "turing\\b",
    tapes = "tapes\\b",

    opening_bracket = "\\{",
    closing_bracket = "\\}",
    opening_square_bracket = "\\[",
    closing_square_bracket = "\\]",
    semicolon = ";",
    colon = ":",
    comma = ",",
    comment = "//.*",
    multiline_comment = "/\\*[\\s\\S]*?\\*/",

    shift_char = ">|<|-",

    word = "\\w+",
    identifier = "[a-zA-Z_][a-zA-Z0-9_]*",
    symbol = "\\S",
}

export function pattern(name: keyof typeof Patterns): TokenPattern {
    return [name, Patterns[name]];
}


export function get_default_parsers(): {[key: string]: Parser} {
    return {
        "identifier": new CallParser(parse_identifier),
        "state": delegate("identifier"),
        "state_list": new ListParser(delegate("state"), AstStateList),
        "char_condition": new CallParser(parse_char_condition),

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
            option(pattern("turing"), delegate("turing"), true),
            option(pattern("identifier"), delegate("transition")),
        ),

        "transition": new CallParser(parse_finite_transition),

        "turing": new CallParser(parse_turing_machine),
        "turing:tape": delegate("identifier"),
        "turing:tapes" : new ListParser(
            delegate("turing:tape"),
            AstTapeList,
            pattern("opening_square_bracket"),
            pattern("closing_square_bracket")
        ),
        "turing:root": new RootParser(
            delegate("turing:statement"),
            pattern("opening_bracket"),
            pattern("closing_bracket"),
        ),
        "turing:statement": new ChooseParser(
            option(pattern("initial"), new CallParser(parse_initial_state), true),
            option(pattern("final"), new CallParser(parse_final_states), true),
            option(pattern("finite"), new CallParser(parse_finite_automaton), true),
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
        "turing:shift": new ChooseParser(
            option(pattern("opening_square_bracket"), delegate("turing:shift:list")),
            option(pattern("shift_char"), delegate("turing:shift:single")),
        ),
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
    }
}

export interface Parser {
    parse(stream: TokenStream): AstNode;
}


export function delegate(parserName: string): Parser;
export function delegate(parserName: string, stream: TokenStream): AstNode;
export function delegate(parserName: string, stream: TokenStream | null = null) {
    function delegated(stream: TokenStream) {
        const parser: Parser = stream.data.parsers[parserName];
        if (parser === undefined) {
            throw new Error(`Parser '${parserName}' is undefined.`);
        }
        return parser.parse(stream);
    }
    
    if (stream) return delegated(stream);

    return new CallParser(delegated);
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
                return set_location(node, token.location)
            }
        }
        
        const patternKeys = Object.keys(this.patterns);
        const node = stream.peek();
        throw node ? set_location(new UnexpectedToken(node, patternKeys), node) :
                     set_location(new UnexpectedEOF(), stream.tokens[stream.tokens.length - 1]);
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
        const ignore = ["comment", "multiline_comment", "whitespace", "newline"];
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



export class ListParser<T extends AstList<AstNode>> {
    parser: Parser;
    cls: new (...args: any) => T;

    opening_pattern: string | null;
    closing_pattern: string | null;
    separator_pattern: string;
    patterns: {[name: string]: string};

    constructor(
        parser: Parser,
        cls: new (...args: any) => T,
        opening: TokenPattern | null = null,
        closing: TokenPattern | null = null,
        separator: TokenPattern = pattern("comma")
    ) {
        this.parser = parser;
        this.cls = cls;
        this.patterns = {};

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

        if (separator instanceof Array) {
            const [name, pattern] = separator;
            this.patterns[name] = pattern;
            this.separator_pattern = name;
        }
        else {
            this.separator_pattern = separator;
        }
    }

    parse(stream: TokenStream): T {    
        const start_location = stream.location;
        let end_location: SourceLocation | null = null;

        const values: AstNode[] = [];

        return stream.syntax(this.patterns, () => {
            const intercepted = stream.intercept(["newline", this.separator_pattern]);

            if (this.opening_pattern) stream.expect(this.opening_pattern);
            
            let token = stream.peek();
            while (token) {
                if (token.type === this.closing_pattern) {
                    stream.expect();
                    end_location = token.endLocation;
                    break;
                }

                const node = this.parser.parse(stream);
                values.push(node);
                
                const separator = intercepted.get(this.separator_pattern);
                if (!separator) {
                    if (this.closing_pattern) {
                        const end_token = stream.expect(this.closing_pattern);
                        end_location = end_token.endLocation;
                    }
                    break;
                };

                token = stream.peek();
            }

            if (!end_location) {
                end_location = start_location;
                if  (values.length) {
                    end_location = values[values.length - 1].endLocation;
                }
            }
            
            const node = new this.cls({values});
            return set_location(node, start_location, end_location);
        });
    }
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
    const condition = delegate("char_condition", stream);
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

export function parse_char_condition(stream: TokenStream): AstIdentifier | AstChar {
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
        node = set_location(
            new AstChar({value: unquoted_char.value}),
            unquoted_char
        );
    }
    else if (quote) {
        node = stream.intercept(["whitespace", "newline"], () => {
            const quoted_char = stream.syntax({char: '[^\\s"]'}, () => stream.get("char"));
            const closing_quote = stream.expect("quote");

            return set_location(
                new AstChar({value: quoted_char ? quoted_char.value : ""}),
                quote,
                closing_quote
            );
        });
    }
    else {
        node = set_location(
            // @ts-ignore
            new AstIdentifier({value: identifier.value}), identifier
        );
    }

    return node
}


export function parse_turing_machine(stream: TokenStream) {
    const target = delegate("identifier", stream) as AstIdentifier;
    stream.expect("tapes");
    const tapes = delegate("turing:tapes", stream) as AstList<AstIdentifier>;
    const body = delegate("turing:root", stream) as AstRoot;

    const node = new AstTuringMachine({target, tapes, body})
    return set_location(node, target, body);
}

export function parse_turing_transition(stream: TokenStream) {
    stream = stream.syntax({arrow: "->"});

    const start = delegate("state", stream) as AstIdentifier;
    stream.intercept(["whitespace"]).expect("whitespace");
    const condition = delegate("turing:chars", stream) as AstTuringCharList;
    stream.expect("arrow");
    const end = delegate("state", stream) as AstIdentifier;
    const write = delegate("turing:chars", stream) as AstTuringCharList;
    const shift = delegate("turing:shift", stream) as AstTuringShiftChar | AstTuringShiftCharList;

    return set_location(
        new AstTuringTransition({start, condition, end, write, shift}),
        start,
        shift
    );
}


export function parse_turing_shift_char(stream: TokenStream) {
    return stream.syntax({shift_char: Patterns.shift_char}, () => {
        const token = stream.expect("shift_char");
        const value = token.value as TuringShiftChar;
        return set_location(new AstTuringShiftChar({value}), token)
    });
}

export function parse_turing_named_shift_char(stream: TokenStream) {
    return stream.syntax({colon: Patterns.colon}, () => {
        const name = delegate("identifier", stream) as AstIdentifier;
        stream.expect("colon");
        const char = delegate("turing:shift:char", stream) as AstTuringShiftChar;

        return set_location(
            new AstTuringNamedShiftChar({tape: name, value: char.value}), name, char
        );
    });
}


export function parse_named_char_condition(stream: TokenStream) {
    return stream.syntax({colon: Patterns.colon}, () => {
        const tape = delegate("identifier", stream) as AstIdentifier;
        stream.expect("colon");
        const char = delegate("turing:char", stream);

        if (!(char instanceof AstChar)) throw set_location(
            new InvalidSyntax(
                `Invalid named char value. Only literal chars allowed.`
            ),
            char
        );

        return set_location(
            new AstTuringNamedChar({tape, char}), tape, char
        );
    });
}

export function parse_turing_special_char(stream: TokenStream) {
    const patterns = {caret: "\\^", dollar_sign: "\\$"};
    return stream.syntax(patterns, () => {
        const [caret, dollar_sign] = stream.expect_multiple("caret", "dollar_sign");

        if (caret) {
            return set_location(new AstStartLocationChar({value: "^"}), caret);
        }
        return set_location(new AstEndLocationChar({value: "$"}), dollar_sign as Token);
    });
}

export function parse_turing_chars(stream: TokenStream): AstTuringCharList {
    return stream.syntax({opening_square_bracket: Patterns.opening_square_bracket}, () => {
        const {result} = stream.checkpoint(() => stream.get("opening_square_bracket"));
        if (result) {
            return delegate("turing:chars:list", stream) as AstTuringCharList;
        }

        const char = delegate("turing:chars:single", stream);

        if (!(char instanceof AstChar)) throw set_location(
            new InvalidSyntax(`Invalid char value.`), char
        );

        return set_location(new AstTuringCharList({values: [char]}), char);
    });
}