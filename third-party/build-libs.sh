#!/bin/sh
# To avoid having to use a build step on the main project, we bundle the third party
# libraries here into an es6 module, which can then be imported from the main project
#
# Run this in the third-party/ directory

pnpm install

# NOTE: simplex-noise is from https://github.com/jwagner/simplex-noise.js , license: MIT
echo 'export * from "simplex-noise";' | esbuild --bundle --format=esm --outfile=_libs.js
