#!/bin/bash
# Start the backend server
# Usage: ./start.sh

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
