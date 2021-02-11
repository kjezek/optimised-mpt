#!/bin/bash

HEAP_SIZE=32000
DB_PATH_BUCKET_TRIE="db-bucket-trie"
PARALLELISM=1
INPUT_TRIE="csv_dump/trie_11000000_11_0xbb91d90516ce901742bfd5d73e4bf99b510776ef941e1f86ea8a1fd7d0d2e2c5.csv"


i=1
#for i in 1 10 100 1000 10000 100000 1000000 10000000; do
  for max_height in 3 5 7 9 11; do
    rm -rf $DB_PATH_BUCKET_TRIE
    START_TIME=$(date +%s)
    node --max-old-space-size=$HEAP_SIZE bucket-trie-insert.js $DB_PATH_BUCKET_TRIE $PARALLELISM $i $max_height $INPUT_TRIE
    END_TIME=$(date +%s)
    echo "Total time $((END_TIME - START_TIME))s"
    echo "Database size: $(du -sh $DB_PATH_BUCKET_TRIE)"
  done
#done