"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureTrie = void 0;
const ethereumjs_util_1 = require("ethereumjs-util");
const checkpointTrie_1 = require("./checkpointTrie");
/**
 * You can create a secure Trie where the keys are automatically hashed
 * using **keccak256** by using `require('merkle-patricia-tree').SecureTrie`.
 * It has the same methods and constructor as `Trie`.
 * @class SecureTrie
 * @extends Trie
 * @public
 */
class SecureTrie extends checkpointTrie_1.CheckpointTrie {
    constructor(...args) {
        super(...args);
    }
    /**
     * prove has been renamed to [[SecureTrie.createProof]].
     * @deprecated
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static async prove(trie, key) {
        return this.createProof(trie, key);
    }
    /**
     * Creates a proof that can be verified using [[SecureTrie.verifyProof]].
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static createProof(trie, key) {
        const hash = ethereumjs_util_1.keccak256(key);
        return super.createProof(trie, hash);
    }
    /**
     * Verifies a proof.
     * @param {Buffer} rootHash
     * @param {Buffer} key
     * @param {Proof} proof
     * @throws If proof is found to be invalid.
     * @returns The value from the key.
     */
    static async verifyProof(rootHash, key, proof) {
        const hash = ethereumjs_util_1.keccak256(key);
        return super.verifyProof(rootHash, hash, proof);
    }
    /**
     * Returns a copy of the underlying trie with the interface of SecureTrie.
     * @param {boolean} includeCheckpoints - If true and during a checkpoint, the copy will contain the checkpointing metadata and will use the same scratch as underlying db.
     */
    copy(includeCheckpoints = true) {
        const trie = super.copy(includeCheckpoints);
        const db = trie.db.copy();
        return new SecureTrie(db._leveldb, this.root);
    }
    /**
     * Gets a value given a `key`
     * @param {Buffer} key - the key to search for
     * @returns A Promise that resolves to `Buffer` if a value was found or `null` if no value was found.
     */
    async get(key) {
        const hash = ethereumjs_util_1.keccak256(key);
        const value = await super.get(hash);
        return value;
    }
    /**
     * Stores a given `value` at the given `key`.
     * For a falsey value, use the original key to avoid double hashing the key.
     * @param {Buffer} key
     * @param {Buffer} value
     */
    async put(key, val) {
        if (!val || val.toString() === '') {
            await this.del(key);
        }
        else {
            const hash = ethereumjs_util_1.keccak256(key);
            await super.put(hash, val);
        }
    }
    /**
     * Deletes a value given a `key`.
     * @param {Buffer} key
     */
    async del(key) {
        const hash = ethereumjs_util_1.keccak256(key);
        await super.del(hash);
    }
}
exports.SecureTrie = SecureTrie;
//# sourceMappingURL=secure.js.map