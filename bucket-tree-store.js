const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const trie = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');
const BucketTrie = require('./bucket-tree').BaseTrie;


/**
 * Read input tries from a file-
 * @param file
 * @param cb callback
 */
function readInputTries(file, cb) {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    rl.on('line', line => {
        const items = line.split(",");
        const key = utils.toBuffer(items[0]);
        const value = utils.toBuffer(items[1]);

        cb(key, value);
    });

    // rl.on('close', () => onLine(null, null));
}

const args = process.argv.slice(2);
const dbPath = args[0];
const file = args[1];


main = function (db) {

    const trie = new BucketTrie(db);
    const dumpTrieCB = (key, value) => trie.put(key, value)
    readInputTries(file, dumpTrieCB)
}

/** Init with DB path. */
trie.init(dbPath, main);