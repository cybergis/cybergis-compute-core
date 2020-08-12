#!/bin/sh
if ! command -v $1 &> /dev/null 
then
echo "NOT_FOUND" 
fi