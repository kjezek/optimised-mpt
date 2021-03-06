#!/bin/bash

HEAP_SIZE=32000
DB_PATH_TRIE_ORIGINAL="db-trie-original"
PARALLELISM=1
BATCH_SIZE=1
INPUT_TRIE="csv_dump/trie_11000000_11_0xbb91d90516ce901742bfd5d73e4bf99b510776ef941e1f86ea8a1fd7d0d2e2c5.csv"

rm -rf $DB_PATH_TRIE_ORIGINAL
START_TIME=$(date +%s)
node --max-old-space-size=$HEAP_SIZE original-trie-insert.js $DB_PATH_TRIE_ORIGINAL $PARALLELISM $BATCH_SIZE $INPUT_TRIE
END_TIME=$(date +%s)
echo "Total time $((END_TIME - START_TIME))s"
echo "Database size: $(du -sh $DB_PATH_TRIE_ORIGINAL)"
