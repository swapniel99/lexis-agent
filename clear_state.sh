#!/bin/bash
echo "Clearing state: $PWD/state"

rm -rf state/memory.json state/artifacts/ sandbox/*.txt

echo "State cleared."
