const Blockchain = require('ethereumjs-blockchain').default;
const utils = require('ethereumjs-util');
const async = require("async");
const level = require('level');
const rlp = require('rlp');
const fs = require("fs");
const readline = require('readline');
const SecTrie = require('merkle-patricia-tree').SecureTrie;
const Trie = require('merkle-patricia-tree').BaseTrie;

let db;
let blockchainOpts;

// Open the DB
exports.init = function(DB_PATH, onOpen) {
    const dbOptions = {  };
    db = level(DB_PATH, dbOptions, function(err, db1) {
        if (err) console.log("DB Access Err: " + err);
        blockchainOpts = { db: db1, hardfork:  "byzantium", validate : false }
        onOpen(db1);
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


/**
 * Read input tries from a file-
 * @param file
 * @param cb callback
 */
exports.readInputTries = function(file, cb) {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });


    console.time('trie-dump-read-' + file);

    rl.on('line', line => {
        const items = line.split(",");
        const key = utils.toBuffer(items[0]);
        const value = utils.toBuffer(items[1]);

        cb(key, value);
    });

    rl.on('close', () => {
        console.timeEnd('trie-dump-read-' + file);
    });
}

let count = 0;
let start = Date.now()
const M = 1000000
exports.tick = function(file) {

    // create some statistics
    if (++count % M === 0) {
        const end = Date.now();
        const speed = M / ((end - start) / 1000)
        start = end;
        const mCount = count / M
        console.log( (mCount) + "M elements inserted. Speed: " + speed + " items/s");

        const line = mCount + "," + speed + "\n"
        fs.appendFile(file, line, err => {
            if (err) console.error("Err: " + err)
        });
    }
}

exports.insertAll = function (inputFile, speedFile, batchSize, trieFactory) {

    // fs.unlinkSync(speedFile)
    let trie = trieFactory();
    let count = 0;
    const dumpTrieCB = (key, value) => {

        // create a new tree not to bloat memory
        if (count++ % batchSize === 0) {
            trie = trieFactory();
        }

        trie.put(key, value).then(err => {
            if (err) console.error("Err: " + err)
            exports.tick(speedFile); // tick one more element done
        })
    }
    exports.readInputTries(inputFile, dumpTrieCB)
}
