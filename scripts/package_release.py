"""Create a portable ZIP without distributing settings, caches or searches."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED


def package(release,output):
    release=Path(release).resolve();output=Path(output).resolve()
    brand='NoitaSeedLab' if (release/'NoitaSeedLab.exe').is_file() else 'Noitatool'
    if not (release/(brand+'.exe')).is_file():raise ValueError('Missing executable')
    if output.is_relative_to(release):raise ValueError('Archive must be outside the release folder')
    files=sorted(p for p in release.rglob('*') if p.is_file() and p.relative_to(release).parts[0]!='data')
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output,'x',compression=ZIP_DEFLATED,compresslevel=9) as archive:
        for path in files:archive.write(path,str(Path(brand)/path.relative_to(release)))
    with ZipFile(output) as archive:
        if archive.testzip() is not None:raise RuntimeError('ZIP integrity check failed')
        assert not any(name.startswith(brand+'/data/') for name in archive.namelist())
    result={'archive':str(output),'archiveBytes':output.stat().st_size,
            'uncompressedBytes':sum(p.stat().st_size for p in files),'files':len(files),
            'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'zipIntegrity':'passed','userDataIncluded':False}
    output.with_suffix('.zip.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('release',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();package(args.release,args.output)
