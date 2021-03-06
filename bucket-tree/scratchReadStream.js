"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScratchReadStream = void 0;
const Readable = require('readable-stream').Readable;
/*
 * This is used to minimally dump the scratch into the db.
 */
class ScratchReadStream extends Readable {
    constructor(trie) {
        super({ objectMode: true });
        this.trie = trie;
        this._started = false;
    }
    async _read() {
        if (this._started) {
            return;
        }
        this._started = true;
        await this.trie._findDbNodes(async (nodeRef, node, key, walkController) => {
            this.push({
                key: nodeRef,
                value: node.serialize(),
            });
            await walkController.next();
        });
        this.push(null);
    }
}
exports.ScratchReadStream = ScratchReadStream;
//# sourceMappingURL=scratchReadStream.js.map