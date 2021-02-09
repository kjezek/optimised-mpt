const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const trie = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');

// running less blocks in parallel produces results sooner
// because a lot of parallel actions prolong single executions
const BLOCKS_IN_PARALLEL=100;

/**
 * Read input tries from a file-
 * @param file
 * @param cb callback
 * @param onLine invoked when file is processed
 */
function readInputTries(file, db, cb) {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    rl.on('line', line => {
        const items = line.split(",");
        const blockNumber = items[0];
        const blockHashStr = items[1];
        const blockDepth = items[2];

        cb(db, blockNumber, blockHashStr, blockDepth);
    });

    // rl.on('close', () => onLine(null, null));
}

function readInputCSVFiles(path, cb) {
    fs.readdir(path, (err, files) => {

        if (err) { console.error("Could not list the directory.", err); return; }
        files.forEach((file, index) => {
            if (file.endsWith(".csv"))
                cb(path + file);
        });
    });
}

/**
 * Dump a trie for the hash in a CSV file
 * @param db database
 * @param blockNumber
 * @param blockHashStr
 * @param blockDepth trie height
 */
function dumpTrie(db, blockNumber, blockHashStr, blockDepth) {
    const FILE_NAME = CSV_PATH_RES + "/trie_" + blockNumber + "_" + blockDepth + "_" + blockHashStr + ".csv";
    const stream = fs.createWriteStream(FILE_NAME)

    console.time('Storage-trie-' + blockHashStr);

    const t = trie.baseTrie(db, blockHashStr)
    trie.streamOnTrie(t,(key, value) => {

        // we have value when the leaf has bean reached
        if (value) {
            const keyStr = utils.bufferToHex(key)
            const valueStr = utils.bufferToHex(value)
            const newLine = [];
            newLine.push(keyStr);
            newLine.push(valueStr);
            stream.write(newLine.join(',')+ '\n');
        }

    }, ()=> {
        stream.end()
        console.timeEnd('Storage-trie-' + blockHashStr);
    });
}

/**
 * Main program - read blocks from pre-generated CSV files and
 * generate statistics about the tries.
 */
const args = process.argv.slice(2);
const dbPath = args[0];
// const inputTries = args[1];
// const outputTrie = args[1];

const CSV_FILE_INPUT = "csv_input/";
const CSV_PATH_RES = "csv_dump/";

main = function (db) {
    const dumpTrieCB = (file) => readInputTries(file, db, dumpTrie)
    readInputCSVFiles(CSV_FILE_INPUT, dumpTrieCB)
    // readInputTries(inputTries, dumpTrie)
}

/** Init with DB path. */
trie.init(dbPath, main);

