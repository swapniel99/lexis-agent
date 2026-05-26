#!/bin/bash
echo "Clearing state in directory: $PWD"

rm -rf state/memory.json state/artifacts/ sandbox/*.txt

echo "State cleared."
