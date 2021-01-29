/// <reference types="node" />
import Semaphore from 'semaphore-async-await';
import { LevelUp } from 'levelup';
import { DB, BatchDBOp } from './db';
import { TrieReadStream as ReadStream } from './readStream';
import { TrieNode, EmbeddedNode, Nibbles } from './trieNode';
export declare type Proof = Buffer[];
interface Path {
    node: TrieNode | null;
    remaining: Nibbles;
    stack: TrieNode[];
}
declare type FoundNode = (nodeRef: Buffer, node: TrieNode, key: Nibbles, walkController: any) => void;
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
export declare class Trie {
    EMPTY_TRIE_ROOT: Buffer;
    db: DB;
    protected lock: Semaphore;
    private _root;
    constructor(db?: LevelUp | null, root?: Buffer);
    /**
     * Saves the nodes from a proof into the trie. If no trie is provided a new one wil be instantiated.
     * @param {Proof} proof
     * @param {Trie} trie
     */
    static fromProof(proof: Proof, trie?: Trie): Promise<Trie>;
    /**
     * prove has been renamed to [[Trie.createProof]].
     * @deprecated
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static prove(trie: Trie, key: Buffer): Promise<Proof>;
    /**
     * Creates a proof from a trie and key that can be verified using [[Trie.verifyProof]].
     * @param {Trie} trie
     * @param {Buffer} key
     */
    static createProof(trie: Trie, key: Buffer): Promise<Proof>;
    /**
     * Verifies a proof.
     * @param {Buffer} rootHash
     * @param {Buffer} key
     * @param {Proof} proof
     * @throws If proof is found to be invalid.
     * @returns The value from the key.
     */
    static verifyProof(rootHash: Buffer, key: Buffer, proof: Proof): Promise<Buffer | null>;
    set root(value: Buffer);
    get root(): Buffer;
    setRoot(value?: Buffer): void;
    /**
     * Gets a value given a `key`
     * @param {Buffer} key - the key to search for
     * @returns A Promise that resolves to `Buffer` if a value was found or `null` if no value was found.
     */
    get(key: Buffer): Promise<Buffer | null>;
    /**
     * Stores a given `value` at the given `key`.
     * @param {Buffer} key
     * @param {Buffer} value
     */
    put(key: Buffer, value: Buffer): Promise<void>;
    /**
     * Deletes a value given a `key`.
     * @param {Buffer} key
     */
    del(key: Buffer): Promise<void>;
    /**
     * Retrieves a node from db by hash.
     * @private
     */
    _lookupNode(node: Buffer | Buffer[]): Promise<TrieNode | null>;
    /**
     * Writes a single node to db.
     * @private
     */
    _putNode(node: TrieNode): Promise<void>;
    /**
     * Tries to find a path to the node for the given key.
     * It returns a `stack` of nodes to the closet node.
     * @param {Buffer} key - the search key
     */
    findPath(key: Buffer): Promise<Path>;
    /**
     * Finds all nodes that store k,v values.
     * @private
     */
    _findValueNodes(onFound: FoundNode): Promise<void>;
    _findDbNodes(onFound: FoundNode): Promise<void>;
    /**
     * Updates a node.
     * @private
     * @param {Buffer} key
     * @param {Buffer} value
     * @param {Nibbles} keyRemainder
     * @param {TrieNode[]} stack
     */
    _updateNode(k: Buffer, value: Buffer, keyRemainder: Nibbles, stack: TrieNode[]): Promise<void>;
    /**
     * Walks a trie until finished.
     * @private
     * @param {Buffer} root
     * @param {Function} onNode - callback to call when a node is found
     * @returns Resolves when finished walking trie.
     */
    _walkTrie(root: Buffer, onNode: FoundNode): Promise<void>;
    /**
     * Saves a stack.
     * @private
     * @param {Nibbles} key - the key. Should follow the stack
     * @param {Array} stack - a stack of nodes to the value given by the key
     * @param {Array} opStack - a stack of levelup operations to commit at the end of this funciton
     */
    _saveStack(key: Nibbles, stack: TrieNode[], opStack: BatchDBOp[]): Promise<void>;
    /**
     * Deletes a node.
     * @private
     */
    _deleteNode(k: Buffer, stack: TrieNode[]): Promise<void>;
    /**
     * Creates the initial node from an empty tree.
     * @private
     */
    _createInitialNode(key: Buffer, value: Buffer): Promise<void>;
    /**
     * Formats node to be saved by `levelup.batch`.
     * @private
     * @param {TrieNode} node - the node to format.
     * @param {Boolean} topLevel - if the node is at the top level.
     * @param {BatchDBOp[]} opStack - the opStack to push the node's data.
     * @param {Boolean} remove - whether to remove the node (only used for CheckpointTrie).
     * @returns The node's hash used as the key or the rawNode.
     */
    _formatNode(node: TrieNode, topLevel: boolean, opStack: BatchDBOp[], remove?: boolean): Buffer | (EmbeddedNode | null)[];
    /**
     * The `data` event is given an `Object` that has two properties; the `key` and the `value`. Both should be Buffers.
     * @return {stream.Readable} Returns a [stream](https://nodejs.org/dist/latest-v12.x/docs/api/stream.html#stream_class_stream_readable) of the contents of the `trie`
     */
    createReadStream(): ReadStream;
    /**
     * Creates a new trie backed by the same db.
     */
    copy(): Trie;
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
    batch(ops: BatchDBOp[]): Promise<void>;
    /**
     * Checks if a given root exists.
     */
    checkRoot(root: Buffer): Promise<boolean>;
}
export {};
