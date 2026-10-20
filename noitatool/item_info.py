"""Chinese pickup names, concise effects and external wiki navigation."""
from urllib.parse import urlencode
from PySide6.QtCore import QUrl
from PySide6.QtGui import QDesktopServices

# Item identifiers are supplied by the local Telescope generator.
ITEMS={
    'treasure':('高塔宝藏','高塔顶端的奖励；部分魔杖属性受到运行时状态影响。'),
    'portal':('传送门','进入后传送至关联地点。'),
    'egg':('蛋','投掷破碎后可孵出对应生物；不同种类的蛋会产生不同生物。'),
    'alchemist_boss':('高阶炼金术士','实验室中的首领。'),
    'blocked_by_unlock':('尚未解锁','此资源受法术或物品解锁进度影响。'),
    'buried_eye_teleporter':('埋藏之眼传送器','与眼睛图案谜题有关的传送装置。'),
    'dragon':('巨龙','地下丛林附近的首领。'),
    'eye_room':('眼睛密室','与眼睛图案谜题相关的隐藏房间。'),
    'holy_mountain_shop':('圣山商店','购买魔杖或法术的商店。'),
    'laboratory':('实验室','地下主路线终点附近的区域。'),
    'meditation_cube':('冥想方块','可触发与冥想有关的隐藏房间。'),
    'pit_boss':('魔杖鉴赏家','熔岩湖深坑附近的首领。'),
    'puzzle':('谜题','此处有特殊交互或谜题。'),
    'pyramid_boss':('金字塔首领','金字塔内部的首领。'),
    'shop':('商店','在此处购买资源。'),
    'starting_loadout':('初始装备','开局携带的魔杖、法术和药水。'),
    'statue_hand':('手形雕像','与隐藏交互有关的雕像。'),
    'tiny':('小不点','深湖区域的大型生物。'),
    'trailer_altar':('秘密祭坛','与隐藏交互有关的祭坛。'),
    'triangle_boss':('三角首领','法师巢穴入口附近的首领。'),
    'utility_box':('工具箱','打开后可获取资源。'),
    'vault_puzzle':('避难所谜题','避难所内的隐藏谜题。'),
    'egg_fire':('火焰蛋','投掷破碎后孵出火焰生物。'),
    'egg_monster':('怪物蛋','投掷破碎后孵出怪物。'),
    'egg_purple':('紫色蛋','投掷破碎后孵出怪物。'),
    'egg_slime':('黏液蛋','投掷破碎后孵出黏液生物。'),
    'egg_worm':('蠕虫蛋','投掷破碎后孵出蠕虫，可能破坏周围地形。'),
    'emerald_tablet':('翡翠石板','记载炼金术文字；可投掷造成物理伤害，也可用于祭坛。'),
    'heart':('生命上限','拾取后增加最大生命值。'),
    'heart_bigger':('大型生命上限','拾取后增加更多最大生命值。'),
    'heart_mimic':('拟态生命之心','伪装成生命之心的危险生物。'),
    'full_heal':('完全治疗','恢复生命值。'),
    'spell_refresh':('法术恢复','恢复有限使用次数法术的使用次数。'),
    'potion':('药水瓶','可喷洒或饮用瓶中材料；效果取决于内容物。'),
    'potion_empty':('空药水瓶','可装入接触到的液体。'),
    'pouch':('粉末袋','收集或倾倒粉末材料。'),
    'bomb':('炸弹','投掷后爆炸，可破坏地形并造成伤害。'),
    'broken_wand':('损坏的魔杖','带往希斯基地的铁砧可尝试修复。'),
    'evil_eye':('邪眼','朝指向方向发射可挖掘地形的光束。'),
    'paha_silma':('邪眼','朝指向方向发射可挖掘地形的光束。'),
    'ukkoskivi':('雷霆石','使附近液体带电，接触带电液体可能受伤。'),
    'kiuaskivi':('火石','点燃附近可燃物，并加热周围液体。'),
    'vuoksikivi':('水石','可产生水。'),
    'kuu':('月亮石','影响附近物体的重力运动。'),
    'stonestone':('大地石','与地形材料有关的特殊石头。'),
    'kammi':('卡米小屋','投掷后可生成一间小屋。'),
    'chaos_die':('混沌骰子','投掷后触发随机效果，可能带来危险。'),
    'greed_die':('贪婪骰子','与诅咒和贪婪有关的特殊骰子。'),
    'greed_curse':('贪婪诅咒','与贪婪诅咒事件有关的物品。'),
    'greed_orb':('贪婪魔球','与贪婪诅咒有关的魔球。'),
    'gold':('金币','可用于购买物品。'),
    'gold_rain':('黄金雨','与黄金奖励有关的特殊物品。'),
    'orb':('真知魔球','收集后影响最终战斗和结局条件。'),
    'true_orb':('真知魔球','收集后影响最终战斗和结局条件。'),
    'orb_cursed':('诅咒魔球','平行世界中的魔球，拾取可能带来诅咒。'),
    'sampo':('三眼之物','用于完成游戏的特殊任务物品。'),
    'key':('水晶钥匙','可与特定音乐和宝箱谜题互动。'),
    'music_machine':('音乐机器','用于音乐相关谜题。'),
    'shiny_orb':('闪亮魔球','特殊的可互动魔球。'),
    'scroll':('卷轴','可阅读的文字物品。'),
    'gourd':('葫芦','特殊的可拾取容器。'),
    'jar':('罐子','可拾取并投掷的容器。'),
    'jar_mask':('罐子外观','容器的外观标记。'),
    'potion_mask':('药水瓶外观','药水容器的外观标记。'),
    'pouch_mask':('粉末袋外观','粉末容器的外观标记。'),
    'mimic_potion':('拟态药水瓶','伪装成药水瓶的危险生物。'),
    'mimic':('拟态宝箱','伪装成宝箱的危险生物。'),
    'refresh_mimic':('拟态法术恢复','伪装成法术恢复物品的危险生物。'),
    'chest':('宝箱','打开后掉落物品；内容由种子与位置决定。'),
    'great_chest':('大型宝箱','打开后掉落多种奖励。'),
    'chest_leggy':('长腿宝箱','会移动的特殊宝箱。'),
    'pacifist_chest':('和平宝箱','不击杀敌人到达圣山时出现的奖励。'),
    'kakkakikkare':('粪块','可拾取并投掷的物品。'),
    'runestone_edges':('边缘符文石','激活后改变附近投射物的运动。'),
    'runestone_emptiness':('虚空符文石','激活后清除附近投射物。'),
    'runestone_fire':('火焰符文石','激活后产生与火焰有关的效果。'),
    'runestone_light':('光明符文石','激活后产生光亮。'),
    'runestone_magma':('岩浆符文石','激活后产生岩浆相关效果，使用时注意安全距离。'),
    'runestone_metal':('金属符文石','激活后影响附近金属物体。'),
    'runestone_weight':('重力符文石','激活后影响附近物体的重力。'),
}
EFFECTS={
    'water':'可冲洗身上的油、毒液等；浸湿后有助于灭火。',
    'blood':'浸染可带来暴击率加成；可作为炼金和真菌转移材料。',
    'oil':'易燃且滑；沾上后更容易燃烧。',
    'alcohol':'可燃；饮用或浸染会产生醉酒效果。',
    'acid':'腐蚀地形和生物，接触会造成伤害。',
    'lava':'高温液体，接触会造成严重伤害。',
    'magic_liquid_teleportation':'浸染后可触发传送；传送目的地可能危险。',
    'magic_liquid_unstable_teleportation':'浸染后会发生不稳定的随机传送。',
    'magic_liquid_polymorph':'可将生物暂时变成绵羊，变形期间非常脆弱。',
    'magic_liquid_random_polymorph':'可将生物随机变成其他生物。',
    'magic_liquid_unstable_polymorph':'可使生物发生不稳定变形。',
    'magic_liquid_invisibility':'浸染后提供隐形；攻击或受到其他浸染可能打断。',
    'magic_liquid_berserk':'提供狂暴效果，提高造成的伤害。',
    'magic_liquid_faster_levitation':'提高飞行能力。',
    'magic_liquid_movement_faster':'提高移动速度。',
    'magic_liquid_mana_regeneration':'快速补充法力；还会与部分材料反应。',
    'magic_liquid_charm':'可暂时魅惑接触到的生物。',
    'magic_liquid_protection_all':'提供短暂的伤害保护。',
    'magic_liquid_hp_regeneration':'可恢复生命值。',
    'poison':'有毒，接触或饮用可能损失生命。',
    'radioactive_liquid':'有毒，浸染后持续损失生命，可用水冲洗。',
    'slime':'浸染会减速，也可帮助抵挡部分燃烧效果。',
    'honey':'黏稠，浸染后会影响移动。',
    'urine':'可浸染生物并参与材料反应。',
    'pus':'可浸染生物并参与材料反应。',
}

