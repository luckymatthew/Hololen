#!/bin/zsh
set -e
cd "$(dirname "$0")/.."
python3 scripts/prepare-ios.py
open ios/HoloPocketLab.xcodeproj
