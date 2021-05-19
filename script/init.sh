#!/bin/bash
echo "installing node modules..."
npm install

echo "copying config files..."
cp -i ./config.example.json ./config.json
cp -i ./configs/hpc.example.json ./configs/hpc.json
cp -i ./configs/maintainer.example.json ./configs/maintainer.json
