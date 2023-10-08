#! /bin/bash

echo \> Code Build Start Time: $(date +%Y-%m-%dT%T.%3N)
basetime=$(date +%s%N)

echo \> Beautify JavaScript Code: .jsbeautifyrc
npx js-beautify -r 'js/**/*.js'
npx js-beautify -r '*/worker.js'
npx js-beautify -r '*/single.js'

runtime=$(echo "scale=9;($(date +%s%N) - ${basetime})/(1*10^09)" | bc)
echo \> Build Duration: $runtime Seconds
