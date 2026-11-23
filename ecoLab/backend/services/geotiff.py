"""
Leitor mínimo de GeoTIFF sem GDAL/rasterio.

Por que existe: o rasterio traz DLLs nativas da GDAL que o Windows (Smart App
Control / WDAC) pode bloquear. Aqui usamos só tifffile (Python puro) para ler a
estrutura do arquivo, pyproj para o CRS e numpy/zlib para decodificar. Se o
pacote opcional `imagecodecs` estiver instalado *e carregar*, ele acelera o LZW.

Suporta o que aparece em dados ambientais (WorldClim, SoilGrids, MapBiomas,
recortes do QGIS...):
  - strips ou tiles, TIFF ou BigTIFF, little/big endian
  - sem compressão, Deflate/ZIP, LZW, PackBits
  - predictor 2 (inteiros) e 3 (ponto flutuante)
  - georreferência por ModelPixelScale+ModelTiepoint ou ModelTransformation,
    PixelIsArea e PixelIsPoint (mesmo deslocamento de meio pixel da GDAL)
  - CRS por código EPSG nas GeoKeys
Lê sempre a banda 1, como o resto do EcoLab.

API (espelha o pedaço do rasterio que o raster_env usa):
    with open_geotiff(path) as src:
        src.width, src.height, src.res, src.bounds, src.nodata, src.crs
        src.rowcol(xs, ys)          -> (rows, cols) inteiros (floor)
        src.read_rows(r0, n)        -> ndarray (n, width) da banda 1
"""
from __future__ import annotations

import logging
import zlib
from dataclasses import dataclass

import numpy as np

# O tifffile reclama de nodata tipo -3.4e+38 (padrão do WorldClim) ao montar
# os metadados dele; nós lemos esse valor por conta própria, então silenciamos.
logging.getLogger("tifffile").setLevel(logging.ERROR)

# Tags TIFF / GeoTIFF
_MODEL_PIXEL_SCALE = 33550
_MODEL_TIEPOINT = 33922
_MODEL_TRANSFORMATION = 34264
_GEO_KEY_DIRECTORY = 34735
_GDAL_NODATA = 42113

# GeoKeys
_GT_MODEL_TYPE = 1024
_GT_RASTER_TYPE = 1025
_GEOGRAPHIC_TYPE = 2048
_GEOG_GEODETIC_DATUM = 2050
_PROJECTED_CS_TYPE = 3072
_USER_DEFINED = 32767
_PIXEL_IS_POINT = 2


class GeoTiffError(ValueError):
    pass


# ── Decodificadores ───────────────────────────────────────────────────────────
def _lzw_decode_py(data: bytes) -> bytes:
    """LZW do TIFF (MSB-first, "early change"). Python puro."""
    out = bytearray()
    table: list[bytes] = [bytes([i]) for i in range(256)] + [b"", b""]
    width, next_code = 9, 258
    bitbuf = nbits = 0
    prev: bytes | None = None
    pos, n = 0, len(data)
    while True:
        while nbits < width:
            if pos >= n:
                return bytes(out)
            bitbuf = (bitbuf << 8) | data[pos]
            pos += 1
            nbits += 8
        nbits -= width
        code = (bitbuf >> nbits) & ((1 << width) - 1)
        bitbuf &= (1 << nbits) - 1
        if code == 256:  # Clear
            del table[258:]
            width, next_code, prev = 9, 258, None
            continue
        if code == 257:  # EOI
            return bytes(out)
        if prev is None:
            entry = table[code]
        elif code < next_code:
            entry = table[code]
            table.append(prev + entry[:1])
            next_code += 1
        else:  # KwKwK
            entry = prev + prev[:1]
            table.append(entry)
            next_code += 1
        out += entry
        prev = entry
        if next_code + 1 >= (1 << width) and width < 12:
            width += 1


