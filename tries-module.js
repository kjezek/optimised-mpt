const Blockchain = require('ethereumjs-blockchain').default;
const utils = require('ethereumjs-util');
const async = require("async");
const level = require('level');
const rlp = require('rlp');
const SecTrie = require('merkle-patricia-tree').SecureTrie;
const Trie = require('merkle-patricia-tree').BaseTrie;

let db;
let blockchainOpts;

// Open the DB
exports.init = function(DB_PATH, onOpen) {
    const dbOptions = {  };
    db = level(DB_PATH, dbOptions, function(err) {
        if (err) console.log("DB Access Err: " + err);
        blockchainOpts = { db: db, hardfork:  "byzantium", validate : false }
        onOpen();
    });
};


function streamOnTrie(trie, cb1, onDone) {
    let stream = trie.createReadStream()
        .on('data', function (data) {
            cb1(data.key, data.value, data.node, data.depth);
        })
        .on('end', function () {
            onDone() // signal end
        })
}

/**
 * Iterate over all accounts of a block
 * @param root trie root
 * @param cb1 callback
 */
exports.iterateSecureTrie = function(root, cb1, onDone) {
    let trie = new SecTrie(db, root);
    streamOnTrie(trie, cb1, onDone);
};

/**
 * Iterate over all transactions of a block
 * @param root trie root
 * @param cb1 callback
 */
exports.iterateTrie = function(root, cb1, onDone) {
    let trie = new Trie(db, root);
    streamOnTrie(trie, cb1, onDone);
};