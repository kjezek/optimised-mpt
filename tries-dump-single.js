const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const trie = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');
const Trie = require('merkle-patricia-tree').BaseTrie;



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
const fileName = CSV_PATH_RES + "/trie_" + hash + ".csv"
trie.init(dbPath, (db) => trie.dumpTrie(fileName, trie.baseTrie(db, hash)));

