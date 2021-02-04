const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const tries = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');
const BucketTrie = require('./bucket-tree').BaseTrie;


const args = process.argv.slice(2);
const dbPath = args[0];
const file = args[1];

const MAX_MEMORY_ELEMENTS = 10000

main = function (trieFactory) {

    let trie = trieFactory();
    let count = 0;
    let start = Date.now()
    const dumpTrieCB = (key, value) => {

        // create a new tree not to bloat memory
        if (count++ % MAX_MEMORY_ELEMENTS === 0) {
            trie = trieFactory();
        }

        tries.tick(); // tick one more element done
        trie.put(key, value)
    }
    tries.readInputTries(file, dumpTrieCB)
}

/** Init with DB path. */
tries.init(dbPath, (db) => main(() => new BucketTrie(db)));