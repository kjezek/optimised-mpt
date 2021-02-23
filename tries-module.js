const Blockchain = require('ethereumjs-blockchain').default;
const utils = require('ethereumjs-util');
const async = require("async");
const level = require('level');
const rlp = require('rlp');
const fs = require("fs");
const readline = require('readline');
const SecTrie = require('merkle-patricia-tree').SecureTrie;
const BaseTrie = require('merkle-patricia-tree').BaseTrie;
const BucketTrie = require('./bucket-tree').BaseTrie;

// Open the DB
exports.init = function(DB_PATH, onOpen) {
    const dbOptions = {  };
    level(DB_PATH, dbOptions, function(err, db1) {
        if (err) console.log("DB Access Err: " + err);
        blockchainOpts = { db: db1, hardfork:  "byzantium", validate : false }
        onOpen(db1);
    });
};


exports.streamOnTrie = function (trie, cb1, onDone) {
    let stream = trie.createReadStream()
        .on('data', function (data) {
            cb1(data.key, data.value, data.node, data.depth);
        })
        .on('end', function () {
            onDone() // signal end
        })
}

/**
 * Iterate over all transactions of a block
 * @param root trie root
 * @param cb1 callback
 * @param onDone on done callback
 */
exports.iterateTrie = function(root, cb1, onDone) {
    let trie = new Trie(db, root);
    streamOnTrie(trie, cb1, onDone);
};

/**
 * Iterate bucket tree
 * @param root
 * @param cb1
 * @param onDone
 * @param onDone on done callback
 */
exports.iterateBucketTree = function (root, cb1, onDone) {
    let trie = new BucketTrie(db, root)
    streamOnTrie(trie, cb1, onDone)
}


/**
 * Read input tries from a file-
 * @param file
 * @param cb callback
 * @param parallelism number of parallel threads to insert in a trie
 * @param db database
 */
exports.readInputTries = function(file, parallelism, db, cb) {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    console.time('trie-dump-read-' + file);

    let lastRoot
    // queue all the processing of each file line
    const q = async.queue(function(task, callback) {
        cb(task.key, task.value, callback);
    }, parallelism);

    rl.on('line', line => {
        const items = line.split(",");
        const key = utils.toBuffer(items[0]);
        const value = utils.toBuffer(items[1]);

        q.push({key: key, value: value}, (err, hashRoot) => {
            lastRoot = hashRoot
        })
    });

    const donCB = () => {
        console.log("Last root: " + utils.bufferToHex(lastRoot))
        // all inserted - compaction of all tries
        db.compact()
    }

    rl.on('close', () => {
       console.timeEnd('trie-dump-read-' + file);
       if (!q.length) donCB(); else q.drain = donCB
    });
}

/**
 * Helper class for performance metering
 * @type {exports.Speed}
 */
exports.Speed = class {

    constructor(file, parallelism, batchSize) {
        this.count = 0;
        this.start = Date.now()
        this.M = 1000000
        this.file = file
        this.batchSize = batchSize
        this.parallelism = parallelism
    }

    tick() {

        // create some statistics
        if (++this.count % this.M === 0) {
            const end = Date.now();
            const speed = this.M / ((end - this.start) / 1000)
            this.start = end;
            const mCount = this.count / this.M
            console.log( (mCount) + "M elements inserted. Speed: " + speed + " items/s");

            const line = this.parallelism + "," + this.batchSize + "," + mCount + "," + speed + "\n"
            fs.appendFile(this.file, line, err => {
                if (err) console.error("Err: " + err)
            });
        }
    }

}


/**
 * Insert all key-value pairs from the input file into the database
 *
 *
 * @param inputFile the file with key-value pairs
 * @param speedFile the file to write speed statistics into
 * @param batchSize the number of elements to insert before a new tree is created
 * @param parallelism number of threads to insert in - use only "1" when paired with batch size  // TODO - use only one at the moment
 * @param db database
 * @param trieFactory trie
 */
exports.insertAll = function (inputFile, speedFile, parallelism, batchSize, db, trieFactory) {

    // fs.unlinkSync(speedFile)
    let trie = trieFactory(db);
    let count = 0;
    const speed = new exports.Speed(speedFile, parallelism, batchSize)
    const dumpTrieCB = (key, value, onDone) => {

        // TODO - this has no sense - Trie is backed up by the database and holds no in-memory nodes
        // create a new tree not to bloat memory
        // if (count++ % batchSize === 0) {
        //     // const root = trie.root
        //     // trie = trieFactory();
        //     // trie.root = root;
        //     trie = trie.copy()
        // }

        trie.put(key, value).then(err => {
            if (err) console.error("Err: " + err)
            speed.tick(); // tick one more element done
            // console.log("current root " + utils.bufferToHex(trie.root) + ": " + utils.bufferToHex(key) + "->" + utils.bufferToHex(value))
            onDone(err, trie.root)   // send the last root
        })
    }
    exports.readInputTries(inputFile, parallelism, db, dumpTrieCB)
}

exports.baseTrie = (db, hashRoot) => {
    const stateRoot = hashRoot ? utils.toBuffer(hashRoot) : undefined;
    return new BaseTrie(db, stateRoot)
}

exports.bucketTrie = (db, maxHeight, hashRoot) => {
    const stateRoot = hashRoot ? utils.toBuffer(hashRoot) : undefined;
    return new BucketTrie(db, maxHeight, stateRoot)
}


/**
 * Dump a trie for the hash in a CSV file
 * @param outputFile dump file name
 * @param trie trie to iterate
 */
exports.dumpTrie = function(outputFile, trie) {
    const stream = fs.createWriteStream(outputFile)

    const blockHashStr = utils.bufferToHex(trie.root);
    console.time('Storage-trie-' + blockHashStr);

    exports.streamOnTrie(trie, (key, value, node, depth) => {

        // we have value when the leaf has bean reached
        if (value) {
            const keyStr = utils.bufferToHex(key)
            const valueStr = utils.bufferToHex(value)
            const newLine = [];
            newLine.push(keyStr);
            newLine.push(valueStr);
            // newLine.push(depth);
            stream.write(newLine.join(',')+ '\n');
        }

    }, ()=> {
        stream.end()
        console.timeEnd('Storage-trie-' + blockHashStr);
        console.log("Stored into file: " + outputFile)
    });
}
