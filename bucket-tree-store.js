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

/** Init with DB path. */
tries.init(dbPath, (db) => tries.insert(file, "speed-bucket.csv", () => new BucketTrie(db)));