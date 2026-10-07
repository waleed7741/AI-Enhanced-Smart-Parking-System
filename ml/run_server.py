"""
Production-mode Flask launcher — no auto-reloader, stable process.
Run with: .venv\Scripts\python.exe run_server.py
"""
import os
import sys

# Force UTF-8 for Windows terminals to avoid emoji encoding crashes
os.environ['PYTHONUTF8'] = '1'
os.environ['PYTHONIOENCODING'] = 'utf-8'
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

from app import app

if __name__ == '__main__':
    print("[START] Smart Parking Flask Server starting on port 5000...")
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=False,      # No debug mode = no auto-reloader, stable process
        use_reloader=False
    )
