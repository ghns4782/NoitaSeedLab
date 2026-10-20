"""Compare historical rescanning to incremental Qt result insertion."""
import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import statistics
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtWidgets import QApplication
from noitatool.app import configure_app
from noitatool.result_view import SeedResultView

app=QApplication([]);configure_app(app)
rows=[]
for count in (1000,100000,1000000):
    history=list(range(count));view=SeedResultView();view.append_seeds(history)
    old_times=[];new_times=[]
    for repeat in range(5):
        added=list(range(count+repeat*32,count+(repeat+1)*32))
        tick=time.perf_counter()
        old=set(history);incoming=history+added;copied=list(incoming)
        unused=[seed for seed in incoming if seed not in old]
        old_times.append(time.perf_counter()-tick)
        tick=time.perf_counter();view.append_seeds(added);new_times.append(time.perf_counter()-tick)
    row={'existing_results':count,'added_per_update':32,'old_history_scan_ms':round(statistics.median(old_times)*1000,3),'new_qt_insert_ms':round(statistics.median(new_times)*1000,3)}
    rows.append(row);print(json.dumps(row),flush=True);view.close()
Path('artifacts/result-update-benchmark.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
