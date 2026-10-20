"""Explicit build diagnostic; never runs during normal desktop startup."""
import json,traceback
from pathlib import Path

def run(report):
    result={}
    try:
        from PySide6.QtWidgets import QApplication,QDialog
        from .app import Window,configure_app
        from .engine import Engine
        from .areas import PRESETS,main_range
        from .rules_ui import RuleDialog
        from .gpu import devices
        app=QApplication([]);configure_app(app)
        from .paths import STATE,APP_DIR
        from .startup import StartupNotice
        assert STATE==APP_DIR/'data' and STATE.is_dir()
        result['dataDirectory']=str(STATE)
        from PySide6.QtCore import QTimer
        for index in range(2):
            notice=StartupNotice(index);QTimer.singleShot(0,notice.continue_button.click)
            assert notice.exec()==QDialog.Accepted
        result['startupNotices']=2
        with Engine() as e:
            progress=[];info=e.info(123);data=e.request(op='map',seed=1234,on_progress=progress.append);area=e.request(op='layer',seed=1234,layer=0)
            assert progress[0]['value']==0 and progress[-1]['value']==100
            assert any(p.get('item')=='emerald_tablet' for p in data['pois'])
            result['mapProgress']=[p['value'] for p in progress]
            result.update(holyMountains=len(info['shop']),mapObjects=len(data['pois']),areaItems=len(area['items']))
            rule={'type':'layerSpells','val':{'ranges':[main_range(0)],'ids':['BLACK_HOLE'],'mode':'any'}}
            result['search']=e.search(123,124,rule)
            assert e.search(1,30,{'type':'advanced','val':{'type':'startingFlask','val':'water'}})==e.search(1,30,{'type':'startingFlask','val':'water'})
        w=Window();w.seed.setText('123');w.display_info((123,info));w.map_page.display_map(data)
        dialog=RuleDialog(w,rule);dialog.show();app.processEvents();result['namedRegions']=len(PRESETS);result['normalEditor']=dialog.widgets['ranges'].values()
        from .range_ui import RangeMapDialog
        selector=dialog.widgets['ranges'];picker=RangeMapDialog(selector)
        assert picker.data['bundledReference'];picker.clear_button.click();assert selector.values()==[];picker.close();dialog.close()
        assert w.map_page.terrain_layer.path.is_file()
        assert not hasattr(w.map_page,'source_mode') and not hasattr(w.map_page,'reference')
        if getattr(__import__('sys'),'frozen',False):
            from .paths import ROOT as resource_root
            assert not list(resource_root.rglob('*WebEngine*'))
        result['embeddedBrowser']=False
        assert w.map_page.terrain_layer and w.map_page.terrain_layer.path.name=='real-terrain.dzi'
        w.map_page.canvas.resize(1000,700);w.map_page.fit_region();w.map_page.terrain_layer.refresh(w.map_page.canvas)
        assert w.map_page.terrain_layer.items
        result['realTerrainVisibleTiles']=len(w.map_page.terrain_layer.items)
        result['fixedOrbs']=sum(p.get('item')=='orb' for p in data['pois'])
        result['tablets']=sum(p.get('item')=='emerald_tablet' for p in data['pois'])
        temples=[a for a in data['regions'] if any(k.startswith('temple_') for k in a['biomes'])]
        assert len(temples)==7 and 'temple_altar' in temples[0]['biomes'] and 'temple_wall' in temples[0]['biomes']
        from .localization import base_entries,parse_table
        from .paths import ROOT
        assert parse_table(ROOT/'assets/translation-template.zh_CN.json')['kiuaskivi']=='火石'
        assert all(row['chinese'] for row in base_entries().values() if row['english'])
        assert w.pages.count()==4 and w.settings_tabs.count()==2
        w.nav.setCurrentRow(2);w.show();app.processEvents()
        assert w.map_page.canvas.height()>w.height()*.70
        assert w.map_page.floating_tools.parentWidget() is w.map_page.canvas.viewport()
        result['mapViewportHeight']=w.map_page.canvas.height()
        assert w.map_page.overlay_item is not None
        from .map_ui import poi_filter
        assert poi_filter({'type':'pickup','item':'emerald_tablet'})=='tablet'
        assert poi_filter({'type':'pickup','item':'heart'})=='health'
        from .image_import import prepare_raster
        tile_path=prepare_raster(ROOT/'assets/world-reference.jpg')
        assert tile_path.is_file();result['streamedImport']=True
        from .capture_editor import CaptureEditor
        from PySide6.QtCore import QPointF,QRectF
        editor=CaptureEditor(tile_path,data['seed'],data['worldOffset'],w)
        assert len(editor.crop_frame.handles)==len(editor.map_frame.handles)==8
        editor.crop_frame.resize_at(0,QPointF(5,5))
        editor.map_frame.set_world_rect(QRectF(-1000,500,1200,900))
        edited=editor.capture();assert edited.crop[0]>0 and edited.crop[1]>0
        assert edited.bounds()==QRectF(-1000,500,1200,900)
        w.map_page.capture_ready(edited);assert w.map_page.capture_visible.isChecked()
        # Use the editor and rendering without changing a user's registrations.
        edited.detach();w.map_page.capture=None;w.map_page.reset_capture_view();editor.close()
        from .map_ui import HolyShopMarker
        w.map_page.precise.setChecked(True);w.map_page.filters['spell'].setChecked(True)
        shop=next(p for p in data['pois'] if p.get('source')=='holy_mountain')
        bounds=QRectF(*shop['shopBounds']);w.map_page.canvas.resetTransform();w.map_page.canvas.scale(4,4);w.map_page.canvas.centerOn(bounds.center());w.map_page.update_markers()
        assert any(isinstance(marker,HolyShopMarker) for marker in w.map_page.markers)
        result['captureEditor']=True;result['holyShopReadableInPreciseMode']=True
        from .map_ui import poi_title
        assert poi_title({'type':'pickup','item':'kiuaskivi','label':'kiuaskivi'})=='火石'
        result.update(mergedHolyMountains=len(temples),translationEntries=len(base_entries()))
        from .item_info import wiki_url
        from .catalog import name
        assert name('egg_worm')!='egg worm';assert 'LIGHT_BULLET' not in wiki_url('LIGHT_BULLET')
        result['bundledReference']=True;result['offlineReference']=True;result['externalWiki']=wiki_url('LIGHT_BULLET')
        result['gpuDevices']=[str(d) for d in devices()]
        if result['gpuDevices']:
            from .gpu import GPU
            gpu_rule={'type':'startingFlask','val':'water'}
            with Engine() as verifier:expected=verifier.search(1,4097,gpu_rule)
            gpu=GPU(gpu_rule)
            assert gpu.candidates(1,4097)==expected
            sparse=[1,123,5151515,2147483645]
            with Engine() as verifier:expected_sparse=verifier.search(1,2,gpu_rule,seeds=sparse)
            assert gpu.candidate_seeds(sparse)==expected_sparse
            result['gpuVerifiedSeeds']=4096;result['gpuSparseVerified']=True
        w.close()
        if __import__('os').name=='nt':
            import sys
            from .process_probe import verify_owner_exit
            command=[sys.executable] if getattr(sys,'frozen',False) else [sys.executable,str(ROOT/'main.py')]
            result['processOwnership']=verify_owner_exit(command,STATE)
        result['ok']=True
    except Exception:result.update(ok=False,error=traceback.format_exc())
    Path(report).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return 0 if result['ok'] else 1
