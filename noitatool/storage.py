"""Portable user state, separate from bundled, read-only game resources."""
import json
import shutil
from pathlib import Path
from .paths import APP_DIR


def initialize_storage(app_dir=None):
    base=Path(app_dir) if app_dir is not None else APP_DIR
    target=base/'data'
    target.mkdir(parents=True,exist_ok=True)
    marker=target/'.legacy-migration-v1.json'
    if marker.exists():return target
    # Copy durable user data only; browser/icon caches can be regenerated. Never
    # overwrite new settings or remove originals, including on a partial retry.
    entries=['settings.json','saved-searches','translations',
             '.cache/ui-preferences.json','.cache/daily-seed.json',
             '.cache/map-captures.json','.cache/map-tiles']
    legacy_runs=base/'artifacts'
    if legacy_runs.is_dir():
        entries.extend(str(p.relative_to(base)) for pattern in ('search-profile-*.json','search-flow-*.sqlite') for p in legacy_runs.glob(pattern))
    for entry in entries:
        source=base/entry
        files=source.rglob('*') if source.is_dir() else [source]
        for file in files:
            if not file.is_file():continue
            destination=target/file.relative_to(base)
            if destination.exists():continue
            destination.parent.mkdir(parents=True,exist_ok=True)
            temporary=destination.with_name(destination.name+'.migrating')
            shutil.copy2(file,temporary)
            temporary.replace(destination)
    registry=target/'.cache/map-captures.json'
    if registry.is_file():
        try:
            records=json.loads(registry.read_text(encoding='utf-8'))
            for record in records.values():
                path=Path(record['path'])
                if path.is_absolute() and path.is_relative_to(base/'.cache/map-tiles'):
                    record['path']=str(Path('.cache/map-tiles')/path.relative_to(base/'.cache/map-tiles'))
            registry.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
        except (ValueError,TypeError,KeyError,AttributeError):pass
    marker.write_text(json.dumps({'version':1,'source':str(base)},ensure_ascii=False),encoding='utf-8')
    return target
