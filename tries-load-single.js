const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const trie = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');

/**
 * Dump a trie for the hash in a CSV file
 * @param blockNumber
 * @param blockHashStr
 * @param blockDepth trie height
 */
function dumpTrie(blockHashStr) {
    const FILE_NAME = CSV_PATH_RES + "/trie_" + blockHashStr + ".csv";
    const stream = fs.createWriteStream(FILE_NAME)
    const stateRoot = utils.toBuffer(blockHashStr);

    console.time('Storage-trie-' + blockHashStr);

    trie.iterateSecureTrie(stateRoot, (key, value) => {

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
const hash = args[1];
// const inputTries = args[1];
// const outputTrie = args[1];

const CSV_FILE_INPUT = "csv_input/";
const CSV_PATH_RES = "csv_dump/";

/** Init with DB path. */
trie.init(dbPath, () => dumpTrie(hash));

