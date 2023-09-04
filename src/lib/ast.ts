import {SourceLocation} from './tokenstream';


type AstNodeArgs = {
    location: SourceLocation,
    endLocation: SourceLocation,
}
class AstNode {
    location: SourceLocation;
    endLocation: SourceLocation;

    constructor({location, endLocation}: AstNodeArgs) {
        this.location = location;
        this.endLocation = endLocation;
    };
}


type AstRootArgs = AstNodeArgs & {
    children: AstNode[]
}
class AstRoot extends AstNode {
    children: AstNode[];

    constructor({children = [], ...args}: AstRootArgs) {
        super(args);
        this.children = children;
    };
}

class AstModuleRoot extends AstRoot {}