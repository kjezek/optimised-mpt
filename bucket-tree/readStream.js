"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrieReadStream = void 0;
const nibbles_1 = require("./util/nibbles");
const Readable = require('readable-stream').Readable;
class TrieReadStream extends Readable {
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
        await this.trie._findValueNodes(async (nodeRef, node, key, depth, walkController) => {
            // KJ: RESEARCH - added node, depth in the datastructure
            this.push({
                key: nibbles_1.nibblesToBuffer(key),
                value: node.value,
                node: node,
                depth: depth
            });
            await walkController.next();
        });
        this.push(null);
    }
}
exports.TrieReadStream = TrieReadStream;
//# sourceMappingURL=readStream.js.map