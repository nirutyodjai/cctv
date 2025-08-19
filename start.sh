#!/bin/bash

echo "Starting CCTV Planner Server..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed!"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Start server
echo
echo "Starting server on http://localhost:3000"
echo "Press Ctrl+C to stop the server"
echo
npm start
