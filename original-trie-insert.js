const utils = require('ethereumjs-util');
const fs = require("fs");
const readline = require('readline');
const tries = require('./tries-module');
const Account = require('ethereumjs-account').default;
const Transaction = require('ethereumjs-tx').Transaction;
const async = require('async');
const Trie = require('merkle-patricia-tree').BaseTrie;


const args = process.argv.slice(2);
const dbPath = args[0];
const parallelism = parseInt(args[1])
const batchSize = parseInt(args[2])
const file = args[3];

/** Init with DB path. */
tries.init(dbPath, (db) => tries.insertAll(file, "speed-trie-original.csv", parallelism, batchSize, db, 0, tries.baseTrie));