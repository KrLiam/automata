import {SourceLocation} from './tokenstream';


export type AstNodeArgs = {
    location?: SourceLocation,
    endLocation?: SourceLocation,
}
export class AstNode {
    location: SourceLocation;
    endLocation: SourceLocation;

    constructor({
        location = SourceLocation.initial,
        endLocation = SourceLocation.initial
    }: AstNodeArgs) {
        this.location = location;
        this.endLocation = endLocation;
    };

    toObject() {
        function convert(value: any) {
            if (value instanceof AstNode) {
                value = value.toObject();
            }
            else if (value instanceof Array) {
                value = [...value]
                for (let i = 0; i < value.length; i++) {
                    value[i] = convert(value[i]);
                }
            }
            return value;
        }

        const properties: any = {};
        for (let key of Object.getOwnPropertyNames(this)) {
            // @ts-ignore
            properties[key] = convert(this[key]);
        }
        return {
            "node": Object.getPrototypeOf(this).constructor.name,
            ...properties
        }
    }
}


export type AstIdentifierArgs = AstNodeArgs & {
    value: string
}
export class AstIdentifier extends AstNode {
    value: string;

    constructor({value, ...args}: AstIdentifierArgs) {
        super(args);
        this.value = value;
    };
}


export type AstStateListArgs = AstNodeArgs & {
    values: AstIdentifier[]
}
export class AstStateList extends AstNode {
    values: AstIdentifier[];

    constructor({values, ...args}: AstStateListArgs) {
        super(args);
        this.values = values;
    };
}


export type AstInitialStateArgs = AstNodeArgs & {
    value: AstIdentifier
}
export class AstInitialState extends AstNode {
    value: AstIdentifier;

    constructor({value, ...args}: AstInitialStateArgs) {
        super(args);
        this.value = value;
    };
}


export type AstFinalStateArgs = AstNodeArgs & {
    list: AstStateList
}
export class AstFinalState extends AstNode {
    list: AstStateList;

    constructor({list, ...args}: AstFinalStateArgs) {
        super(args);
        this.list = list;
    };
}


export type AstRootArgs = AstNodeArgs & {
    children: AstNode[]
}
export class AstRoot extends AstNode {
    children: AstNode[];

    constructor({children, ...args}: AstRootArgs) {
        super(args);
        this.children = children;
    };
}

export class AstModuleRoot extends AstRoot {}