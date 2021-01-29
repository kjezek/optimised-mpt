const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const blocks = require('./blocks-module');
const Statistics = require('./blocks-module').Statistics;
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
function readInputTries(file, onLine) {
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

        onLine(blockNumber, blockHashStr);
    });

    rl.on('close', () => onLine(null, null));  // null signals end
}

/**
 * Dump a trie for the hash in a CSV file
 * @param blockNumber
 * @param blockHashStr
 */
function dumpTrie(blockNumber, blockHashStr) {
    const FILE_NAME = CSV_PATH_RES + "/trie_" + blockHashStr + ".csv";
    const stream = fs.createWriteStream(FILE_NAME)
    const stateRoot = utils.toBuffer(blockHashStr);

    console.time('Storage-trie-' + blockNumber);

    blocks.iterateSecureTrie(stateRoot, (key, value, node, depth) => {

        // we have value when the leaf has bean reached
        if (value) {
            const newLine = [];
            newLine.push(key);
            newLine.push(value);
            stream.write(newLine.join(',')+ '\n');
        }

        if (!node) {
            stream.end()
            console.timeEnd('Storage-trie-' + blockNumber);
        }
    });
}

/**
 * Main program - read blocks from pre-generated CSV files and
 * generate statistics about the tries.
 */
const args = process.argv.slice(2);
const dbPath = args[0];
const inputTries = args[1];
const outputTrie = args[1];

const CSV_FILE_INPUT = "csv_input/";
const CSV_PATH_RES = "csv_dump/";

main = function () {
    readInputTries(inputTries, dumpTrie)
}

/** Init with DB path. */
blocks.init(dbPath, main);

