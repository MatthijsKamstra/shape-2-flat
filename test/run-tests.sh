#!/bin/bash

echo "Running shape-2-flat tests..."
echo ""

echo "1. Path Segments Tests"
node test/path-segments.test.mjs
if [ $? -ne 0 ]; then
  echo "Path segments tests failed!"
  exit 1
fi

echo ""
echo "2. Shape Glue Tabs Tests"
node test/shape-glue-tabs.test.mjs
if [ $? -ne 0 ]; then
  echo "Shape glue tabs tests failed!"
  exit 1
fi

echo ""
echo "✅ All tests passed!"
