# Runtime hook: garante que pkg_resources está disponível antes do app iniciar.
# Necessário no macOS onde o pyi_rth_pkgres pode falhar.
try:
    import pkg_resources
except ImportError:
    import sys
    import os
    # Tenta localizar setuptools dentro do bundle
    for path in sys.path:
        candidate = os.path.join(path, 'pkg_resources')
        if os.path.isdir(candidate):
            break
