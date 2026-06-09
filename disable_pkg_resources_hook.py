# Runtime hook: substitui o pyi_rth_pkgres que falha no macOS.
# Injeta pkg_resources no sys.modules diretamente via setuptools.
import sys

if 'pkg_resources' not in sys.modules:
    try:
        import importlib
        import os

        # pkg_resources fica dentro do diretório do setuptools no bundle
        for base in sys.path:
            candidate = os.path.join(base, 'pkg_resources', '__init__.py')
            if os.path.isfile(candidate):
                spec = importlib.util.spec_from_file_location(
                    'pkg_resources', candidate,
                    submodule_search_locations=[os.path.dirname(candidate)]
                )
                mod = importlib.util.module_from_spec(spec)
                sys.modules['pkg_resources'] = mod
                spec.loader.exec_module(mod)
                break
    except Exception:
        pass