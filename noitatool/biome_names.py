"""Chinese labels and geographic names for distinct connected biome areas."""
NAMES={'coalmine':'矿坑','coalmine_alt':'坍塌矿坑','excavationsite':'煤矿','snowcave':'积雪深渊','snowcastle':'希斯基地','rainforest':'地下丛林','rainforest_open':'开阔丛林','vault':'避难所','crypt':'艺术神殿','fungicave':'真菌洞穴','fungiforest':'繁茂洞窟','rainforest_dark':'卢基巢穴 / 蜘蛛洞','wizardcave':'法师巢穴','liquidcave':'远古实验室','robobase':'发电站','vault_frozen':'冻结避难所','meat':'血肉领域','wandcave':'魔法神殿','sandcave':'砂之洞穴','winter_caves':'积雪裂隙','the_sky':'天界','the_end':'地狱','scale':'天平','winter':'积雪荒原','temple_wall':'圣山','temple_wall_ending':'终点圣山','temple_altar':'圣山','watercave':'黑暗洞穴','biome_watchtower':'瞭望塔','secret_lab':'废弃炼金实验室','dragoncave':'巨龙洞穴','clouds':'云境','gold':'黄金之地','pyramid':'金字塔','lake_deep':'深湖','lake':'湖面','lake_statue':'湖中岛','hills':'山丘','hills2':'西部山丘','desert':'沙漠','lava':'火山湖','lava_90percent':'火山湖深处','boss_arena':'实验室','boss_arena_top':'实验室上层','roboroom':'机械科尔密房间','meatroom':'血肉首领房间','wizardcave_entrance':'三角首领房间','mestari_secret':'王座室','ghost_secret':'被遗忘的房间','excavationsite_cube_chamber':'冥想方块室','snowcave_secret_chamber':'积雪深渊密室','snowcastle_cavern':'希斯沙漏商店','snowcastle_hourglass_chamber':'眼睛密室','biome_potion_mimics':'药水拟态神殿','biome_darkness':'不祥神殿','biome_boss_sky':'石之神殿','biome_barren':'荒芜神殿','lavalake':'熔岩湖','lavalake_pit':'熔岩湖深坑','water':'水域','empty':'空旷地带','teleroom':'传送室','snowcave_tunnel':'积雪隧道','mountain_lake':'山顶池塘','mountain_tree':'巨树','bridge':'桥梁'}
NAMES.update(holy_mountain='圣山商店',orbroom='魔球室',gourd_room='葫芦密室',gun_room='魔杖密室',ocarina='陶笛密室',robot_egg='机械蛋密室',friend_4='朋友密室',solid_wall='致密岩壁',solid_wall_tower='诅咒岩壁',boss_victoryroom='终点工作间',lavalake_racing='熔岩赛道')
NAMES.update(alchemist_secret='黑暗宝箱密室',essenceroom='大地精华密室',essenceroom_air='空气精华密室',essenceroom_alc='烈酒精华密室',essenceroom_hell='水之精华密室',funroom='真菌地图密室',moon_room='月亮密室',mountain_left_entrance='山体西侧入口',mountain_left_stub='山体西侧岩壁',mountain_right='山体东侧',mountain_right_stub='山体东侧岩壁',mystery_teleport='神秘传送区',null_room='虚无祭坛',roadblock='路障',rock_room='岩石密室',sky_light_injector='天空光照区',solid_wall_hidden_cavern='隐藏洞窟',solid_wall_temple='圣山岩壁',song_room='珊瑚宝箱密室',greed_room='贪婪密室')
NAMES.update({f'friend_{i}':f'朋友密室 · {i}' for i in range(1,7)})

def _biome_name(key):
    if key=='mountain_top':return '山顶'
    if key=='mountain_floating_island':return '山顶浮岛'
    if key=='mountain_hall':return '山体入口大厅'
    if key.startswith('pyramid_'):return '金字塔 · '+{'entrance':'入口','left':'左侧','top':'顶部','right':'右侧','hallway':'走廊'}.get(key.split('_',1)[1],'附属区域')
    if key in NAMES:return NAMES[key]
    if key.startswith('temple_'):return '圣山 · '+{'altar_left':'左侧','altar_right':'右侧','altar_right_snowcave':'积雪深渊出口','altar_right_snowcastle':'希斯基地出口'}.get(key[7:],'附属区域')
    if key.startswith('orbroom_'):return '魔球室 '+key.split('_')[-1]
    if key.startswith('solid_wall_tower_'):return '高塔 · 第 '+key.split('_')[-1]+' 区'
    return '特殊区域（'+key+'）'

def biome_name(key):
    from .localization import text
    return text(_biome_name(key),'biome:'+key)

def region_label(area):
    key=area['biomes'][0];x1,y1,x2,y2=area['bounds'];x=(x1+x2)/2;y=(y1+y2)/2
    base=biome_name(key)
    if key=='winter' and x<-8000 and y>-6000:base='积雪荒原地下遗迹'
    if key=='sandcave':base+=' · '+('金字塔下方' if y<3500 else '东侧上段' if y<5000 else '东侧深部')
    elif key=='meat':base+=' · '+('丛林东侧' if y<10000 else '东部深层')
    elif key=='wandcave':base+=' · '+('积雪深渊西侧' if x<0 else '东部深层')
    elif key=='wizardcave':base+=' · '+('蜘蛛洞邻接区' if x<0 else '东部上段' if y<13000 else '东部深层')
    elif key=='the_end':base+=' · '+('入口' if area.get('verticalIndex',0)==0 else f'区段 {area["verticalIndex"]}')
    elif key=='the_sky':base+=' · '+('顶部入口' if area.get('verticalIndex',0)==0 else f'区段 {area["verticalIndex"]}')
    return f'{base}（{x:g}, {y:g}）'
