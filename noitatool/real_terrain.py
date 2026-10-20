"""Calibrated version of the supplied offline overview, shared by both maps."""
import json
from functools import lru_cache
from .paths import ROOT
from .map_capture import Capture

@lru_cache
def calibration():return json.loads((ROOT/'assets/real-terrain.json').read_text(encoding='utf-8'))

def reference_capture(seed,world=0,detailed=True):
    data=calibration();x,y=data['origin']
    result=Capture(ROOT/'assets/real-terrain.dzi',seed,world,x+world*35840,y,data['scale'])
    result.detailed=detailed;result.z=-100;result.max_visible_tiles=24
    return result
