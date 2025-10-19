#!/bin/sh
mkdir -p build/
if [ ! -r build/_libs.js ]
then
    (cd third-party ; ./build-libs.sh)
fi
esbuild mapgen1-hexagons.ts --bundle --sourcemap --outfile=build/_bundle.js
