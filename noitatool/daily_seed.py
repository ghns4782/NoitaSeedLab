"""Fetch the current daily seed, caching only within its UTC date."""
import json
import urllib.request
from datetime import datetime,timezone
from .engine import valid_seed
from .paths import STATE as ROOT

def current_daily_seed(force=False):
    today=datetime.now(timezone.utc).date().isoformat()
    path=ROOT/'.cache'/'daily-seed.json'
    if not force:
        try:
            data=json.loads(path.read_text(encoding='utf-8'))
            if data['date']==today:return valid_seed(data['seed']),today
        except (OSError,ValueError,KeyError,TypeError):pass
    errors=[]
    for url in ('https://takapuoli.noitagame.com/callback/','https://noitool.com/api/daily-seed'):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'Noitool/1.0'})
            with urllib.request.urlopen(request,timeout=8) as response:
                text=response.read(4096).decode('utf-8')
            seed=valid_seed(json.loads(text)['seed'] if 'api/daily-seed' in url else text.split(';')[1].strip())
            # A request crossing midnight must not stamp the new date on an old response.
            if datetime.now(timezone.utc).date().isoformat()!=today:raise ValueError('日期已切换，请重新获取每日种子')
            try:
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(json.dumps({'date':today,'seed':seed}),encoding='utf-8')
            except OSError:pass
            return seed,today
        except Exception as exc:errors.append(str(exc))
    raise RuntimeError('无法获取每日挑战种子，请检查网络后重试。'+' / '.join(errors))