def material_effect(key):
    from .localization import text
    return text(EFFECTS.get(key,'效果取决于接触、浸染、饮用方式及材料反应；可在 Wiki 查看该材料的详细性质。'),'effect:'+key)

def item_description(key):
    from .localization import text
    return text(ITEMS.get(key,('', '可拾取的特殊物品；具体使用方式与相关谜题可在 Wiki 查看。'))[1],'description:'+key)

def wiki_url(key,material=False):
    from .catalog import record
    # Search preserves unfamiliar IDs while allowing the wiki to resolve page names.
    title={'orb':'Orb of True Knowledge','orb_cursed':'Orb of Corrupted Knowledge','emerald_tablet':'Emerald Tablet','egg_fire':'Egg','egg_monster':'Egg','egg_slime':'Egg','egg_purple':'Egg','egg_worm':'Worm Egg','potion':'Potions','pouch':'Powder Pouch','evil_eye':'Evil Eye','paha_silma':'Evil Eye'}
    data=record(key)
    raw=data.get('name',data.get('ui_name',key))
    if raw.startswith('$'):
        from .catalog import read_english
        raw=read_english().get(raw,key)
    query=title.get(key,raw.replace('_',' '))
    return 'https://noita.wiki.gg/index.php?'+urlencode({'search':query})

def open_wiki(key,material=False):
    return QDesktopServices.openUrl(QUrl(wiki_url(key,material)))
