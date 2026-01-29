#!/bin/bash
# Simple script to run the web server locally

echo "🌟 Starting Truth Timeline Web Server..."
echo ""
echo "Install dependencies first:"
echo "  pip install -r requirements.txt"
echo ""
echo "Then access at: http://localhost:8000"
echo ""

cd "$(dirname "$0")"
python3 -m uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
