from pathlib import Path
import sys

ROOT = Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parent.parent))
APP_DIR = Path(sys.executable).resolve().parent if getattr(sys,'frozen',False) else ROOT
STATE = APP_DIR / 'data'
UPSTREAM = ROOT / 'vendor' / 'noita-tools-master'
DATA = UPSTREAM / 'src/services/SeedInfo/data'
