#!/bin/sh
export PORT=3001
export BROWSER=none
export NODE_OPTIONS=--max_old_space_size=4096
npx react-scripts start
