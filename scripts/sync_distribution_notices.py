"""Refresh standalone notices without rebuilding unchanged executable code."""
from pathlib import Path
import importlib.metadata,shutil,sys
root=Path(__file__).resolve().parent.parent
candidates=[*root.glob('dist/releases/*/NoitaSeedLab/_internal'),*root.glob('dist/releases/*/Noitatool/_internal')]
target=Path(sys.argv[1]).resolve()/'_internal' if len(sys.argv)>1 else max(candidates,key=lambda p:p.stat().st_mtime)
for source,name in [(root/'vendor/noita-tools-master/LICENSE','noita-tools-LICENSE'),(root/'vendor/noita-telescope-main/LICENSE','noita-telescope-LICENSE'),(root/'licenses/node-LICENSE','node-LICENSE')]:
    out=target/'licenses'/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,out)
for package in ('PySide6','PySide6_Essentials','PySide6_Addons','shiboken6','numpy','pyopencl'):
    try:dist=importlib.metadata.distribution(package)
    except importlib.metadata.PackageNotFoundError:continue
    for file in dist.files or []:
        relative=str(file).replace('\\','/')
        if '.dist-info/licenses/' not in relative:continue
        source=Path(dist.locate_file(file))
        if source.is_file():
            out=target/'licenses'/package/relative.split('/licenses/',1)[-1];out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,out)
for name in ('README.md','THIRD_PARTY.md'):shutil.copy2(root/name,target/name)
print('Distribution notices refreshed')
