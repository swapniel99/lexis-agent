#!/bin/bash
echo "Clearing state in directory: $PWD"

rm -rf state/index.faiss state/*.json state/artifacts/ sandbox/*.*

echo "State cleared."
