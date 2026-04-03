import subprocess
import threading
import webbrowser
import time
import socket

def find_free_port(start=8000, end=8100):
    """Encontra a primeira porta livre no intervalo."""
    for port in range(start, end):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("localhost", port))
                return port
        except OSError:
            continue
    raise RuntimeError(f"Nenhuma porta livre encontrada entre {start} e {end}")

def run_backend(port):
    subprocess.run(
        ["uvicorn", "backend.main:app", "--port", str(port)],
        cwd="ecoLab"
    )

def run_frontend():
    subprocess.run(
        ["npm", "start"],
        cwd="ecoLab/frontend"
    )

def wait_for_port(host, port, timeout=30):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except (ConnectionRefusedError, OSError):
            time.sleep(0.5)
    return False


BACKEND_PORT = find_free_port(start=8000, end=8100)
FRONTEND_PORT = find_free_port(start=3000, end=3100)

print(f"🔌 Backend → porta {BACKEND_PORT}")
print(f"🔌 Frontend → porta {FRONTEND_PORT}")

threading.Thread(target=run_backend, args=(BACKEND_PORT,), daemon=True).start()

print("⏳ Aguardando backend subir...")
if wait_for_port("localhost", BACKEND_PORT):
    print("✅ Backend pronto!")
else:
    print("❌ Backend não respondeu a tempo.")
    exit(1)

threading.Thread(target=run_frontend, daemon=True).start()

print("⏳ Aguardando frontend subir...")
if wait_for_port("localhost", FRONTEND_PORT):
    print("✅ Frontend pronto!")
    webbrowser.open(f"http://localhost:{FRONTEND_PORT}")
else:
    print("❌ Frontend não respondeu a tempo.")
    exit(1)