# 上游来源

- 项目：https://github.com/TwoAbove/noita-tools
- 网站：https://noitool.com/
- 分支：master
- 源码内 package.json 版本：35.0.1
- 获取日期：2026-10-19
- 官方归档地址：https://codeload.github.com/TwoAbove/noita-tools/zip/refs/heads/master
- 由于当前机器无法直连 GitHub，归档通过 `ghfast.top` 代理取得。
- 归档 SHA-256：`DF95FBE94A8E59F58FC2C24E82EBB6CD7AFDA61399500F3160D4AFE016299084`
- 解压目录：`vendor/noita-tools-master`，保留实际使用的种子算法、数据、WASM 构建源文件、中英文材料文本与许可证；未保留上游网站、服务端及其测试。保留的算法源码未作修改。
- 项目许可证：MIT，Copyright (c) 2022 Seva Maltsev。
- 运行算法来源：`src/services/SeedInfo`。
- 游戏图标来源：`src/services/SeedInfo/data/obj` 中内嵌 PNG。
- 中文文本来源：`public/locales/zh/materials.json`。

OpenCL 移植参考 `wasm/core/nolla_prng.zig`、`wasm/entries/alchemy.zig`、
`infoHandler/InfoProviders/Perk/index.ts` 和开局物品生成器。

额外构建依赖：esbuild（MIT）、lodash（MIT）、fast-deep-equal（MIT）、decimal.js（MIT）。
Python 运行依赖：PySide6（LGPL/GPL/商业许可）、NumPy（BSD）、PyOpenCL（MIT）。
源码运行方式不捆绑运行库。Windows PyInstaller 版包含 Python、Node.js、Qt / PySide6、NumPy 和 PyOpenCL 运行依赖；上游 Noitool、Noita Telescope 及 Node.js 的许可证放在发行目录的 `_internal/licenses`，Node.js 版本与构建机器一致。构建版不包含用户设置、搜索方案或本地截图缓存。

本次 Node.js 版本为 v24.21.0；`licenses/node-LICENSE` 来自对应上游标签的 jsDelivr 镜像 https://cdn.jsdelivr.net/gh/nodejs/node@v24.21.0/LICENSE （官方文件 https://github.com/nodejs/node/blob/v24.21.0/LICENSE）。

## 整层法术的世界生成

- 来源：https://github.com/Lymm37/noita-telescope ，main 分支，获取日期 2026-10-19。
- 解压位置：`vendor/noita-telescope-main`，保留构建所需算法模块、实际使用的地图与物品素材、来源信息和 MIT 许可证（Copyright 2026 Lymm）；未保留上游网页界面和本工具未使用的素材。
- 获取方式：GitHub 官方归档通过 `ghfast.top` 代理下载。
- `engine/layer.ts` 调用上游生态生成、Wang 拼图、像素场景、生成点扫描、特殊房间和静态场景算法。
- 适配层 `engine/telescope-png.mjs` 用本地 PNG 字节解码，避免 Node Buffer 偏移和浏览器网络接口问题。
- 构建时重定位文件 URL，替换 PNG 读取接口，不改写上游文件。
- `@napi-rs/canvas`（MIT）提供 Node 无窗口画布，`upng-js`（MIT）提供无颜色校正的 PNG 解码。
- 和平宝箱类型图标、水洞布局素材也复用此仓库提供的像素资源。
- 地图页复用相同生成器的地形着色、房间图像、法杖与敌人图标；`noitatool/map_ui.py` 提供原生缩放、标记聚合和详情 UI。
- Boss 房间区域来自生成后的生态布局；区域标记在界面中与精确实体点区分。圣山价格和折扣由原 Noitool 商店生成器提供。


## 离线位置参考素材

- `assets/region-overview.png` 与 JSON 由本地 Telescope 适配器在种子 1234 预生成，用于区域选择；不是任意种子的实况截图。
- `assets/world-reference.jpg` 三张 Noita 地图截图按重叠区域拼接压缩。
- 重建脚本为 `scripts/stitch_reference_map.py`；此图提供固定布局参考，叠加的资源标记来自当前种子，不声称截图本身随种子生成。
- 校准与切片脚本为 `scripts/build_real_terrain.py`，坐标对齐参考上游 Telescope 的 `surface_overlay.png`（世界原点 -17920 / -7168、宽 35840），现直接作为地图和区域选择的底图。固定截图地形与当前种子的标记数据在界面注明区别。
- 魔球地点坐标事实参考 [NoitaMap 的公开地点数据](https://github.com/acidflow-noita/noitamap/blob/main/src/data/orbs.json)，未引入其前端代码。
- 常见石板位置核对原游戏脚本 [lavalake.lua](https://github.com/vexx32/noita-data/blob/main/scripts/biomes/lavalake.lua)、[mountain_tree.lua](https://github.com/vexx32/noita-data/blob/main/scripts/biomes/mountain_tree.lua)，以及已有 Telescope 素材中的生成像素。脚本仅用于核对，不捆绑下载的 Lua；对应资料的地点是生成点，不代表模拟重力后的落点。
## 高清图片流式导入

- Python 接口：pyvips（MIT），https://github.com/libvips/pyvips ，以及 pyvips-binary 8.18.7 的共享库构建，https://github.com/kleisauke/pyvips-binary 。原始包的许可文件随 `licenses/map-import` 分发。
- pyvips-binary 的包元数据声明 LGPL-3.0-or-later；其共享 libvips DLL 独立放置，可替换为兼容构建。对应源码与构建配方可从上述版本项目及 https://github.com/libvips/libvips 获取。应用不静态链接或改写这些库。
- 附带 LGPL-3.0 与 GPL-3.0 原文。高清地图内容由用户自行选择，程序仅在本地生成可见区域加载的切片缓存。
