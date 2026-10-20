# PyInstaller one-folder portable build, with local Node/WASM and map assets.
from pathlib import Path
import shutil
import importlib.metadata
import importlib.util
import sys
from PyInstaller.utils.hooks import collect_data_files,collect_submodules

root=Path(SPECPATH)
if importlib.util.find_spec('pyvips') is None:
    sys.path.insert(0,str(root/'.map-deps'))
node=shutil.which('node')
if not node:raise RuntimeError('Install Node.js 22+ before building')
sys.path.insert(0,str(root/'scripts'))
from prepare_worker import prepare_worker
worker=prepare_worker(node,root)
datas=[(str(root/'runtime'),'runtime'),(str(root/'vendor/noita-telescope-main/data'),'vendor/noita-telescope-main/data'),(str(root/'vendor/noita-tools-master/public/locales/zh'),'vendor/noita-tools-master/public/locales/zh'),(str(root/'vendor/noita-tools-master/public/favicon.ico'),'vendor/noita-tools-master/public'),(str(root/'noitatool/area_presets.json'),'noitatool'),(str(root/'noitatool/kernels.cl'),'noitatool'),(str(root/'README.md'),'.'),(str(root/'THIRD_PARTY.md'),'.')]
# Runtime Python reads only this catalogue. Algorithm JSON imports are already
# embedded by esbuild; upstream Entity/Map providers are not in the engine graph.
catalogue=root/'vendor/noita-tools-master/src/services/SeedInfo/data'
for relative in ['LICENCE','materials.json','wands.json','starting-flask-materials.json',
                 'obj/perks.json','obj/spells.json','obj/biome_modifiers.json']:
    path=catalogue/relative
    datas.append((str(path),str(path.parent.relative_to(root))))
for wasm in (root/'vendor/noita-tools-master/src/services/SeedInfo').rglob('*.wasm'):
    datas.append((str(wasm),str(wasm.parent.relative_to(root))))
for package in ['@napi-rs/canvas','@napi-rs/canvas-win32-x64-msvc','upng-js','pako']:
    datas.append((str(root/'node_modules'/package),'node_modules/'+package))
datas.append((str(root/'vendor/noita-tools-master/public/locales/en'),'vendor/noita-tools-master/public/locales/en'))
datas.append((str(root/'assets'),'assets'))
datas+=collect_data_files('pyopencl')
vips_dist=importlib.metadata.distribution('pyvips-binary')
map_binaries=[(str(vips_dist.locate_file(path)),'.') for path in vips_dist.files or [] if str(path).lower().endswith('.dll')]
a=Analysis([str(root/'main.py')],pathex=[str(root),str(root/'.map-deps')],binaries=[(worker,'.')]+map_binaries,datas=datas,hiddenimports=collect_submodules('noitatool')+collect_submodules('pyvips')+['_libvips'],excludes=['PyQt5','PyQt6','PySide2','torch','tensorflow','matplotlib','pandas','scipy','IPython','tkinter','PySide6.QtWebEngineCore','PySide6.QtWebEngineWidgets','PySide6.QtWebEngineQuick','PySide6.QtWebChannel'],noarchive=False)
# PySide wheels use Windows' unversioned ICU API. Conda's same-named ICU DLL
# exports version-suffixed symbols and must not shadow the OS library.
# Keep raster rendering, native Windows input, all image codecs except PDF,
# offscreen diagnostics, TLS, and base Qt translations. Do not remove the
# software OpenGL fallback used on systems without working graphics drivers.
unused_qt={'qt6quick.dll','qt6qml.dll','qt6qmlmeta.dll','qt6qmlmodels.dll',
           'qt6qmlworkerscript.dll','qt6pdf.dll','qt6virtualkeyboard.dll',
           'qpdf.dll','qtvirtualkeyboardplugin.dll','qdirect2d.dll','qminimal.dll'}
def keep_binary(entry):
    name=Path(entry[0]).name.lower()
    return name not in unused_qt|{'icuuc.dll','icudt78.dll'}
a.binaries=[entry for entry in a.binaries if keep_binary(entry)]
a.datas=[entry for entry in a.datas if not (
    entry[0].replace('\\','/').startswith('PySide6/translations/')
    and not Path(entry[0]).name.startswith('qtbase_'))]
pyz=PYZ(a.pure)
exe=EXE(pyz,a.scripts,[],exclude_binaries=True,name='NoitaSeedLab',console=False,icon=str(root/'vendor/noita-tools-master/public/favicon.ico'),version=str(root/'scripts/noitaseedlab-version.txt'))
licenses=[('licenses/noita-tools-LICENSE',str(root/'vendor/noita-tools-master/LICENSE'),'DATA'),('licenses/noita-telescope-LICENSE',str(root/'vendor/noita-telescope-main/LICENSE'),'DATA'),('licenses/node-LICENSE',str(root/'licenses/node-LICENSE'),'DATA')]
for package in ('PySide6','PySide6_Essentials','PySide6_Addons','shiboken6','numpy','pyopencl'):
    try:dist=importlib.metadata.distribution(package)
    except importlib.metadata.PackageNotFoundError:continue
    for file in dist.files or []:
        if '.dist-info/licenses/' in str(file).replace('\\','/'):
            source=Path(dist.locate_file(file))
            if source.is_file():licenses.append(('licenses/'+package+'/'+str(file).split('/licenses/',1)[-1],str(source),'DATA'))
for dist_info in (root/'.map-deps').glob('*.dist-info'):
    for source in (dist_info/'licenses').rglob('*'):
        if source.is_file():licenses.append(('licenses/map-import/'+dist_info.name+'/'+str(source.relative_to(dist_info/'licenses')),str(source),'DATA'))
for source in (root/'licenses/map-import').glob('*.txt'):licenses.append(('licenses/map-import/'+source.name,str(source),'DATA'))
coll=COLLECT(exe,a.binaries,a.datas,licenses,name='NoitaSeedLab')
