"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trie = void 0;
const semaphore_async_await_1 = require("semaphore-async-await");
const ethereumjs_util_1 = require("ethereumjs-util");
const db_1 = require("./db");
const readStream_1 = require("./readStream");
const prioritizedTaskExecutor_1 = require("./prioritizedTaskExecutor");
const nibbles_1 = require("./util/nibbles");
const trieNode_1 = require("./trieNode");
const assert = require('assert');
/**
 * Use `import { BaseTrie as Trie } from 'merkle-patricia-tree'` for the base interface.
 * In Ethereum applications stick with the Secure Trie Overlay `import { SecureTrie as Trie } from 'merkle-patricia-tree'`.
 * The API for the base and the secure interface are about the same.
 * @param {Object} [db] - A [levelup](https://github.com/Level/levelup) instance. By default creates an in-memory [memdown](https://github.com/Level/memdown) instance.
 * If the db is `null` or left undefined, then the trie will be stored in memory via [memdown](https://github.com/Level/memdown)
 * @param {Buffer} [root] - A `Buffer` for the root of a previously stored trie
 * @prop {Buffer} root - The current root of the `trie`
 * @prop {Buffer} EMPTY_TRIE_ROOT - The root for an empty trie
 */
class Trie {
    constructor(db, maxHeight, root) {      // KJ: RESEARCH - added maxHeight
        this.EMPTY_TRIE_ROOT = ethereumjs_util_1.KECCAK256_RLP;
        this.lock = new semaphore_async_await_1.default(1);
        this.db = db ? new db_1.DB(db) : new db_1.DB();
        this._root = this.EMPTY_TRIE_ROOT;
        this.maxHeight = maxHeight
        if (root) {
            this.setRoot(root);
        }
    }
    /**
     * Saves the nodes from a proof into the trie. If no trie is provided a new one wil be instantiated.
     * @param {Proof} proof
     * @param {Trie} trie
     */
    static async fromProof(proof, trie) {
        let opStack = proof.map((nodeValue) => {
            return {
                type: 'put',
                key: ethereumjs_util_1.keccak(nodeValue),
                value: nodeValue,
            };
        });
        if (!trie) {
            trie = new Trie();
            if (opStack[0]) {
                trie.root = opStack[0].key;
            }
        }
        await trie.db.batch(opStack);
        return trie;
    }
    /**
     * prove has been renamed to [[Trie.createProof]].
     * @deprecated
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static async prove(trie, key) {
        return this.createProof(trie, key);
    }
    /**
     * Creates a proof from a trie and key that can be verified using [[Trie.verifyProof]].
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static async createProof(trie, key) {
        const { stack } = await trie.findPath(key);
        const p = stack.map((stackElem) => {
            return stackElem.serialize();
        });
        return p;
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
        let proofTrie = new Trie(null, rootHash);
        try {
            proofTrie = await Trie.fromProof(proof, proofTrie);
        }
        catch (e) {
            throw new Error('Invalid proof nodes given');
        }
        return proofTrie.get(key);
    }
    set root(value) {
        this.setRoot(value);
    }
    get root() {
        return this._root;
    }
    setRoot(value) {
        if (!value) {
            value = this.EMPTY_TRIE_ROOT;
        }
        assert(value.length === 32, 'Invalid root length. Roots are 32 bytes');
        this._root = value;
    }
    /**
     * Gets a value given a `key`
     * @param {Buffer} key - the key to search for
     * @returns A Promise that resolves to `Buffer` if a value was found or `null` if no value was found.
     */
    async get(key) {
        const { node, remaining } = await this.findPath(key);
        let value = null;
        if (node && remaining.length === 0) {
            value = node.value;
        }
        return value;
    }
    /**
     * Stores a given `value` at the given `key`.
     * @param {Buffer} key
     * @param {Buffer} value
     */
    async put(key, value) {
        // If value is empty, delete
        if (!value || value.toString() === '') {
            return await this.del(key);
        }
        await this.lock.wait();
        if (this.root.equals(ethereumjs_util_1.KECCAK256_RLP)) {
            // If no root, initialize this trie
            await this._createInitialNode(key, value);
        }
        else {
            // First try to find the given key or its nearest node
            const { remaining, stack, depth } = await this.findPath(key);        //  KJ: RESEARCH - added depth
            // then update
            await this._updateNode(key, value, remaining, stack, depth);        //  KJ: RESEARCH - added depth
        }
        this.lock.signal();
    }
    /**
     * Deletes a value given a `key`.
     * @param {Buffer} key
     */
    async del(key) {
        // KJ: RESEARCH - TODO - delete operation not implemented at the moment
        await this.lock.wait();
        const { node, stack } = await this.findPath(key);
        if (node) {
            await this._deleteNode(key, stack);
        }
        this.lock.signal();
    }
    /**
     * Retrieves a node from db by hash.
     * @private
     */
    async _lookupNode(node) {
        if (trieNode_1.isRawNode(node)) {
            return trieNode_1.decodeRawNode(node);
        }
        let value = null;
        let foundNode = null;
        value = await this.db.get(node);
        if (value) {
            foundNode = trieNode_1.decodeNode(value);
        }
        return foundNode;
    }
    /**
     * Writes a single node to db.
     * @private
     */
    async _putNode(node) {
        const hash = node.hash();
        const serialized = node.serialize();
        await this.db.put(hash, serialized);
    }
    /**
     * Tries to find a path to the node for the given key.
     * It returns a `stack` of nodes to the closet node.
     * @param {Buffer} key - the search key
     */
    async findPath(key) {
        return new Promise(async (resolve) => {
            let stack = [];
            let targetKey = nibbles_1.bufferToNibbles(key);
            // walk trie and process nodes
            await this._walkTrie(this.root, async (nodeRef, node, keyProgress, depth, walkController) => {     // KJ: RESEARCH - added depth
                const keyRemainder = targetKey.slice(nibbles_1.matchingNibbleLength(keyProgress, targetKey));
                stack.push(node);
                if (node instanceof trieNode_1.BranchNode) {
                    if (keyRemainder.length === 0) {
                        // we exhausted the key without finding a node
                        resolve({ node, remaining: [], stack, depth });     //  KJ: RESEARCH - added depth
                    }
                    else {
                        const branchIndex = keyRemainder[0];
                        const branchNode = node.getBranch(branchIndex);
                        if (!branchNode) {
                            // there are no more nodes to find and we didn't find the key
                            resolve({ node: null, remaining: keyRemainder, stack, depth });     //  KJ: RESEARCH - added depth
                        }
                        else {
                            // node found, continuing search
                            await walkController.only(branchIndex);
                        }
                    }
                }
                else if (node instanceof trieNode_1.LeafNode) {
                    if (nibbles_1.doKeysMatch(keyRemainder, node.key)) {
                        // keys match, return node with empty key
                        resolve({ node, remaining: [], stack, depth });     //  KJ: RESEARCH - added depth
                    }
                    else {
                        // reached leaf but keys dont match
                        resolve({ node: null, remaining: keyRemainder, stack, depth });     //  KJ: RESEARCH - added depth
                    }
                }
                else if (node instanceof trieNode_1.ExtensionNode) {
                    const matchingLen = nibbles_1.matchingNibbleLength(keyRemainder, node.key);
                    if (matchingLen !== node.key.length) {
                        // keys don't match, fail
                        resolve({ node: null, remaining: keyRemainder, stack, depth });     //  KJ: RESEARCH - added depth
                    }
                    else {
                        // keys match, continue search
                        await walkController.next();
                    }
                }
            });
            // Resolve if _walkTrie finishes without finding any nodes
            resolve({ node: null, remaining: [], stack, depth: 0 });    //  KJ: RESEARCH - added depth
        });
    }
    /**
     * Finds all nodes that store k,v values.
     * @private
     */
    async _findValueNodes(onFound) {
        await this._walkTrie(this.root, async (nodeRef, node, key, depth, walkController) => {  // KJ: RESEARCH - added depth
            let fullKey = key;
            if (node instanceof trieNode_1.LeafNode) {
                fullKey = key.concat(node.key);
                // found leaf node!
                onFound(nodeRef, node, fullKey, depth, walkController); // KJ: RESEARCH - added depth
            }
            else if (node instanceof trieNode_1.BranchNode && node.value) {
                // found branch with value
                onFound(nodeRef, node, fullKey, depth, walkController);  // KJ: RESEARCH - added depth
            }
            else {
                // keep looking for value nodes
                // KJ: RESEARCH - changed to propagate every node - not only the values
                // await walkController.next();
                onFound(nodeRef, node, fullKey, depth, walkController);  // KJ: RESEARCH - added depth
            }
        });
    }
    /*
     * Finds all nodes that are stored directly in the db
     * (some nodes are stored raw inside other nodes)
     */
    async _findDbNodes(onFound) {
        await this._walkTrie(this.root, async (nodeRef, node, key, depth, walkController) => {      // KJ: RESEARCH - added depth
            if (trieNode_1.isRawNode(nodeRef)) {
                await walkController.next();
            }
            else {
                onFound(nodeRef, node, key, walkController);
            }
        });
    }
    /**
     * Updates a node.
     * @private
     * @param {Buffer} key
     * @param {Buffer} value
     * @param {Nibbles} keyRemainder
     * @param {TrieNode[]} stack
     */
    async _updateNode(k, value, keyRemainder, stack, depth) {       //  KJ: RESEARCH - added depth
        const toSave = [];
        const lastNode = stack.pop();
        if (!lastNode) {
            throw new Error('Stack underflow');
        }
        // KJ: RESEARCH - added special handling when the depth is reached - store the value in the bucket, not the trie
        if (depth === this.maxHeight) {
            const keyNibbles = nibbles_1.bufferToNibbles(k);
            const prefix = keyNibbles.slice(0, keyNibbles.length - keyRemainder.length);
            const prefixBuffer = nibbles_1.nibblesToBuffer(prefix);

            // TODO - refresh the in memory trie

            // save the key->value directly
            toSave.push({
                type: 'put',
                key: k,
                value: value,
            });

            // TODO - we must add an extra node to stack to correctly recompute the stack - a leaf node?
            const key = nibbles_1.bufferToNibbles(k);
            await this._saveStack(key, stack, toSave);
            return
        }
        // KJ: RESEARCH - modification end

        // add the new nodes
        let key = nibbles_1.bufferToNibbles(k);
        // Check if the last node is a leaf and the key matches to this
        let matchLeaf = false;
        if (lastNode instanceof trieNode_1.LeafNode) {
            let l = 0;
            for (let i = 0; i < stack.length; i++) {
                const n = stack[i];
                if (n instanceof trieNode_1.BranchNode) {
                    l++;
                }
                else {
                    l += n.key.length;
                }
            }
            if (nibbles_1.matchingNibbleLength(lastNode.key, key.slice(l)) === lastNode.key.length &&
                keyRemainder.length === 0) {
                matchLeaf = true;
            }
        }
        if (matchLeaf) {
            // just updating a found value
            lastNode.value = value;
            stack.push(lastNode);
        }
        else if (lastNode instanceof trieNode_1.BranchNode) {
            stack.push(lastNode);
            if (keyRemainder.length !== 0) {
                // add an extension to a branch node
                keyRemainder.shift();
                // create a new leaf
                const newLeaf = new trieNode_1.LeafNode(keyRemainder, value);
                stack.push(newLeaf);
            }
            else {
                lastNode.value = value;
            }
        }
        else {
            // create a branch node
            const lastKey = lastNode.key;
            const matchingLength = nibbles_1.matchingNibbleLength(lastKey, keyRemainder);
            const newBranchNode = new trieNode_1.BranchNode();
            // create a new extension node
            if (matchingLength !== 0) {
                const newKey = lastNode.key.slice(0, matchingLength);
                const newExtNode = new trieNode_1.ExtensionNode(newKey, value);
                stack.push(newExtNode);
                lastKey.splice(0, matchingLength);
                keyRemainder.splice(0, matchingLength);
            }
            stack.push(newBranchNode);
            if (lastKey.length !== 0) {
                const branchKey = lastKey.shift();
                if (lastKey.length !== 0 || lastNode instanceof trieNode_1.LeafNode) {
                    // shrinking extension or leaf
                    lastNode.key = lastKey;
                    const formattedNode = this._formatNode(lastNode, false, toSave);
                    newBranchNode.setBranch(branchKey, formattedNode);
                }
                else {
                    // remove extension or attaching
                    this._formatNode(lastNode, false, toSave, true);
                    newBranchNode.setBranch(branchKey, lastNode.value);
                }
            }
            else {
                newBranchNode.value = lastNode.value;
            }
            if (keyRemainder.length !== 0) {
                keyRemainder.shift();
                // add a leaf node to the new branch node
                const newLeafNode = new trieNode_1.LeafNode(keyRemainder, value);
                stack.push(newLeafNode);
            }
            else {
                newBranchNode.value = value;
            }
        }
        await this._saveStack(key, stack, toSave);
    }
    /**
     * Walks a trie until finished.
     * @private
     * @param {Buffer} root
     * @param {Function} onNode - callback to call when a node is found
     * @returns Resolves when finished walking trie.
     */
    async _walkTrie(root, onNode) {
        return new Promise(async (resolve) => {
            const self = this;
            root = root || this.root;
            if (root.equals(ethereumjs_util_1.KECCAK256_RLP)) {
                return resolve();
            }
            // The maximum pool size should be high enough to utilize
            // the parallelizability of reading nodes from disk and
            // low enough to utilize the prioritisation of node lookup.
            const maxPoolSize = 500;
            const taskExecutor = new prioritizedTaskExecutor_1.PrioritizedTaskExecutor(maxPoolSize);
            const processNode = async (nodeRef, node, key = [], depth) => {     // KJ: RESEARCH -- added depth
                const walkController = {
                    next: async () => {
                        if (node instanceof trieNode_1.LeafNode) {
                            if (taskExecutor.finished()) {
                                resolve();
                            }
                            return;
                        }
                        let children;
                        if (node instanceof trieNode_1.ExtensionNode) {
                            children = [[node.key, node.value]];
                        }
                        else if (node instanceof trieNode_1.BranchNode) {
                            children = node.getChildren().map((b) => [[b[0]], b[1]]);
                        }
                        if (!children) {
                            // Node has no children
                            return resolve();
                        }
                        for (const child of children) {
                            const keyExtension = child[0];
                            const childRef = child[1];
                            const childKey = key.concat(keyExtension);
                            const priority = childKey.length;
                            taskExecutor.execute(priority, async (taskCallback) => {
                                const childNode = await self._lookupNode(childRef);
                                taskCallback();
                                if (childNode) {
                                    processNode(childRef, childNode, childKey, depth+1);    // KJ: RESEARCH -- added depth
                                }
                            });
                        }
                    },
                    only: async (childIndex) => {
                        if (!(node instanceof trieNode_1.BranchNode)) {
                            throw new Error('Expected branch node');
                        }
                        const childRef = node.getBranch(childIndex);
                        if (!childRef) {
                            throw new Error('Could not get branch of childIndex');
                        }
                        const childKey = key.slice();
                        childKey.push(childIndex);
                        const priority = childKey.length;
                        taskExecutor.execute(priority, async (taskCallback) => {
                            const childNode = await self._lookupNode(childRef);
                            taskCallback();
                            if (childNode) {
                                await processNode(childRef, childNode, childKey, depth+1);  // KJ: RESEARCH -- added depth
                            }
                            else {
                                // could not find child node
                                resolve();
                            }
                        });
                    },
                };
                if (node) {
                    onNode(nodeRef, node, key, depth, walkController);  // KJ: RESEARCH -- added depth
                }
                else {
                    resolve();
                }
            };
            const node = await this._lookupNode(root);
            if (node) {
                await processNode(root, node, [], 0);       // KJ: RESEARCH -- added depth - init to zero
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Saves a stack.
     * @private
     * @param {Nibbles} key - the key. Should follow the stack
     * @param {Array} stack - a stack of nodes to the value given by the key
     * @param {Array} opStack - a stack of levelup operations to commit at the end of this funciton
     */
    async _saveStack(key, stack, opStack) {
        let lastRoot;
        // update nodes
        while (stack.length) {
            const node = stack.pop();
            if (node instanceof trieNode_1.LeafNode) {
                key.splice(key.length - node.key.length);
            }
            else if (node instanceof trieNode_1.ExtensionNode) {
                key.splice(key.length - node.key.length);
                if (lastRoot) {
                    node.value = lastRoot;
                }
            }
            else if (node instanceof trieNode_1.BranchNode) {
                if (lastRoot) {
                    const branchKey = key.pop();
                    node.setBranch(branchKey, lastRoot);
                }
            }
            lastRoot = this._formatNode(node, stack.length === 0, opStack);
        }
        if (lastRoot) {
            this.root = lastRoot;
        }
        await this.db.batch(opStack);
    }
    /**
     * Deletes a node.
     * @private
     */
    async _deleteNode(k, stack) {
        const processBranchNode = (key, branchKey, branchNode, parentNode, stack) => {
            // branchNode is the node ON the branch node not THE branch node
            if (!parentNode || parentNode instanceof trieNode_1.BranchNode) {
                // branch->?
                if (parentNode) {
                    stack.push(parentNode);
                }
                if (branchNode instanceof trieNode_1.BranchNode) {
                    // create an extension node
                    // branch->extension->branch
                    // @ts-ignore
                    const extensionNode = new trieNode_1.ExtensionNode([branchKey], null);
                    stack.push(extensionNode);
                    key.push(branchKey);
                }
                else {
                    const branchNodeKey = branchNode.key;
                    // branch key is an extension or a leaf
                    // branch->(leaf or extension)
                    branchNodeKey.unshift(branchKey);
                    branchNode.key = branchNodeKey.slice(0);
                    key = key.concat(branchNodeKey);
                }
                stack.push(branchNode);
            }
            else {
                // parent is an extension
                let parentKey = parentNode.key;
                if (branchNode instanceof trieNode_1.BranchNode) {
                    // ext->branch
                    parentKey.push(branchKey);
                    key.push(branchKey);
                    parentNode.key = parentKey;
                    stack.push(parentNode);
                }
                else {
                    const branchNodeKey = branchNode.key;
                    // branch node is an leaf or extension and parent node is an exstention
                    // add two keys together
                    // dont push the parent node
                    branchNodeKey.unshift(branchKey);
                    key = key.concat(branchNodeKey);
                    parentKey = parentKey.concat(branchNodeKey);
                    branchNode.key = parentKey;
                }
                stack.push(branchNode);
            }
            return key;
        };
        let lastNode = stack.pop();
        assert(lastNode);
        let parentNode = stack.pop();
        const opStack = [];
        let key = nibbles_1.bufferToNibbles(k);
        if (!parentNode) {
            // the root here has to be a leaf.
            this.root = this.EMPTY_TRIE_ROOT;
            return;
        }
        if (lastNode instanceof trieNode_1.BranchNode) {
            lastNode.value = null;
        }
        else {
            // the lastNode has to be a leaf if it's not a branch.
            // And a leaf's parent, if it has one, must be a branch.
            if (!(parentNode instanceof trieNode_1.BranchNode)) {
                throw new Error('Expected branch node');
            }
            const lastNodeKey = lastNode.key;
            key.splice(key.length - lastNodeKey.length);
            // delete the value
            this._formatNode(lastNode, false, opStack, true);
            parentNode.setBranch(key.pop(), null);
            lastNode = parentNode;
            parentNode = stack.pop();
        }
        // nodes on the branch
        // count the number of nodes on the branch
        const branchNodes = lastNode.getChildren();
        // if there is only one branch node left, collapse the branch node
        if (branchNodes.length === 1) {
            // add the one remaing branch node to node above it
            const branchNode = branchNodes[0][1];
            const branchNodeKey = branchNodes[0][0];
            // look up node
            const foundNode = await this._lookupNode(branchNode);
            if (foundNode) {
                key = processBranchNode(key, branchNodeKey, foundNode, parentNode, stack);
                await this._saveStack(key, stack, opStack);
            }
        }
        else {
            // simple removing a leaf and recaluclation the stack
            if (parentNode) {
                stack.push(parentNode);
            }
            stack.push(lastNode);
            await this._saveStack(key, stack, opStack);
        }
    }
    /**
     * Creates the initial node from an empty tree.
     * @private
     */
    async _createInitialNode(key, value) {
        const newNode = new trieNode_1.LeafNode(nibbles_1.bufferToNibbles(key), value);
        this.root = newNode.hash();
        await this._putNode(newNode);
    }
    /**
     * Formats node to be saved by `levelup.batch`.
     * @private
     * @param {TrieNode} node - the node to format.
     * @param {Boolean} topLevel - if the node is at the top level.
     * @param {BatchDBOp[]} opStack - the opStack to push the node's data.
     * @param {Boolean} remove - whether to remove the node (only used for CheckpointTrie).
     * @returns The node's hash used as the key or the rawNode.
     */
    _formatNode(node, topLevel, opStack, remove = false) {
        const rlpNode = node.serialize();
        if (rlpNode.length >= 32 || topLevel) {
            const hashRoot = node.hash();
            opStack.push({
                type: 'put',
                key: hashRoot,
                value: rlpNode,
            });
            return hashRoot;
        }
        return node.raw();
    }
    /**
     * The `data` event is given an `Object` that has two properties; the `key` and the `value`. Both should be Buffers.
     * @return {stream.Readable} Returns a [stream](https://nodejs.org/dist/latest-v12.x/docs/api/stream.html#stream_class_stream_readable) of the contents of the `trie`
     */
    createReadStream() {
        return new readStream_1.TrieReadStream(this);
    }
    /**
     * Creates a new trie backed by the same db.
     */
    copy() {
        const db = this.db.copy();
        return new Trie(db._leveldb, this.maxHeight, this.root);    // KJ: RESEARCH -- added max height
    }
    /**
     * The given hash of operations (key additions or deletions) are executed on the DB
     * @example
     * const ops = [
     *    { type: 'del', key: Buffer.from('father') }
     *  , { type: 'put', key: Buffer.from('name'), value: Buffer.from('Yuri Irsenovich Kim') }
     *  , { type: 'put', key: Buffer.from('dob'), value: Buffer.from('16 February 1941') }
     *  , { type: 'put', key: Buffer.from('spouse'), value: Buffer.from('Kim Young-sook') }
     *  , { type: 'put', key: Buffer.from('occupation'), value: Buffer.from('Clown') }
     * ]
     * await trie.batch(ops)
     * @param {Array} ops
     */
    async batch(ops) {
        for (const op of ops) {
            if (op.type === 'put') {
                if (!op.value) {
                    throw new Error('Invalid batch db operation');
                }
                await this.put(op.key, op.value);
            }
            else if (op.type === 'del') {
                await this.del(op.key);
            }
        }
    }
    /**
     * Checks if a given root exists.
     */
    async checkRoot(root) {
        const value = await this._lookupNode(root);
        return !!value;
    }
}
exports.Trie = Trie;
//# sourceMappingURL=baseTrie.js.map