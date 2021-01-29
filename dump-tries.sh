#!/bin/bash

HEAP_SIZE=32896
DB_PATH="/Users/kjezek/Library/Ethereum/geth/chaindata"

node --max-old-space-size=$HEAP_SIZE tries-load.js $DB_PATH
