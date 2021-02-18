"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DB = exports.ENCODING_OPTS = void 0;
const level = require('level-mem');
const utils = require('ethereumjs-util');
const async = require("async");

exports.ENCODING_OPTS = { keyEncoding: 'binary', valueEncoding: 'binary' };
/**
 * DB is a thin wrapper around the underlying levelup db,
 * which validates inputs and sets encoding type.
 */
class DB {
    /**
     * Initialize a DB instance. If `leveldb` is not provided, DB
     * defaults to an [in-memory store](https://github.com/Level/memdown).
     * @param {Object} [leveldb] - An abstract-leveldown compliant store
     */
    constructor(leveldb) {
        this._leveldb = leveldb || level();
    }
    /**
     * Retrieves a raw value from leveldb.
     * @param {Buffer} key
     * @returns A Promise that resolves to `Buffer` if a value is found or `null` if no value is found.
     */
    async get(key) {
        let value = null;
        try {
            value = await this._leveldb.get(key, exports.ENCODING_OPTS);
        }
        catch (error) {
            if (error.notFound) {
                // not found, returning null
            }
            else {
                throw error;
            }
        }
        finally {
            return value;
        }
    }
    /**
     * Writes a value directly to leveldb.
     * @param {Buffer} key The key as a `Buffer`
     * @param {Buffer} value The value to be stored
     * @returns {Promise}
     */
    async put(key, val) {
        await this._leveldb.put(key, val, exports.ENCODING_OPTS);
    }
    /**
     * Removes a raw value in the underlying leveldb.
     * @param {Buffer} key
     * @returns {Promise}
     */
    async del(key) {
        await this._leveldb.del(key, exports.ENCODING_OPTS);
    }
    /**
     * Performs a batch operation on db.
     * @param {Array} opStack A stack of levelup operations
     * @returns {Promise}
     */
    async batch(opStack) {
        await this._leveldb.batch(opStack, exports.ENCODING_OPTS);
    }
    /**
     * Returns a copy of the DB instance, with a reference
     * to the **same** underlying leveldb instance.
     */
    copy() {
        return new DB(this._leveldb);
    }

    // KJ: RESEARCH  - added prefix filter
    async prefixRange(keyPrefix, cb) {
        const endStr = utils.bufferToHex(keyPrefix) + "FF"
        const end = utils.toBuffer(endStr)
        const startStr = utils.bufferToHex(keyPrefix);
        console.log("In-memory trie for up-to prefix: " + endStr)
        let c = 0
        return new Promise((resolve) => {
            // put all keys in this queue, and resolve this promise once all values are processed in the callback
            const q = async.queue((task, onDone) => {
                // console.log("Recovered: " + utils.bufferToHex(task.key) + "->" )
                // if ( (++c % 10) === 0 ) console.log("Submitted " + c + " " + utils.bufferToHex(task.key) + "->" + utils.bufferToHex(task.value))
                cb(task.key, task.value, onDone)
            }, 1000);
            this._leveldb.createReadStream({
                gte: keyPrefix,
                lte: end
            }).on('data', data => {
                console.log("Submitted " + c + " " + data.key + "->" + data.value)
                q.push({"key": new Buffer(data.key), "value": new Buffer(data.value)})
                }
            ).on('end', ()=> q.drain = () => {
                console.log("Trie read")
                resolve()
            }).on('error', function (err) {
                    console.log('Oh my!', err)
                })
        })
    }
    // KJ: RESEARCH - end
}
exports.DB = DB;
//# sourceMappingURL=db.js.map