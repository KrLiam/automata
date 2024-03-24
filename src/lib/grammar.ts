
export abstract class SentenceSymbol {
    value: string

    constructor(value: string) {
        this.value = value
    }
}
export class NonTerminal extends SentenceSymbol {}
export class Terminal extends SentenceSymbol {}

export function is_nonterminal(obj: any, value?: string): boolean {
    if (!(obj instanceof NonTerminal)) return false
    if (value !== undefined && obj.value !== value) return false

    return true}

export function is_terminal(obj: any, value?: string): boolean {
    if (!(obj instanceof Terminal)) return false
    if (value !== undefined && obj.value !== value) return false

    return true
}

export function reverse_symbol(symbol: SentenceSymbol) {
    const reversed_value = symbol.value.split("").reverse().join("")

    return is_terminal(symbol) ?
        new Terminal(reversed_value) :
        symbol
}


export type SentencialSequence = (NonTerminal | Terminal)[]
export type Sentence = Terminal[]

export function is_empty_sentence(sentence: SentencialSequence) {
    return sentence.every(symbol => is_terminal(symbol) && symbol.value === "")
}
export function get_sentence_length(sentence: SentencialSequence) {
    return sentence.reduce(
        (acc, symbol) => acc + (is_terminal(symbol) ? symbol.value.length : 1),
        0
    )
}

export class ProductionRule {
    head: SentencialSequence
    results: SentencialSequence[]

    constructor(head: SentencialSequence, ...results: SentencialSequence[]) {
        this.head = head
        this.results = [...results]
    }
}

export enum GrammarType {
    Regular = 3,
    ContextFree = 2,
    ContextSensitive = 1,
    Irrestricted = 0,
}

export class Grammar {
    nonterminals: Set<string>
    terminals: Set<string>
    rules: ProductionRule[]
    start_symbol: string

    constructor(
        rules: Iterable<ProductionRule>,
        start_symbol: string = "S",
        nonterminals: Iterable<string> = [],
        terminals: Iterable<string> = [],
    ) {
        this.rules = [...rules]
        this.start_symbol = start_symbol
        
        const [rule_nonterminals, rule_terminals] = this.get_used_symbols(this.rules)
        this.nonterminals = new Set([...nonterminals, ...rule_nonterminals])
        this.terminals = new Set([...terminals, ...rule_terminals])
    }

    get_used_symbols(rules: Iterable<ProductionRule>): [Set<string>, Set<string>] {
        const nonterminals: string[] = []
        const terminals: string[] = []

        for (const rule of rules) {
            for (const sequence of [rule.head, ...rule.results]) {
                for (const symbol of sequence) {
                    if (is_nonterminal(symbol)) {
                        nonterminals.push(symbol.value)
                    }
                    else {
                        terminals.push(...symbol.value)
                    }
                }
            }
        }

        return [new Set(nonterminals), new Set(terminals)]
    }

    reverse() {
        const rules = []

        for (const rule of this.rules) {
            const head = rule.head.map(reverse_symbol).reverse()
            const results = rule.results.map(
                sequence => sequence.map(reverse_symbol).reverse()
            )

            rules.push(new ProductionRule(head, ...results))
        }

        return new Grammar(rules, this.start_symbol, this.nonterminals, this.terminals)
    }

    get_type(): GrammarType {
        if (this.is_regular()) return GrammarType.Regular
        if (this.is_context_free()) return GrammarType.ContextFree
        if (this.is_context_sensitive()) return GrammarType.ContextSensitive
        return GrammarType.Irrestricted
    }

    is_regular() {
        if (!this.is_context_free()) return false

        function test(grammar: Grammar) {
            for (const rule of grammar.rules) {
                // A -> aA | a

                for (const sequence of rule.results) {
                    // righthand cannot have a single non-terminal symbol
                    if (sequence.length === 1 && is_nonterminal(sequence[0])) {
                        return false
                    }
                    // righthand of two symbols must be in the form <terminal><non-terminal>
                    if (sequence.length === 2) {
                        if (is_nonterminal(sequence[0])) return false
                        if (is_terminal(sequence[1])) return false
                    }
                    if (sequence.length > 2) {
                        return false
                    }
                }
            }

            return true
        }

        // left regular (Aa) or right regular (aA)
        return test(this) || test(this.reverse())
    }

    is_context_free() {
        if (!this.is_context_sensitive()) return false

        for (const rule of this.rules) {            
            const { head } = rule

            // production head must contain a single non-terminal symbol
            if (head.length != 1) return false
            if (is_terminal(head[0])) return false
        }

        return true
    }

    private get_righthand_nonterminals(): Set<string> {
        const nonterminals: string[] = []

        for (const rule of this.rules) {
            for (const sequence of rule.results) {
                for (const symbol of sequence) {
                    if (is_nonterminal(symbol)) nonterminals.push(symbol.value)
                }
            }
        }

        return new Set(nonterminals)
    }

    is_context_sensitive() {
        // grammar can generate empty string only if the start symbol is
        // not in the right hand side of any rule.
        const righthand_nonterminals = this.get_righthand_nonterminals()
        const start_rules = this.rules.filter(
            ({head}) => head.length === 1 && is_nonterminal(head[0], this.start_symbol)
        )
        for (const rule of start_rules) {
            if (
                rule.results.some(sequence => is_empty_sentence(sequence))
                && righthand_nonterminals.has(this.start_symbol)
            ) return false
        }

        // for rules that do not have the start symbol as the only
        // symbol in the production head
        const other_rules = this.rules.filter(rule => !start_rules.includes(rule))
        for (const rule of other_rules) {            
            const { head, results } = rule

            // at least 1 non-terminal symbol in the production head
            if (!head.some(symbol => is_nonterminal(symbol))) return false

            // (A -> B) -> |A| <= |B|
            const head_length = get_sentence_length(head)
            for (const sequence of results) {
                if (head_length > get_sentence_length(sequence)) return false
            }
        }

        return true
    }
}
