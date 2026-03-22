import os
import threading
import webbrowser
import time

def run_backend():
    os.system("cd sdmLab && uvicorn backend.main:app")

def run_frontend():
    os.system("cd sdmLab/frontend && npm start")

threading.Thread(target=run_backend).start()
time.sleep(2)
threading.Thread(target=run_frontend).start()

time.sleep(5)
webbrowser.open("http://localhost:3000")