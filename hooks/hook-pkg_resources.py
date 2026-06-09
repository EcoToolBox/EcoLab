# Hook customizado para garantir que pkg_resources é incluído corretamente
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hiddenimports = collect_all('pkg_resources')
hiddenimports += collect_submodules('pkg_resources')
hiddenimports += [
    'pkg_resources.extern',
    'pkg_resources._vendor',
    'pkg_resources._vendor.packaging',
    'pkg_resources._vendor.packaging.version',
    'pkg_resources._vendor.packaging.specifiers',
    'pkg_resources._vendor.packaging.requirements',
    'pkg_resources._vendor.jaraco',
    'pkg_resources._vendor.jaraco.text',
    'pkg_resources._vendor.more_itertools',
]