def _packbits_decode(data: bytes) -> bytes:
    out = bytearray()
    i, n = 0, len(data)
    while i < n:
        h = data[i]
        i += 1
        if h < 128:
            out += data[i:i + h + 1]
            i += h + 1
        elif h > 128:
            out += bytes([data[i]]) * (257 - h)
            i += 1
    return bytes(out)


def _pillow_lzw(data: bytes, expected: int) -> bytes:
    """LZW pela libtiff que vem dentro do Pillow (C, rápido).

    Embrulha o strip comprimido num TIFF mínimo de 8 bits com largura = bytes
    por linha; a libtiff descomprime e devolve os bytes crus (predictor e tipo
    de dado tratamos depois, em numpy).
    """
    import io
    import struct

    from PIL import Image

    width, height = expected, 1  # só importa o total de bytes
    tags = [  # (tag, tipo, contagem, valor) — tipo 3 = SHORT, 4 = LONG
        (256, 4, 1, width), (257, 4, 1, height), (258, 3, 1, 8), (259, 3, 1, 5),
        (262, 3, 1, 1), (273, 4, 1, 0), (277, 3, 1, 1), (278, 4, 1, height),
        (279, 4, 1, len(data)),
    ]
    ifd_size = 2 + 12 * len(tags) + 4
    data_offset = 8 + ifd_size
    out = io.BytesIO()
    out.write(b"II*\x00" + struct.pack("<I", 8) + struct.pack("<H", len(tags)))
    for tag, typ, cnt, val in tags:
        val = data_offset if tag == 273 else val
        out.write(struct.pack("<HHI", tag, typ, cnt) + (struct.pack("<HH", val, 0) if typ == 3 else struct.pack("<I", val)))
    out.write(struct.pack("<I", 0) + data)
    out.seek(0)
    old_limit = Image.MAX_IMAGE_PIXELS
    Image.MAX_IMAGE_PIXELS = None  # é o arquivo do próprio usuário, não precisa de trava anti-"bomba"
    try:
        with Image.open(out) as im:
            raw = im.tobytes()
    finally:
        Image.MAX_IMAGE_PIXELS = old_limit
    return raw[:expected]


def _pick_lzw():
    """Escolhe o decodificador LZW mais rápido que carregar nesta máquina."""
    sample = bytes.fromhex("80114c66f26184c42d26168ae2d379ac430f8080")  # b"EcoLab-LZW-ok!!!"
    expected = b"EcoLab-LZW-ok!!!"
    try:  # opcional; se o Windows bloquear a DLL, cai para o próximo
        from imagecodecs import lzw_decode  # type: ignore

        if lzw_decode(sample) == expected:
            return lambda data, n: lzw_decode(data)
    except Exception:
        pass
    try:
        if _pillow_lzw(sample, len(expected)) == expected:
            return _pillow_lzw
    except Exception:
        pass
    return lambda data, n: _lzw_decode_py(data)


_LZW = None


def _decompress(data: bytes, compression: int, expected: int) -> bytes:
    global _LZW
    if compression == 1:
        return data
    if compression in (8, 32946):  # Deflate / Adobe Deflate
        return zlib.decompress(data)
    if compression == 5:
        if _LZW is None:
            _LZW = _pick_lzw()
        return _LZW(data, expected)
    if compression == 32773:
        return _packbits_decode(data)
    raise GeoTiffError(
        f"Compressão TIFF {compression} não suportada. Regrave o arquivo com compressão "
        "DEFLATE ou LZW (no QGIS: Exportar > Salvar como, opção de criação COMPRESS=DEFLATE)."
    )


