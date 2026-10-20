"""Build the editable bundled text inventory and English/Chinese reference table."""
import ast
import json
import re
import sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(root))
values=set()
config=(root/'vendor/noita-telescope-main/js/generator_config.js').read_text(encoding='utf-8')
english={key:label for key,label in re.findall(r"'([^']+)'\s*:\s*\{[^\n]*?name:\s*\"([^\"]+)\"",config)}
(root/'assets/biome-english.json').write_text(json.dumps(english,ensure_ascii=False,indent=2),encoding='utf-8')
for path in (root/'noitatool').glob('*.py'):
    if path.name=='localization.py':continue
    for node in ast.walk(ast.parse(path.read_text(encoding='utf-8'))):
        if isinstance(node,ast.Constant) and isinstance(node.value,str):
            value=node.value
            if re.search('[\u4e00-\u9fff]',value) and len(value)<2000 and '<' not in value and '://' not in value and not value.startswith('.'):
                values.add(value)
(root/'assets/ui-texts.json').write_text(json.dumps(sorted(values),ensure_ascii=False,indent=2),encoding='utf-8')
from noitatool.localization import export_table
count=export_table(root/'assets/translation-template.zh_CN.json')
export_table(root/'assets/translation-template.zh_CN.csv')
print('Translation entries:',count)
