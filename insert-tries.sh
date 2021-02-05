#!/bin/bash

HEAP_SIZE=8192
DB_PATH="db-bucket-tree"
BATCH_SIZE=1000
INPUT_TRIE="csv_dump/trie_11000000_11_0xbb91d90516ce901742bfd5d73e4bf99b510776ef941e1f86ea8a1fd7d0d2e2c5.csv"

rm -rf $DB_PATH

START_TIME=$(date +%s)
node --max-old-space-size=$HEAP_SIZE bucket-tree-store.js $DB_PATH $BATCH_SIZE $INPUT_TRIE
END_TIME=$(date +%s)

echo "Total time $((END_TIME - START_TIME))s"