def _unpredict(seg: np.ndarray, predictor: int, dtype: np.dtype) -> np.ndarray:
    """seg: (rows, width, samples) já no dtype do arquivo (predictor 2) ou uint8 cru (3)."""
    if predictor == 1:
        return seg
    if predictor == 2:
        return np.cumsum(seg, axis=1, dtype=seg.dtype)
    if predictor == 3:  # ponto flutuante: bytes em planos (MSB primeiro) + diferença horizontal
        rows, nbytes = seg.shape
        acc = np.cumsum(seg, axis=1, dtype=np.uint8)
        bps = dtype.itemsize
        planes = acc.reshape(rows, bps, nbytes // bps)
        be = np.ascontiguousarray(planes.transpose(0, 2, 1)).view(dtype.newbyteorder(">"))
        return be.astype(dtype.newbyteorder("="))
    raise GeoTiffError(f"Predictor TIFF {predictor} não suportado.")


# ── CRS ───────────────────────────────────────────────────────────────────────
_GEOG_ELLIPSOID = 2056
_GEOG_SEMI_MAJOR = 2057
_GEOG_SEMI_MINOR = 2058
_GEOG_INV_FLATTENING = 2059
_GEO_DOUBLE_PARAMS = 34736


def _parse_geokeys(values, doubles=()) -> dict[int, float]:
    """GeoKeyDirectory -> {chave: valor}. Valores curtos vêm inline; os
    double (semi-eixo, achatamento...) vêm do tag GeoDoubleParams."""
    v = list(values)
    if len(v) < 4:
        return {}
    doubles = list(doubles or ())
    nkeys, keys = v[3], {}
    for k in range(nkeys):
        key, loc, count, val = v[4 + 4 * k: 8 + 4 * k]
        if loc == 0 and count == 1:
            keys[key] = val
        elif loc == _GEO_DOUBLE_PARAMS and count == 1 and val < len(doubles):
            keys[key] = doubles[val]
    return keys


def _crs_from_geokeys(keys: dict[int, float]):
    """Mesma lógica da GDAL para o casos que aparecem em dados ambientais."""
    from pyproj import CRS

    proj = keys.get(_PROJECTED_CS_TYPE)
    if proj and proj != _USER_DEFINED:
        return CRS.from_epsg(int(proj))
    geog = keys.get(_GEOGRAPHIC_TYPE)
    if geog and geog != _USER_DEFINED:
        return CRS.from_epsg(int(geog))

    is_geographic = keys.get(_GT_MODEL_TYPE) == 2 or (geog == _USER_DEFINED and not proj)
    if is_geographic:
        # Geográfico "user-defined": datum EPSG 6xxx corresponde ao GCS 4xxx
        # (ex.: 6326 -> EPSG:4326, 6008 Clarke 1866 -> EPSG:4008), como a GDAL faz.
        datum = keys.get(_GEOG_GEODETIC_DATUM)
        if datum and datum != _USER_DEFINED and 6001 <= datum <= 6999:
            try:
                return CRS.from_epsg(int(datum) - 2000)
            except Exception:
                pass
        ellipsoid = keys.get(_GEOG_ELLIPSOID)
        if ellipsoid and ellipsoid != _USER_DEFINED:
            from pyproj.crs import Ellipsoid

            ell = Ellipsoid.from_epsg(int(ellipsoid))
            return CRS.from_dict({"proj": "longlat", "a": ell.semi_major_metre,
                                  "rf": ell.inverse_flattening, "no_defs": True})
        a = keys.get(_GEOG_SEMI_MAJOR)
        rf = keys.get(_GEOG_INV_FLATTENING)
        b = keys.get(_GEOG_SEMI_MINOR)
        if a and (rf or b):
            params = {"proj": "longlat", "a": float(a), "no_defs": True}
            params.update({"rf": float(rf)} if rf else {"b": float(b)})
            return CRS.from_dict(params)
        return CRS.from_epsg(4326)  # geográfico sem mais nada: assume WGS84 (como a GDAL)

    if proj == _USER_DEFINED:
        raise GeoTiffError(
            "Projeção personalizada (sem código EPSG) não suportada. Reprojete o raster para "
            "EPSG:4326 (no QGIS: Raster > Projeções > Reprojetar camada)."
        )
    return None


def _parse_nodata(raw, dtype: np.dtype):
    """Nodata da GDAL vem como texto; como a GDAL/rasterio, convertemos para o
    tipo do raster (ex.: "-3.402823e+38" vira o float32 exato gravado nos pixels).
    Sem isso a comparação pixel == nodata falha e o 'sem dado' entra como valor."""
    if raw is None:
        return None
    try:
        value = float(str(raw).strip("\x00 "))
    except ValueError:
        return None
    if np.isnan(value):
        return value
    if dtype.kind == "f":
        with np.errstate(over="ignore"):
            cast = np.array(value).astype(dtype.newbyteorder("="))
        return float(cast) if np.isfinite(cast) else value
    info = np.iinfo(dtype)
    return float(int(value)) if info.min <= value <= info.max else value


# ── Arquivo ───────────────────────────────────────────────────────────────────
@dataclass
class _Layout:
    tiled: bool
    seg_w: int
    seg_h: int
    per_row: int  # segmentos por linha de segmentos
    offsets: tuple
    counts: tuple


class GeoTiff:
    def __init__(self, path: str):
        import tifffile

        self.path = path
        self._tif = tifffile.TiffFile(path)
        try:
            self._init_page(self._tif.pages.first if hasattr(self._tif.pages, "first") else self._tif.pages[0])
        except Exception:
            self._tif.close()
            raise

    # context manager
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def close(self):
        self._tif.close()

    def _init_page(self, page):
        tags = page.tags
        self.width, self.height = int(page.imagewidth), int(page.imagelength)
        self._samples = int(page.samplesperpixel)
        self._planar = int(page.planarconfig)
        self._compression = int(page.compression)
        self._predictor = int(page.predictor) if page.predictor else 1
        self._dtype = np.dtype(page.dtype).newbyteorder(self._tif.byteorder)
        if self._dtype.kind not in "uif":
            raise GeoTiffError(f"Tipo de dado {page.dtype} não suportado.")

        if page.is_tiled:
            sw, sh = int(page.tilewidth), int(page.tilelength)
            per_row = -(-self.width // sw)
        else:
            sw, sh = self.width, int(page.rowsperstrip or self.height)
            per_row = 1
        self._layout = _Layout(page.is_tiled, sw, min(sh, self.height) if not page.is_tiled else sh,
                               per_row, tuple(page.dataoffsets), tuple(page.databytecounts))
        self._cache: dict[int, np.ndarray] = {}

        nod = tags.get(_GDAL_NODATA)
        self.nodata = _parse_nodata(nod.value if nod else None, self._dtype)

        doubles = tags[_GEO_DOUBLE_PARAMS].value if _GEO_DOUBLE_PARAMS in tags else ()
        keys = _parse_geokeys(tags[_GEO_KEY_DIRECTORY].value, doubles) if _GEO_KEY_DIRECTORY in tags else {}
        self.crs = _crs_from_geokeys(keys)

        # transform no formato GDAL: x = c + col*a + row*b ; y = f + col*d + row*e
        if _MODEL_TRANSFORMATION in tags:
            m = tags[_MODEL_TRANSFORMATION].value
            a, b, c, d, e, f = m[0], m[1], m[3], m[4], m[5], m[7]
        elif _MODEL_PIXEL_SCALE in tags and _MODEL_TIEPOINT in tags:
            sx, sy = tags[_MODEL_PIXEL_SCALE].value[:2]
            i, j, _k, x, y = tags[_MODEL_TIEPOINT].value[:5]
            a, b, d, e = sx, 0.0, 0.0, -sy
            c, f = x - i * sx, y + j * sy
        else:
            raise GeoTiffError("O .tif não tem georreferência (não é um GeoTIFF).")
        if keys.get(_GT_RASTER_TYPE) == _PIXEL_IS_POINT:  # igual à GDAL
            c -= 0.5 * a + 0.5 * b
            f -= 0.5 * d + 0.5 * e
        self.transform = (float(a), float(b), float(c), float(d), float(e), float(f))
        self.res = (abs(float(a)), abs(float(e)))

    @property
    def bounds(self):
        a, b, c, d, e, f = self.transform
        xs = [c, c + a * self.width, c + b * self.height, c + a * self.width + b * self.height]
        ys = [f, f + d * self.width, f + e * self.height, f + d * self.width + e * self.height]
        return (min(xs), min(ys), max(xs), max(ys))

    def rowcol(self, xs, ys):
        """Linha/coluna do pixel que contém (x, y). Mesma conta do rasterio
        (matriz inversa da affine + produto matricial), para bater até na borda."""
        a, b, c, d, e, f = self.transform
        idet = 1.0 / (a * e - b * d)
        ra, rb, rd, re_ = e * idet, -b * idet, -d * idet, a * idet
        inv = np.array([[ra, rb, -c * ra - f * rb],
                        [rd, re_, -c * rd - f * re_],
                        [0.0, 0.0, 1.0]])
        xs = np.asarray(xs, dtype="float64").ravel()
        ys = np.asarray(ys, dtype="float64").ravel()
        m = np.empty((3, xs.size))
        m[0], m[1], m[2] = xs, ys, 1.0
        inv.dot(m, out=m)
        return np.floor(m[1]).astype(np.int64), np.floor(m[0]).astype(np.int64)

    # leitura
    def _segment(self, idx: int) -> np.ndarray:
        """Segmento (strip/tile) decodificado: (seg_h, seg_w) da banda 1."""
        seg = self._cache.get(idx)
        if seg is not None:
            return seg
        L = self._layout
        fh = self._tif.filehandle
        fh.seek(L.offsets[idx])
        samples = 1 if self._planar == 2 else self._samples
        if L.tiled:
            h = L.seg_h
        else:
            h = min(L.seg_h, self.height - (idx // L.per_row) * L.seg_h)
        w = L.seg_w
        need = h * w * samples * self._dtype.itemsize
        raw = _decompress(fh.read(L.counts[idx]), self._compression, need)
        buf = np.frombuffer(raw, dtype=np.uint8)
        if buf.size < need:
            buf = np.concatenate([buf, np.zeros(need - buf.size, np.uint8)])
        buf = buf[:need]

        if self._predictor == 3:
            arr = _unpredict(buf.reshape(h, w * samples * self._dtype.itemsize), 3, self._dtype)
            arr = arr.reshape(h, w, samples)
        else:
            arr = buf.view(self._dtype).reshape(h, w, samples).astype(self._dtype.newbyteorder("="))
            arr = _unpredict(arr, self._predictor, arr.dtype)
        seg = arr[:, :, 0]
        if len(self._cache) > 256:
            self._cache.clear()
        self._cache[idx] = seg
        return seg

    def read_rows(self, r0: int, n: int) -> np.ndarray:
        """Linhas [r0, r0+n) da banda 1."""
        L = self._layout
        n = min(n, self.height - r0)
        out = np.empty((n, self.width), dtype=self._dtype.newbyteorder("="))
        s0, s1 = r0 // L.seg_h, (r0 + n - 1) // L.seg_h
        for srow in range(s0, s1 + 1):
            top = srow * L.seg_h
            a0, a1 = max(r0, top), min(r0 + n, top + L.seg_h)
            for scol in range(L.per_row):
                seg = self._segment(srow * L.per_row + scol)
                x0 = scol * L.seg_w
                x1 = min(self.width, x0 + L.seg_w)
                out[a0 - r0:a1 - r0, x0:x1] = seg[a0 - top:a1 - top, : x1 - x0]
        # libera segmentos que já ficaram para trás (leitura é sequencial)
        for k in [k for k in self._cache if (k // L.per_row) < s0]:
            del self._cache[k]
        return out


def open_geotiff(path: str) -> GeoTiff:
    return GeoTiff(path)


def transform_bounds(crs, bounds, densify: int = 21):
    """Bounds (minx, miny, maxx, maxy) do CRS do raster para EPSG:4326."""
    if crs is None or crs.to_epsg() == 4326:
        return tuple(bounds)
    from pyproj import Transformer

    t = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    return tuple(t.transform_bounds(*bounds, densify_pts=densify))
