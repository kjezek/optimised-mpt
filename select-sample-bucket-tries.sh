#!/bin/bash

HEAP_SIZE=64000
DB_PATH_BUCKET_TRIE="db-bucket-trie"
PARALLELISM=1
INPUT_TRIE="csv_sample/trie_11000000_11_0xbb91d90516ce901742bfd5d73e4bf99b510776ef941e1f86ea8a1fd7d0d2e2c5.csv"
TEMP_DB="db-tmp"
SPEED_FILE="speed-bucket-trie.csv"

rm $SPEED_FILE
for max_height in 3 5 7 9 11; do
  rm -rf $TEMP_DB
  mkdir $TEMP_DB
  START_TIME=$(date +%s)
  node --max-old-space-size=$HEAP_SIZE bucket-trie-select.js "${DB_PATH_BUCKET_TRIE}_${max_height}" $PARALLELISM 1 $max_height $INPUT_TRIE
  END_TIME=$(date +%s)
  echo "Total time $((END_TIME - START_TIME))s"
  cp $SPEED_FILE "speed-bucket-trie-select-sample.csv"
done
