import { AstRoot, AstNode } from "./ast";

export class VisitorError extends Error {
    constructor(value: any) {
        super(`Visitor could not match rule for value ${value}. A fallback rule might be missing.`);
    }
}


export function get_class_hierarchy(obj: any): (typeof Object)[] {
    let cls = Object.getPrototypeOf(obj);

    const order = [cls.constructor];
    while (cls.constructor !== Object) {
        cls = Object.getPrototypeOf(cls)
        order.push(cls.constructor)
    }

    return order
}


export type Class<T> = new(...args: any) => T;

export class Rule<T, A, R> {
    cls: Class<T>;
    callback: (value: T, args: A) => R;

    constructor(cls: Class<T>, callback: (value: T, args: A) => R) {
        this.cls = cls;
        this.callback = callback;
    }
}


interface RuleDescriptor<T, A, R> extends PropertyDescriptor {
    value?: (value: T, args: A) => R;
}

export function rule<T extends Y, A, Y, R>(cls: Class<T>) {
    return function rule_decorator(
        target: Visitor<Y, A, R>, name: string, descriptor: RuleDescriptor<T, A, R>
    ) {
        const func = descriptor.value;
        if (func) {
            const rule_obj = new Rule(cls, func);

            const target_cls = <typeof Visitor> target.constructor;
            target_cls.addRule(rule_obj);
        }
    }
}


/**
 * @template T The base type of all visited objects.
 * @template A The argument type that rules receive as second argument.
 * @template R The base type returned by all rules of this visitor.
 */
export class Visitor<T, A, R> {
    static staticRules: Rule<any, any, any>[] | undefined;
    rules: Map<Class<T>, Rule<T, A, R>[]>;

    constructor() {
        this.rules = new Map();

        const cls = <typeof Visitor<T, A, R>> this.constructor;
        if (cls.staticRules) {
            for (const rule of cls.staticRules) {
                this.addRule(new Rule(rule.cls, rule.callback.bind(this)));
            };
        }
    }

    static addRule(...rules: Rule<any, any, any>[]) {
        if (!this.staticRules) {
            this.staticRules = [];
        }
        for (const rule of rules) {
            this.staticRules.push(rule);
        }
    }

    addRule(...rules: Rule<T, A, R>[]) {
        for (const rule of rules) {
            const map_rules = this.rules.get(rule.cls);

            if (!map_rules) {
                this.rules.set(rule.cls, []);
                this.addRule(rule);
                return;
            }
            map_rules.push(rule);

        }
    }

    invoke(value: T, arg: A): R {
        const hierarchy = get_class_hierarchy(value) as any[];

        for (let cls of hierarchy) {
            const rules = this.rules.get(cls);

            if (rules && rules.length) {
                const rule = rules[rules.length - 1];
                return rule.callback(value, arg);
            }
        }

        throw new VisitorError(value);
    }
}