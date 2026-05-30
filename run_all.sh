#!/usr/bin/env bash
set -e

echo "Testing all queries..."
sleep 10

DIR="$(dirname "$0")"

echo "=== Query A ==="
bash "$DIR/run_query.sh" a
sleep 2

echo ""
echo "=== Query B ==="
bash "$DIR/run_query.sh" b
sleep 2

echo ""
echo "=== Query C1 ==="
bash "$DIR/run_query.sh" c1
sleep 2

echo ""
echo "=== Query C2 (no-clear) ==="
bash "$DIR/run_query.sh" c2 --no-clear
sleep 2

echo ""
echo "=== Query D ==="
bash "$DIR/run_query.sh" d
sleep 2

echo ""
echo "=== Query E ==="
bash "$DIR/run_query.sh" e
sleep 2

echo ""
echo "=== Query F1 ==="
bash "$DIR/run_query.sh" f1
sleep 2

echo ""
echo "=== Query F2 (no-clear) ==="
bash "$DIR/run_query.sh" f2 --no-clear
sleep 2

echo ""
echo "=== Query G ==="
bash "$DIR/run_query.sh" g
