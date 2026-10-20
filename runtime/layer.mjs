// engine/layer.ts
import { createCanvas } from "@napi-rs/canvas";

// engine/telescope-png.mjs
import { readFile } from "node:fs/promises";
import UPNG from "upng-js";
async function loadPNG(url) {
  const bytes = await readFile(new URL("../vendor/noita-telescope-main/js/" + url, import.meta.url));
  const decoded = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { data: new Uint8Array(UPNG.toRGBA8(decoded)[0]), width: decoded.width, height: decoded.height, bitmap: null };
}

// vendor/noita-telescope-main/js/nolla_prng.js
var _buf = new ArrayBuffer(8);
var _dv = new DataView(_buf);
var NollaPrng = class _NollaPrng {
  constructor(seed) {
    this.Seed = seed;
    this.Next();
  }
  static f2i(val) {
    _dv.setFloat64(0, val, true);
    return _dv.getBigUint64(0, true);
  }
  static i2f(val) {
    _dv.setBigUint64(0, val, true);
    return _dv.getFloat64(0, true);
  }
  static Helper1(r) {
    let e = _NollaPrng.f2i(r);
    const upper = Number(e >> 32n & 0x7fffffffn);
    if (upper < 2146435072 && r >= -9223372036854776e3 && r < 9223372036854776e3) {
      e &= 0x7FFFFFFFFFFFFFFFn;
      let s = _NollaPrng.i2f(e);
      let i = 0n;
      if (s !== 0) {
        let f = e & 0xfffffffffffffffn | 0x0010000000000000n;
        let h = f >> 0x433n - (e >> 52n);
        let exp = e >> 32n >> 20n;
        let j = exp > 0x433n ? -1n : 0n;
        i = j << 32n | j & 0xFFFFFFFFn;
        let s_int = BigInt(Math.floor(s));
        let shift = (s_int >> 52n) - 0x433n;
        if (shift < 0n) shift = 0n;
        i = ~i & h | f << shift & i;
        let eq = r === s ? -1n : 0n;
        i = ~eq & -i | i & eq;
      }
      return Number(i & 0xFFFFFFFFn);
    }
    return 0;
  }
  static Helper2(a, b, ws) {
    a >>>= 0;
    b >>>= 0;
    ws >>>= 0;
    let u2 = a - b - ws ^ ws >>> 13;
    u2 >>>= 0;
    let u1 = b - u2 - ws ^ u2 << 8;
    u1 >>>= 0;
    let u3 = ws - u2 - u1 ^ u1 >>> 13;
    u3 >>>= 0;
    u2 = u2 - u1 - u3 ^ u3 >>> 12;
    u2 >>>= 0;
    u1 = u1 - u2 - u3 ^ u2 << 16;
    u1 >>>= 0;
    u3 = u3 - u2 - u1 ^ u1 >>> 5;
    u3 >>>= 0;
    u2 = u2 - u1 - u3 ^ u3 >>> 3;
    u2 >>>= 0;
    u1 = u1 - u2 - u3 ^ u2 << 10;
    u1 >>>= 0;
    return (u3 - u2 - u1 ^ u1 >>> 15) >>> 0;
  }
  // --- Public Methods ---
  SetRandomFromWorldSeed(s) {
    this.Seed = s;
    if (this.Seed >= 2147483647) {
      this.Seed = s * 0.5;
    }
  }
  SetRandomSeed(ws, x, y) {
    let a = (ws ^ 2468753007) >>> 0;
    let b = a & 4095;
    let c = a >>> 12 & 4095;
    let x_ = x + b;
    let y_ = y + c;
    let r = x_ * 134217727;
    let e = (r & 4294967295) >>> 0;
    let _x = _NollaPrng.f2i(x_) & 0x7fffffffffffffffn;
    let _y = _NollaPrng.f2i(y_) & 0x7fffffffffffffffn;
    if (_NollaPrng.i2f(_y) >= 102400 || _NollaPrng.i2f(_x) <= 1) {
      r = y_ * 134217727;
    } else {
      let y__ = y_ * 3483.328;
      y__ += e;
      y_ *= y__;
      r = y_;
    }
    let f = r ? (r & 4294967295) >>> 0 : 2;
    let g = _NollaPrng.Helper2(e, f, ws);
    let s = g;
    s /= 4294967295;
    s *= 2147483639;
    s += 1;
    this.Seed = s >>> 0;
    this.Next();
    let h = ws & 3;
    while (h > 0) {
      this.Next();
      h--;
    }
  }
  InvertFinalSeed(targetSeed, ws) {
    this.Seed = targetSeed;
    console.log("Starting GetPosition with targetSeed: ", targetSeed, " ws: ", ws);
    let h = ws & 3;
    while (h >= 0) {
      this.Prev();
      h--;
    }
    let t = this.Seed;
    console.log("After reverting Next calls, T: ", t);
    return t;
  }
  FindPotentialGs(t) {
    let potentialGs = [];
    for (let g_cand = t << 1 >>> 0; g_cand <= (t << 1) + 100 >>> 0; g_cand++) {
      if (this.TestG(g_cand) === t) {
        potentialGs.push(g_cand);
        console.log("Potential G: ", g_cand);
      }
    }
    return potentialGs;
  }
  // Helper to check if a candidate G produces the target T
  TestG(g) {
    const diddle = [0, 4, 6, 25, 12, 39, 52, 9, 21, 64, 78, 92, 104, 118, 18, 32, 44];
    const magic = 252645135;
    let t = g;
    t = t + (g < 2147483648 ? 1 : 0) + (g === 0 ? 1 : 0) >>> 0;
    t = t - Math.floor(g / magic) >>> 0;
    let idx = Math.floor(g / magic);
    if (idx >= 0 && idx < diddle.length) {
      if (g % magic < diddle[idx] && (g < 3284386755 + 4 || g >= 3284386755 + 62)) {
        t = t + 1 >>> 0;
      }
    }
    t = t + (g > 2147483648 ? 1 : 0) >>> 1;
    t = t + (g === 4294967295 ? 1 : 0) >>> 0;
    return t;
  }
  FirstPart(ws, x, y) {
    let a = (ws ^ 2468753007) >>> 0;
    let b = a & 4095;
    let c = a >>> 12 & 4095;
    let x_ = x + b;
    let y_ = y + c;
    let r = x_ * 134217727;
    let e = r ? (r & 4294967295) >>> 0 : 2;
    let _x = _NollaPrng.f2i(x_) & 0x7fffffffffffffffn;
    let _y = _NollaPrng.f2i(y_) & 0x7fffffffffffffffn;
    if (_NollaPrng.i2f(_y) >= 102400 || _NollaPrng.i2f(_x) <= 1) {
      r = y_ * 134217727;
    } else {
      let y__ = y_ * 3483.328;
      y__ += e;
      y_ *= y__;
      r = y_;
    }
    let f = r ? (r & 4294967295) >>> 0 : 2;
    return { e, f };
  }
  FindCoordinates(targetSeed, ws, xRange) {
    let t = this.InvertFinalSeed(targetSeed, ws);
    let potentialGs = this.FindPotentialGs(t);
    let coords = [];
    for (let x = -xRange; x <= xRange; x++) {
      if (x % 1e3 == 0) {
        console.log(`Checking x: ${x} / ${xRange}`);
      }
      for (let y = -xRange; y <= xRange; y++) {
        let { e, f } = this.FirstPart(ws, x, y);
        let g = _NollaPrng.Helper2(e, f, ws);
        if (potentialGs.includes(g)) {
          coords.push({ x, y });
          console.log(`Found potential coordinates: (${x}, ${y}) for G: ${g}`);
        }
      }
    }
    return coords;
  }
  SearchForCoordinates(targetSeeds, ws, xRange, yRange) {
    if (targetSeeds.length === 0) return [];
    if (targetSeeds.length === void 0) {
      targetSeeds = [targetSeeds];
    }
    const targetSet = new Set(targetSeeds);
    let foundCoords = [];
    for (let x = -xRange; x <= xRange; x++) {
      if (x % 1e3 == 0) {
        console.log(`Checking x: ${x} / ${xRange}`);
      }
      for (let y = -yRange; y <= yRange; y++) {
        this.SetRandomSeed(ws, x, y);
        let s = this.Seed;
        if (targetSet.has(s)) {
          foundCoords.push({ x, y, s });
          console.log(`Found potential coordinates: (${x}, ${y}) for Seed: ${s}`);
        }
      }
    }
    return foundCoords;
  }
  Next() {
    let s = BigInt(Math.floor(this.Seed));
    let v4 = 16807n * s - 2147483647n * (s / 127773n);
    if (v4 <= 0n) v4 += 2147483647n;
    this.Seed = Number(v4);
    return this.Seed / 2147483647;
  }
  Prev() {
    let s = BigInt(Math.floor(this.Seed));
    let v4 = 1407677000n * s % 2147483647n;
    if (v4 <= 0n) v4 += 2147483647n;
    this.Seed = Number(v4);
    return this.Seed / 2147483647;
  }
  NextU() {
    this.Next();
    let r = this.Seed * 4656612875e-19 * 2147483645;
    return r >>> 0;
  }
  Random(a, b) {
    return a + Math.floor((b + 1 - a) * this.Next());
  }
  ProceduralRandomStupid(ws, x, y) {
    this.SetRandomSeed(ws, x, y);
    return this.Seed / 2147483647;
  }
  ProceduralRandom(ws, x, y) {
    this.SetRandomSeed(ws, x, y);
    return this.Next();
  }
  ProceduralRandomi(ws, x, y, a, b) {
    this.SetRandomSeed(ws, x, y);
    return this.Random(a, b);
  }
  getDistribution(mean, sharpness, baseline) {
    let i = 0;
    let pi = 3.1415;
    while (i < 100) {
      let r1 = this.Next();
      let r2 = this.Next();
      let div = Math.abs(r1 - mean);
      if (r2 < (1 - div) * baseline) {
        return r1;
      }
      if (div < 0.5) {
        let v11 = Math.sin((0.5 - mean + r1) * pi);
        let v12 = Math.pow(v11, sharpness);
        if (v12 > r2) {
          return r1;
        }
      }
      i++;
    }
    console.log("getDistribution failed to find a value after 100 iterations, returning last value. (", mean, sharpness, baseline, ")");
    return this.Next();
  }
  RandomDistribution(min, max, mean, sharpness) {
    if (sharpness == 0) return this.Random(min, max);
    let adjMean = (mean - min) / (max - min);
    let v7 = this.getDistribution(adjMean, sharpness, 5e-3);
    let d = Math.round(v7 * (max - min));
    return min + d;
  }
  RandomDistributionF(min, max, mean, sharpness) {
    if (sharpness == 0) return min + (max - min) * this.Next();
    let adjMean = (mean - min) / (max - min);
    let v7 = this.getDistribution(adjMean, sharpness, 5e-3);
    return min + v7 * (max - min);
  }
};

// vendor/noita-telescope-main/js/constants.js
var CHUNK_SIZE = 512;
var TILE_SIZE = 10;
var BIOME_EDGE_NOISE_PADDING_TILES = 4;
var BIOME_EDGE_NOISE_PADDING_PIXELS = BIOME_EDGE_NOISE_PADDING_TILES * TILE_SIZE;
var WORLD_CHUNK_CENTER_X = 35;
var WORLD_CHUNK_CENTER_Y = 14;
var WORLD_CHUNK_CENTER_X_NGP = 32;
var TILE_SCALE_RATIO = CHUNK_SIZE / TILE_SIZE;
var TILE_OFFSET_X = 5;
var TILE_OFFSET_Y = -13;

// vendor/noita-telescope-main/js/generator_config.js
var GENERATOR_CONFIG = {
  "coalmine": { color: 4292180247, wangFile: "../data/wang_tiles/coalmine.png", name: "Mines" },
  "coalmine_alt": { color: 4292175127, wangFile: "../data/wang_tiles/coalmine_alt.png", name: "Collapsed Mines" },
  "excavationsite": { color: 4279387205, wangFile: "../data/wang_tiles/excavationsite.png", name: "Coal Pits" },
  "snowcave": { color: 4279727573, wangFile: "../data/wang_tiles/snowcave.png", name: "Snowy Depths" },
  "snowcastle": { color: 4278208255, wangFile: "../data/wang_tiles/snowcastle.png", name: "Hiisi Base" },
  "rainforest": { color: 4286611456, wangFile: "../data/wang_tiles/rainforest.png", name: "Underground Jungle" },
  "rainforest_open": { color: 4288709632, wangFile: "../data/wang_tiles/rainforest_open.png", name: "Underground Jungle (Open)" },
  "vault": { color: 4278222848, wangFile: "../data/wang_tiles/vault.png", name: "The Vault" },
  "crypt": { color: 4286082114, wangFile: "../data/wang_tiles/crypt.png", name: "Temple of the Art" },
  "fungicave": { color: 4293419504, wangFile: "../data/wang_tiles/fungicave.png", name: "Fungal Caverns" },
  "fungiforest": { color: 4289225215, wangFile: "../data/wang_tiles/fungiforest.png", name: "Overgrown Cavern" },
  "rainforest_dark": { color: 4281818112, wangFile: "../data/wang_tiles/rainforest_dark.png", name: "Lukki Lair" },
  "wizardcave": { color: 4285686150, wangFile: "../data/wang_tiles/wizardcave.png", name: "Wizard's Den" },
  "liquidcave": { color: 4287209547, wangFile: "../data/wang_tiles/liquidcave.png", name: "Ancient Laboratory", randomColors: { 118766: [16279656, 8376042, 10704543, 12726357, 786405] } },
  /* 0x12BBEE: [0x000000,0xFFFFFF]} */
  "robobase": { color: 4283322983, wangFile: "../data/wang_tiles/robobase.png", name: "Power Plant" },
  "vault_frozen": { color: 4278223016, wangFile: "../data/wang_tiles/vault_frozen.png", name: "Frozen Vault" },
  "meat": { color: 4283901992, wangFile: "../data/wang_tiles/meat.png", name: "Meat Realm" },
  "wandcave": { color: 4278217794, hasStuff: false, wangFile: "../data/wang_tiles/wand.png", name: "Magical Temple" },
  "pyramid": { color: 4288053009, hasStuff: false, wangFile: "../data/wang_tiles/pyramid.png", optional: true, name: "Pyramid" },
  "sandcave": { color: 4292988210, hasStuff: false, wangFile: "../data/wang_tiles/sandcave.png", optional: true, name: "Sandcave" },
  "clouds": { color: 4281783753, hasStuff: false, wangFile: "../data/wang_tiles/clouds.png", optional: true, name: "Cloudscape" },
  "the_sky": { color: 4292077296, hasStuff: false, wangFile: "../data/wang_tiles/the_sky.png", optional: true, name: "The Work (Sky)" },
  "the_end": { color: 4282126090, hasStuff: false, wangFile: "../data/wang_tiles/the_end.png", name: "The Work (Hell)" },
  "boss_victoryroom": { color: 4283494103, hasStuff: false, name: "The Work (Victory Room)" },
  "winter_caves": { color: 4286031293, hasStuff: false, wangFile: "../data/wang_tiles/snowchasm.png", optional: true, name: "Snowy Chasm" },
  "solid_wall_tower_1": { color: 4282203703, wangFile: "../data/wang_tiles/coalmine.png", name: "Tower (Mines)" },
  "solid_wall_tower_2": { color: 4282203704, wangFile: "../data/wang_tiles/excavationsite.png", name: "Tower (Coal Mines)" },
  "solid_wall_tower_3": { color: 4282203705, wangFile: "../data/wang_tiles/snowcave.png", name: "Tower (Snowy Depths)" },
  "solid_wall_tower_4": { color: 4282203706, wangFile: "../data/wang_tiles/snowcastle.png", name: "Tower (Hiisi Base)" },
  "solid_wall_tower_5": { color: 4282203707, wangFile: "../data/wang_tiles/fungicave.png", name: "Tower (Fungal Caverns)" },
  "solid_wall_tower_6": { color: 4282203708, wangFile: "../data/wang_tiles/rainforest.png", name: "Tower (Underground Jungle)" },
  "solid_wall_tower_7": { color: 4282203709, wangFile: "../data/wang_tiles/vault.png", name: "Tower (The Vault)" },
  "solid_wall_tower_8": { color: 4282203710, wangFile: "../data/wang_tiles/crypt.png", name: "Tower (Temple of the Art)" },
  "solid_wall_tower_9": { color: 4282203711, wangFile: "../data/wang_tiles/the_end.png", name: "Tower (Hell)" },
  "lake_deep": { color: 4279326961, wangFile: "../data/wang_tiles/water.png", optional: true, name: "Lake" },
  // Extra biomes that don't have wang tiles
  "excavationsite_cube_chamber": { color: 4280584330, name: "Meditation Cube" },
  "snowcave_secret_chamber": { color: 4279804118, name: "Snowcave Secret Chamber" },
  "snowcastle_cavern": { color: 4286012891, name: "Hiisi Hourglass Shop" },
  "snowcastle_hourglass_chamber": { color: 4279817942, name: "Eye Room" },
  "robot_egg": { color: 4288561922, name: "Robot Egg" },
  "pyramid_hallway": { color: 4279664479, hasStuff: false, name: "Pyramid (Hallway)" },
  "pyramid_right": { color: 4288057238, hasStuff: false, name: "Pyramid (Right)" },
  "pyramid_entrance": { color: 4288053087, hasStuff: false, name: "Pyramid (Entrance)" },
  "pyramid_left": { color: 4288057183, hasStuff: false, name: "Pyramid (Left)" },
  "pyramid_top": { color: 4291333983, name: "Pyramid (Top)" },
  "secret_lab": { color: 4290421573, name: "Abandoned Alchemy Lab" },
  "wizardcave_entrance": { color: 4286595433, name: "Triangle Boss" },
  "dragoncave": { color: 4281748772, name: "Dragoncave" },
  "roboroom": { color: 4288514365, name: "Mecha Kolmi Boss Room" },
  "meatroom": { color: 4286146080, name: "Meatball Boss Room" },
  "ghost_secret": { color: 4280236900, hasStuff: false, name: "Forgotten Boss Room" },
  "mestari_secret": { color: 4280236898, hasStuff: false, name: "Throne Room" },
  "temple_altar": { color: 4287875916, name: "Holy Mountain" },
  // Apparently the only one with edge noise??
  "temple_altar_left": { color: 4287875917, hasStuff: false, name: "Holy Mountain (Left)" },
  "temple_altar_right": { color: 4287875918, hasStuff: false, name: "Holy Mountain (Right)" },
  "temple_altar_right_snowcave": { color: 4287875919, hasStuff: false, name: "Holy Mountain (Snowy Depths Exit)" },
  // note: not used in NG, for some reason
  "temple_altar_right_snowcastle": { color: 4287875930, hasStuff: false, name: "Holy Mountain (Hiisi Base Exit)" },
  // note: not used in NG+, for some reason
  "temple_wall_ending": { color: 4284126760, hasStuff: false, name: "Holy Mountain Basin (End)" },
  "temple_wall": { color: 4285385512, hasStuff: false, name: "Holy Mountain Basin" },
  "solid_wall_temple": { color: 4290292008, hasStuff: false, name: "Holy Mountain (Solid)" },
  // Empty HM variants excluded since they only apply to daily practice run mod
  "boss_arena": { color: 4279561943, hasStuff: false, name: "The Laboratory" },
  "boss_arena_top": { color: 4279085209, hasStuff: false, name: "The Laboratory (Top)" },
  // Surface and other kind of useless ones
  "hills": { color: 4281783575, hasStuff: false, name: "Hills" },
  "hills2": { color: 4281590545, hasStuff: false, name: "Hills2" },
  "desert": { color: 4291598660, hasStuff: false, name: "Desert" },
  "scale": { color: 4293633280, hasStuff: false, name: "Scale" },
  "winter": { color: 4292270307, hasStuff: false, name: "Snowy Wasteland" },
  "lake": { color: 4279317489, hasStuff: false, name: "Lake (Surface)" },
  "lake_statue": { color: 4279346172, hasStuff: false, name: "Lake (Island)" },
  "lava": { color: 4294928898, hasStuff: false, name: "Volcanic Lake" },
  "lava_90percent": { color: 4294944535, hasStuff: false, name: "Volcanic Lake (90%)" },
  "gold": { color: 4294967040, hasStuff: false, name: "Gold" },
  // Functionally useful but not for this
  "water": { color: 4278190335, hasStuff: false, name: "Water" },
  // Literally useless and yet very mysterious!
  "solid_wall": { color: 4282203453, hasStuff: false, name: "EDR" },
  //'solid_wall_damage': { color: 0xff684C4C, hasStuff: false, name: "Cursed Rock" }, // Actually got this mixed up, I don't know if this one is used
  "solid_wall_tower": { color: 4282334526, hasStuff: false, name: "Cursed Rock" },
  // Orb rooms
  "orbroom_00": { color: 4294955264, hasStuff: false, name: "Orb Room (0)" },
  "orbroom_01": { color: 4294955265, hasStuff: false, name: "Orb Room (1)" },
  "orbroom_02": { color: 4294955266, hasStuff: false, name: "Orb Room (2)" },
  "orbroom_03": { color: 4294955267, hasStuff: false, name: "Orb Room (3)" },
  "orbroom_04": { color: 4294955268, hasStuff: false, name: "Orb Room (4)" },
  "orbroom_05": { color: 4294955269, hasStuff: false, name: "Orb Room (5)" },
  "orbroom_06": { color: 4294955270, hasStuff: false, name: "Orb Room (6)" },
  "orbroom_07": { color: 4294955271, hasStuff: false, name: "Orb Room (7)" },
  "orbroom_08": { color: 4294955272, hasStuff: false, name: "Orb Room (8)" },
  "orbroom_09": { color: 4294955273, hasStuff: false, name: "Orb Room (9)" },
  "orbroom_10": { color: 4294955280, hasStuff: false, name: "Orb Room (10)" },
  "orbroom_11": { color: 4294955281, hasStuff: false, name: "Orb Room (11)" },
  // Static tile
  "biome_watchtower": { color: 4290183168, wangFile: "../data/wang_tiles/static/watchtower_fg.png", optional: true, name: "Watchtower" },
  "biome_potion_mimics": { color: 4294902014, wangFile: "../data/wang_tiles/static/potion_mimics_fg.png", name: "Henkev\xE4 Temple" },
  "biome_darkness": { color: 4294902013, wangFile: "../data/wang_tiles/static/darkness_fg.png", name: "Ominous Temple" },
  "biome_boss_sky": { color: 4294902012, wangFile: "../data/wang_tiles/static/boss_fg.png", optional: true, name: "Kivi Temple" },
  "biome_barren": { color: 4294902011, wangFile: "../data/wang_tiles/static/barren_fg.png", optional: true, name: "Barren Temple" },
  // Spliced pixel scene biomes and other useless stuff
  "mountain_lake": { color: 4294430605, hasStuff: false, name: "Pond" },
  "lavalake": { color: 4282210877, hasStuff: false, name: "Lava Lake" },
  "lavalake_pit": { color: 4282210895, hasStuff: false, name: "Lava Lake Pit" },
  "lavalake_racing": { color: 4282456278, hasStuff: false, name: "Racetrack" },
  "mountain_left_stub": { color: 4284514432, hasStuff: false, name: "Mountain (Left Stub)" },
  "mountain_left_entrance": { color: 4280320128, hasStuff: false, name: "Mountain (Left Entrance)" },
  "mountain_hall": { color: 4280303712, hasStuff: false, name: "Mountain (Hall)" },
  "mountain_right": { color: 4282417280, hasStuff: false, name: "Mountain (Right)" },
  "mountain_right_stub": { color: 4292903040, hasStuff: false, name: "Mountain (Right Stub)" },
  "mountain_top": { color: 4290805888, hasStuff: false, name: "Mountain (Top)" },
  "mountain_floating_island": { color: 4290805890, hasStuff: false, name: "Mountain (Floating Island)" },
  "mountain_tree": { color: 4279558615, hasStuff: false, name: "Tree" },
  "solid_wall_hidden_cavern": { color: 4282524749, hasStuff: false, name: "Hidden Cavern" },
  "solid_wall_tower_10": { color: 4282203713, name: "Tower (Reward)" },
  "bridge": { color: 4289560849, hasStuff: false, name: "Bridge" },
  "empty": { color: 4282966801, hasStuff: false, name: "Empty" },
  "snowcave_tunnel": { color: 4286309137, hasStuff: false, name: "Snowcave Tunnel" },
  "watercave": { color: 4281353921, hasStuff: false, name: "Dark Cave" },
  "sky_light_injector": { color: 4294836224, hasStuff: false, name: "Sky Light Injector" },
  "teleroom": { color: 4284452779, hasStuff: false, name: "Teleport Room" },
  "friend_1": { color: 4285379930, hasStuff: false, name: "Friend Room (1)" },
  "friend_2": { color: 4285379931, hasStuff: false, name: "Friend Room (2)" },
  "friend_3": { color: 4285379932, hasStuff: false, name: "Friend Room (3)" },
  "friend_4": { color: 4285379933, hasStuff: false, name: "Friend Room (4)" },
  "friend_5": { color: 4285379934, hasStuff: false, name: "Friend Room (5)" },
  "friend_6": { color: 4285379935, hasStuff: false, name: "Friend Room (6)" },
  "gun_room": { color: 4281968480, hasStuff: false, name: "Gun Room" },
  "null_room": { color: 4292967986, hasStuff: false, name: "Nullification Altar" },
  "rock_room": { color: 4281493077, hasStuff: false, name: "Rock Room" },
  "funroom": { color: 4278883748, hasStuff: false, name: "Fungal Map" },
  "song_room": { color: 4288518609, hasStuff: false, name: "Coral Chest" },
  "alchemist_secret": { color: 4283947726, hasStuff: false, name: "Dark Chest" },
  "moon_room": { color: 4283858096, hasStuff: false, name: "Moon Room" },
  "gourd_room": { color: 4281244113, hasStuff: false, name: "Gourd Room" },
  "greed_room": { color: 4282340817, hasStuff: false, name: "Greed Room" },
  // Not sure this is used
  "ocarina": { color: 4283943630, hasStuff: false, name: "Ocarina" },
  "essenceroom_air": { color: 4279598264, hasStuff: false, name: "Essence of Air" },
  "essenceroom": { color: 4279598256, hasStuff: false, name: "Essence of Earth" },
  "essenceroom_hell": { color: 4279598261, hasStuff: false, name: "Essence of Water" },
  "essenceroom_alc": { color: 4279598262, hasStuff: false, name: "Essence of Spirits" },
  "mystery_teleport": { color: 4279598263, hasStuff: false, name: "Mystery Teleport" },
  "roadblock": { color: 4293973271, hasStuff: false, name: "Roadblock" }
};
Object.values(GENERATOR_CONFIG).forEach((conf) => {
  conf.enabled = true;
  if (conf.name === "Lake") conf.enabled = false;
  conf.pois = conf.pois || [];
});
var BIOME_COLOR_TO_NAME = {};
Object.entries(GENERATOR_CONFIG).forEach(([biomeName, conf]) => {
  BIOME_COLOR_TO_NAME[conf.color & 16777215] = biomeName;
});
var BIOME_COLORS_WITH_TILES = new Set(Object.values(GENERATOR_CONFIG).filter((conf) => conf.wangFile != null).map((conf) => conf.color & 16777215));
var HOLY_MOUNTAIN_BASIN_COLORS = /* @__PURE__ */ new Set([
  9685836,
  // temple_altar
  9685837,
  // temple_altar_left
  9685838,
  // temple_altar_right
  9685839,
  // temple_altar_right_snowcave (note: not used in NG, for some reason)
  9685850,
  // temple_altar_right_snowcastle (note: not used in NG+, for some reason)
  5936680,
  // temple_wall_ending
  7195432
  // temple_wall
]);

// vendor/noita-telescope-main/js/edge_noise.js
var EDGE_NOISE = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
var EDGE_SIGNS = [1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 0, 0, -1, -1, 0, 0, 1, 0, 1, 0, -1, 0, 1, 0, 1, 0, -1, 0, -1, 0, -1, 0, 0, 1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 0, 0, -1, -1, 0];
var sqrt312 = (Math.sqrt(3) - 1) / 2;
var sqrt336 = (3 - Math.sqrt(3)) / 6;
var BASE_Y = 512 * 14;
var BIOME_H = 48;
var EDGE_NOISE_2 = [];
var EDGE_NOISE_M12 = [];
for (let i = 0; i < 512; i++) {
  const temp = EDGE_NOISE[i & 255];
  EDGE_NOISE_2.push(temp);
  EDGE_NOISE_M12.push(temp % 12);
}
function Mod(a, b) {
  return (a % b + b) % b;
}
function SampleBiome(x, y) {
  return Mod(x, 2) * 2 + Mod(y, 2);
}
function ComputeMagicValueFromDoubles(x, y) {
  let uVar1;
  let uVar2;
  let dVar3;
  let dVar4;
  let dVar5;
  let dVar6;
  let dVar7;
  let dVar8;
  let dVar9;
  let dVar10;
  let dVar11;
  dVar7 = (x + y) * sqrt312;
  dVar6 = dVar7 + x;
  uVar2 = dVar6 >>> 0;
  if (dVar6 < uVar2) {
    uVar2 = uVar2 - 1;
  }
  dVar7 = dVar7 + y;
  uVar1 = dVar7 >>> 0;
  if (dVar7 < uVar1) {
    uVar1 = uVar1 - 1;
  }
  dVar6 = (uVar1 + uVar2) * sqrt336;
  dVar10 = x - (uVar2 - dVar6);
  dVar9 = y - (uVar1 - dVar6);
  uVar1 = uVar1 & 255;
  uVar2 = uVar2 & 255;
  dVar8 = 0;
  dVar7 = dVar10 - (dVar9 < dVar10 ? 1 : 0) + sqrt336;
  dVar3 = dVar9 - (dVar10 <= dVar9 ? 1 : 0) + sqrt336;
  dVar11 = dVar10 - 1 + sqrt336 * 2;
  dVar4 = dVar9 - 1 + sqrt336 * 2;
  dVar5 = 0.5 - dVar10 * dVar10 - dVar9 * dVar9;
  dVar6 = dVar8;
  if (0 <= dVar5) {
    dVar6 = (EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[uVar1] + uVar2] * 4 + 1] * dVar9 + EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[uVar1] + uVar2] * 4] * dVar10) * dVar5 * dVar5 * dVar5 * dVar5;
  }
  dVar5 = 0.5 - dVar7 * dVar7 - dVar3 * dVar3;
  if (0 <= dVar5) {
    dVar7 = (EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[(dVar10 <= dVar9 ? 1 : 0) + uVar1] + uVar2 + (dVar9 < dVar10 ? 1 : 0)] * 4 + 1] * dVar3 + EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[(dVar10 <= dVar9 ? 1 : 0) + uVar1] + uVar2 + (dVar9 < dVar10 ? 1 : 0)] * 4] * dVar7) * dVar5 * dVar5 * dVar5 * dVar5;
  } else {
    dVar7 = 0;
  }
  dVar3 = 0.5 - dVar11 * dVar11 - dVar4 * dVar4;
  if (0 <= dVar3) {
    dVar8 = (EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[uVar1 + 1] + uVar2 + 1] * 4 + 1] * dVar4 + EDGE_SIGNS[EDGE_NOISE_M12[EDGE_NOISE_2[uVar1 + 1] + uVar2 + 1] * 4] * dVar11) * dVar3 * dVar3 * dVar3 * dVar3;
  }
  return (dVar7 + dVar6 + dVar8) * 70;
}
function GetOriginalChunkPosIdAt(x, y, isNGP = false, gameMode = "normal") {
  const biomeW = getWorldSize(isNGP, gameMode);
  const shifted_x = x + 512 * (biomeW / 2);
  const shifted_y = y + 512 * 14;
  const chunkX = Mod(Math.floor(shifted_x / 512), biomeW);
  const chunkY = Math.floor(shifted_y / 512);
  return SampleBiome(chunkX, chunkY);
}
function GetTrueChunkPosIdAt(x, y, isNGP = false, highDetail = true, gameMode = "normal") {
  let subchunk_y;
  let subchunk_x;
  let chunk_x;
  let chunk_y;
  let shifted_y;
  let shifted_x;
  let new_x;
  let new_y;
  let biome;
  shifted_x = x + 512 * getWorldCenter(isNGP, gameMode);
  shifted_y = y + BASE_Y;
  subchunk_x = Math.floor(shifted_x) & 511;
  subchunk_y = Math.floor(shifted_y) & 511;
  new_x = 70;
  chunk_x = (Math.floor(shifted_x) >> 9) % new_x;
  chunk_y = Math.floor(shifted_y) >> 9;
  if (chunk_x < 0) {
    chunk_x = chunk_x + new_x;
  }
  new_y = BIOME_H + -1;
  if (chunk_y < new_y) {
    new_y = chunk_y;
  }
  chunk_y = 0;
  if (0 < new_y) {
    chunk_y = new_y;
  }
  biome = SampleBiome(chunk_x, chunk_y);
  if (subchunk_x < 42 || subchunk_y < 42 || subchunk_x > 470 || subchunk_y > 470) {
    return GetWobbledBiome(shifted_x, shifted_y, highDetail);
  }
  return biome;
}
function GetWobbledBiome(shifted_x, shifted_y, highDetail = true, sincosWobble = true) {
  let x2 = 0;
  let y2 = 0;
  if (!sincosWobble) {
    if (highDetail)
      x2 = ComputeMagicValueFromDoubles(shifted_x * 0.05, shifted_y * 0.05);
    x2 = x2 * 2.5;
    y2 = x2;
  } else {
    if (highDetail)
      y2 = ComputeMagicValueFromDoubles(shifted_x * 0.05, shifted_y * 0.05);
    let dVar1 = Math.sin(shifted_y * 5e-3);
    x2 = Math.cos(shifted_x * 5e-3);
    x2 = x2 * 30 + y2 * 11;
    y2 = dVar1 * 30 + y2 * 11;
  }
  return SampleBiome(Math.floor(y2 + shifted_x) >> 9, Math.floor(x2 + shifted_y) >> 9);
}
function GetBiomeOffset(x, y, isNGP = false, highDetail = true, gameMode = "normal") {
  const originalBiomeId = GetOriginalChunkPosIdAt(x, y, isNGP, gameMode);
  const trueBiomeId = GetTrueChunkPosIdAt(x, y, isNGP, highDetail, gameMode);
  const isDiffY = Mod(trueBiomeId - originalBiomeId, 2);
  const isDiffX = Mod(Math.floor(trueBiomeId / 2) - Math.floor(originalBiomeId / 2), 2);
  const signX = Mod(x, 512) < 42 ? -1 : Mod(x, 512) > 470 ? 1 : 0;
  const signY = Mod(y, 512) < 42 ? -1 : Mod(y, 512) > 470 ? 1 : 0;
  return {
    x: isDiffX * signX,
    y: isDiffY * signY
  };
}

// vendor/noita-telescope-main/js/wobble_flags.js
var biomeFlagsData = await fetchSafeJson("../data/biome_flags.json");
var EDGE_NOISE_DEFAULTS = {
  noise_biome_edges: 1,
  // 0 for straight edges, 1 for wobble
  fat_biome_edges: 0
  // 1 for "fat" edges that short-circuit to the original chunk, 0 for normal edge noise
  // big_noise_biome_edges: 1, // used to remove sincos wobble when set to 0, but not currently used so omitted for now
};
var KNOWN_BIOME_COLORS = /* @__PURE__ */ new Set();
var BIOME_FLAGS_BY_COLOR = /* @__PURE__ */ new Map();
for (const b of biomeFlagsData.biomes) {
  const rgb = parseInt(b.color, 16) & 16777215;
  KNOWN_BIOME_COLORS.add(rgb);
  BIOME_FLAGS_BY_COLOR.set(rgb, b);
}
function biomeEdgeNoiseFlag(colorInt, attr) {
  const rgb = colorInt & 16777215;
  if (!KNOWN_BIOME_COLORS.has(rgb)) return null;
  const entry = BIOME_FLAGS_BY_COLOR.get(rgb);
  return entry[attr] ?? EDGE_NOISE_DEFAULTS[attr];
}

// vendor/noita-telescope-main/js/potion_config.js
var POTION_MATERIALS_STANDARD = [
  "lava",
  "water",
  "blood",
  "alcohol",
  "oil",
  "slime",
  "acid",
  "radioactive_liquid",
  "gunpowder_unstable",
  "liquid_fire",
  "blood_cold"
];
var POTION_MATERIALS_MAGIC = [
  "magic_liquid_unstable_teleportation",
  "magic_liquid_polymorph",
  "magic_liquid_random_polymorph",
  "magic_liquid_berserk",
  "magic_liquid_charm",
  "magic_liquid_invisibility",
  "material_confusion",
  "magic_liquid_movement_faster",
  "magic_liquid_faster_levitation",
  "magic_liquid_worm_attractor",
  "magic_liquid_protection_all",
  "magic_liquid_mana_regeneration"
];
var POTION_MATERIALS_MAGIC_NIGHTMARE = [
  "magic_liquid_unstable_teleportation",
  "magic_liquid_polymorph",
  "magic_liquid_random_polymorph",
  "magic_liquid_berserk",
  "magic_liquid_charm",
  "material_confusion",
  "magic_liquid_movement_faster",
  "magic_liquid_worm_attractor"
];
var POTION_MATERIALS_SECRET = [
  "magic_liquid_hp_regeneration_unstable",
  "blood_worm",
  "gold",
  "snow",
  "glowshroom",
  "bush_seed",
  "cement",
  "salt",
  "sodium",
  "mushroom_seed",
  "plant_seed",
  "urine",
  "purifying_powder"
];
var POTION_LIQUIDS = [
  "water",
  "water_temp",
  "water_ice",
  "water_swamp",
  "oil",
  "alcohol",
  "beer",
  "milk",
  "molut",
  "sima",
  "juhannussima",
  "magic_liquid",
  "material_confusion",
  "material_darkness",
  "material_rainbow",
  "magic_liquid_weakness",
  "magic_liquid_movement_faster",
  "magic_liquid_faster_levitation",
  "magic_liquid_faster_levitation_and_movement",
  "magic_liquid_worm_attractor",
  "magic_liquid_protection_all",
  "magic_liquid_mana_regeneration",
  "magic_liquid_unstable_teleportation",
  "magic_liquid_teleportation",
  "magic_liquid_hp_regeneration",
  "magic_liquid_hp_regeneration_unstable",
  "magic_liquid_polymorph",
  "magic_liquid_random_polymorph",
  "magic_liquid_unstable_polymorph",
  "magic_liquid_berserk",
  "magic_liquid_charm",
  "magic_liquid_invisibility",
  "cloud_radioactive",
  "cloud_blood",
  "cloud_slime",
  "swamp",
  "blood",
  "blood_fading",
  "blood_fungi",
  "blood_worm",
  "porridge",
  "blood_cold",
  "radioactive_liquid",
  "radioactive_liquid_fading",
  "plasma_fading",
  "gold_molten",
  "wax_molten",
  "silver_molten",
  "copper_molten",
  "brass_molten",
  "glass_molten",
  "glass_broken_molten",
  "steel_molten",
  "creepy_liquid",
  "cement",
  "slime",
  "slush",
  "vomit",
  "plastic_red_molten",
  "plastic_grey_molten",
  "acid",
  "lava",
  "urine",
  "rocket_particles",
  "peat",
  "plastic_prop_molten",
  "plastic_molten",
  "slime_yellow",
  "slime_green",
  "aluminium_oxide_molten",
  "steel_rust_molten",
  "metal_prop_molten",
  "aluminium_robot_molten",
  "aluminium_molten",
  "metal_nohit_molten",
  "metal_rust_molten",
  "metal_molten",
  "metal_sand_molten",
  "steelsmoke_static_molten",
  "steelmoss_static_molten",
  "steelmoss_slanted_molten",
  "steel_static_molten",
  "plasma_fading_bright",
  "radioactive_liquid_yellow",
  "cursed_liquid",
  "poison",
  "blood_fading_slow",
  "pus",
  "midas",
  "midas_precursor",
  "liquid_fire_weak",
  "liquid_fire",
  "just_death",
  "mimic_liquid",
  "void_liquid",
  "water_salt",
  "water_fading",
  "pea_soup"
];
var POTION_SANDS = [
  "mud",
  "concrete_sand",
  "sand",
  "bone",
  "soil",
  "sandstone",
  "fungisoil",
  "honey",
  "glue",
  "explosion_dirt",
  "snow",
  "snow_sticky",
  "rotten_meat",
  "meat_slime_sand",
  "rotten_meat_radioactive",
  "ice",
  "sand_herb",
  "wax",
  "gold",
  "silver",
  "copper",
  "brass",
  "diamond",
  "coal",
  "sulphur",
  "salt",
  "sodium_unstable",
  "gunpowder",
  "gunpowder_explosive",
  "gunpowder_tnt",
  "gunpowder_unstable",
  "gunpowder_unstable_big",
  "monster_powder_test",
  "rat_powder",
  "fungus_powder",
  "orb_powder",
  "gunpowder_unstable_boss_limbs",
  "plastic_red",
  "plastic_grey",
  "grass",
  "grass_holy",
  "grass_darker",
  "grass_ice",
  "grass_dry",
  "fungi",
  "spore",
  "moss",
  "plant_material",
  "plant_material_red",
  "plant_material_dark",
  "ceiling_plant_material",
  "mushroom_seed",
  "plant_seed",
  "mushroom",
  "mushroom_giant_red",
  "mushroom_giant_blue",
  "glowshroom",
  "bush_seed",
  "poo",
  "mammi",
  "glass_broken",
  "moss_rust",
  "fungi_creeping_secret",
  "fungi_creeping",
  "grass_dark",
  "fungi_green",
  "shock_powder",
  "fungus_powder_bad",
  "burning_powder",
  "purifying_powder",
  "sodium",
  "metal_sand",
  "steel_sand",
  "gold_radioactive",
  "endslime_blood",
  "sandstone_surface",
  "soil_dark",
  "soil_dead",
  "soil_lush_dark",
  "soil_lush",
  "sand_petrify",
  "lavasand",
  "sand_surface",
  "sand_blue",
  "plasma_fading_pink",
  "plasma_fading_green",
  "fungi_yellow"
];
var MATERIAL_DATA = await fetchSafeJson("../data/material_data.json");
var MATERIAL_WANG_COLORS = {};
var POTION_COLORS = {};
var TEXTURE_COLORS = {};
for (const material of MATERIAL_DATA) {
  MATERIAL_WANG_COLORS[material.name] = material.wang;
  POTION_COLORS[material.name] = material.color;
  TEXTURE_COLORS[material.name] = material.texture_color;
}
var MATERIAL_COLOR_CONVERSION = {};
for (const material of Object.keys(MATERIAL_WANG_COLORS)) {
  const wangColor = MATERIAL_WANG_COLORS[material];
  const materialColor = TEXTURE_COLORS[material];
  const wangColorInt = parseInt(wangColor, 16) & 16777215;
  const materialColorInt = parseInt(materialColor, 16) & 16777215;
  MATERIAL_COLOR_CONVERSION[wangColorInt] = materialColorInt;
}
var MATERIAL_COLOR_LOOKUP = {};
for (const material of Object.keys(MATERIAL_WANG_COLORS)) {
  const materialColor = MATERIAL_WANG_COLORS[material].toLowerCase().substring(2);
  MATERIAL_COLOR_LOOKUP[materialColor] = material;
}
var POWDER_MATERIALS_STANDARD = [
  { material: "sand", weight: 300 },
  { material: "soil", weight: 200 },
  { material: "snow", weight: 200 },
  { material: "salt", weight: 200 },
  { material: "coal", weight: 200 },
  { material: "gunpowder", weight: 200 },
  { material: "fungisoil", weight: 200 }
];
var POWDER_MATERIALS_MAGIC = [
  { material: "copper", weight: 500 },
  { material: "silver", weight: 500 },
  { material: "gold", weight: 500 },
  { material: "brass", weight: 500 },
  { material: "bone", weight: 800 },
  { material: "purifying_powder", weight: 800 },
  { material: "fungi", weight: 800 }
];

// vendor/noita-telescope-main/js/pixel_scene_config.js
var BLOCKED_COLORS = [
  44142,
  // load_pixel_scene4_alt
  7395230,
  // load_gunpowderpool_01
  7395231,
  // load_gunpowderpool_02
  7395232,
  // load_gunpowderpool_03
  7395233,
  // load_gunpowderpool_04
  7891199,
  // load_puzzleroom
  12801792,
  // load_oiltank
  16711808,
  // load_pixel_scene2
  16711935,
  //???
  16714495,
  // load_pixel_scene
  44132
  // load_pixel_scene4
];
var COALMINE_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "coalpit01" },
    { prob: 0.5, name: "coalpit02" },
    { prob: 0.5, name: "carthill" },
    { prob: 0.5, name: "coalpit03" },
    { prob: 0.5, name: "coalpit04" },
    { prob: 0.5, name: "coalpit05" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "shrine01" },
    { prob: 0.5, name: "shrine02" },
    { prob: 0.5, name: "slimepit" },
    { prob: 0.5, name: "laboratory" },
    { prob: 0.5, name: "swarm" },
    { prob: 0.5, name: "symbolroom" },
    { prob: 0.5, name: "physics_01" },
    { prob: 0.5, name: "physics_02" },
    { prob: 0.5, name: "physics_03" },
    { prob: 1.5, name: "shop" },
    { prob: 0.5, name: "radioactivecave" },
    { prob: 0.75, name: "wandtrap_h_02" },
    { prob: 0.75, name: "wandtrap_h_04", color_material: { "f0bbee": ["oil", "alcohol", "gunpowder_explosive"] } },
    { prob: 0.75, name: "wandtrap_h_06", color_material: { "f0bbee": ["magic_liquid_teleportation", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "radioactive_liquid"] } },
    { prob: 0.75, name: "wandtrap_h_07", color_material: { "f0bbee": ["water", "oil", "alcohol", "radioactive_liquid"] } },
    { prob: 0.5, name: "physics_swing_puzzle" },
    { prob: 0.5, name: "receptacle_oil" }
  ],
  "g_oiltank": [
    { prob: 1, name: "oiltank_1", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "coal", "radioactive_liquid"] } },
    { prob: 4e-4, name: "oiltank_1", color_material: { "f0bbee": ["magic_liquid_teleportation", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "magic_liquid_berserk", "magic_liquid_charm", "magic_liquid_invisibility", "magic_liquid_hp_regeneration", "salt", "blood", "gold", "honey"] } },
    { prob: 0.01, name: "oiltank_2", color_material: { "f0bbee": ["blood_fungi", "blood_cold", "lava", "poison", "slime", "gunpowder_explosive", "soil", "salt", "blood", "cement"] } },
    { prob: 1, name: "oiltank_2", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "oil", "coal", "radioactive_liquid"] } },
    { prob: 1, name: "oiltank_3", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "water", "coal", "radioactive_liquid", "magic_liquid_teleportation"] } },
    { prob: 1, name: "oiltank_4", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "coal", "radioactive_liquid", "magic_liquid_polymorph"] } },
    { prob: 1, name: "oiltank_5", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "radioactive_liquid", "coal", "radioactive_liquid"] } },
    //*
    { prob: 0.05, name: "oiltank_puzzle" }
  ],
  "g_oiltank_alt": [
    { prob: 1, name: "oiltank_alt", color_material: { "f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "radioactive_liquid", "radioactive_liquid", "magic_liquid_berserk"] } }
  ],
  "g_altar": [
    { prob: 1, name: "trailer_altar" }
  ]
};
var COALMINE_ALT_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "coalpit01" },
    { prob: 0.5, name: "coalpit02" },
    { prob: 0.5, name: "carthill" },
    { prob: 0.5, name: "coalpit03" },
    { prob: 0.5, name: "coalpit04" },
    { prob: 0.5, name: "coalpit05" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "shrine01_alt", unique: true },
    // *** Might be a huge issue
    { prob: 0.5, name: "shrine02_alt" },
    { prob: 0.5, name: "swarm_alt" },
    { prob: 1.2, name: "symbolroom_alt" },
    { prob: 1.2, name: "physics_01_alt" },
    { prob: 1.2, name: "physics_02_alt" },
    { prob: 1.2, name: "physics_03_alt" },
    { prob: 0.75, name: "shop_alt" },
    { prob: 0.5, name: "radioactivecave" }
  ]
};
var EXCAVATIONSITE_SCENES = {
  "g_pixel_scene_01": [],
  "g_pixel_scene_02": [],
  "g_pixel_scene_04": [
    { prob: 0.5, name: "machine_1" },
    { prob: 0.5, name: "machine_2" },
    { prob: 0.5, name: "machine_3b" },
    { prob: 0.5, name: "machine_4" },
    { prob: 0.5, name: "machine_5" },
    { prob: 0.5, name: "machine_6" },
    { prob: 0.3, name: "machine_7" },
    { prob: 3, name: "shop" },
    { prob: 0.8, name: "oiltank_1" },
    { prob: 0.8, name: "lake" }
  ],
  "g_pixel_scene_04_alt": [
    { prob: 0.5, name: "machine_1_alt" },
    { prob: 0.5, name: "machine_2_alt" },
    { prob: 0.5, name: "machine_3b_alt" },
    { prob: 0.5, name: "machine_4_alt" },
    { prob: 0.5, name: "machine_5_alt" },
    { prob: 0.5, name: "machine_6_alt" },
    { prob: 0.3, name: "machine_7_alt" },
    { prob: 3, name: "shop_alt" },
    { prob: 0.7, name: "receptacle_steam" },
    { prob: 0.8, name: "lake_alt" }
  ],
  "g_puzzleroom": [
    { prob: 1.5, name: "puzzleroom_01" },
    { prob: 1.5, name: "puzzleroom_02" },
    { prob: 1.5, name: "puzzleroom_03" }
  ],
  "g_gunpowderpool_01": [
    { prob: 1.5, name: "gunpowderpool_01" }
  ],
  "g_gunpowderpool_02": [
    { prob: 1.5, name: "gunpowderpool_02" }
  ],
  "g_gunpowderpool_03": [
    { prob: 1.5, name: "gunpowderpool_03" }
  ],
  "g_gunpowderpool_04": [
    { prob: 1.5, name: "gunpowderpool_04" }
  ],
  "extras": [
    { name: "meditation_cube_visual" }
  ]
};
var SNOWCAVE_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "verticalobservatory" },
    { prob: 0.5, name: "verticalobservatory2" },
    { prob: 0.5, name: "icebridge2" },
    { prob: 0.5, name: "pipe" },
    { prob: 0.25, name: "receptacle_water" }
  ],
  "g_pixel_scene_01_alt": [
    { prob: 0.5, name: "verticalobservatory_alt" },
    { prob: 0.5, name: "verticalobservatory2_alt" },
    { prob: 0.5, name: "icebridge2_alt" },
    { prob: 0.5, name: "pipe_alt" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.4, name: "crater" },
    { prob: 0.5, name: "horizontalobservatory" },
    { prob: 0.5, name: "horizontalobservatory2" },
    { prob: 0.3, name: "horizontalobservatory3" },
    { prob: 0.4, name: "icebridge" },
    { prob: 0.4, name: "snowcastle" },
    { prob: 0, name: "symbolroom" },
    // We were cheated out of greatness.
    { prob: 0.5, name: "icepillar" },
    { prob: 1.5, name: "shop" },
    { prob: 0.5, name: "camp" }
  ],
  "g_pixel_scene_03": [
    { prob: 0.9, name: "" },
    { prob: 0.5, name: "tinyobservatory" },
    { prob: 0.5, name: "tinyobservatory2" },
    { prob: 0.2, name: "buried_eye" }
  ],
  "g_acidtank_right": [
    { prob: 1.7, name: "" },
    { prob: 0.2, name: "acidtank_2" }
  ],
  "g_acidtank_left": [
    { prob: 1.7, name: "" },
    { prob: 0.2, name: "acidtank" }
  ],
  "g_pixel_scene_04": [
    { prob: 0.5, name: "" },
    { prob: 0.5, name: "icicles" },
    { prob: 0.5, name: "icicles2" },
    { prob: 0.5, name: "icicles3" },
    { prob: 0.5, name: "icicles4" }
  ],
  "g_puzzle_capsule": [
    { prob: 9, name: "" },
    { prob: 1, name: "puzzle_capsule" }
  ],
  "g_puzzle_capsule_b": [
    { prob: 9, name: "" },
    { prob: 1, name: "puzzle_capsule_b" }
  ],
  "g_altar": [
    { prob: 1, name: "trailer_altar" }
  ],
  "extras": [
    { name: "altar_snowcave_capsule" }
  ]
};
var SNOWCASTLE_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "shaft" },
    { prob: 0.5, name: "bridge" },
    { prob: 0.5, name: "drill" },
    { prob: 0.5, name: "greenhouse" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.4, name: "cargobay" },
    { prob: 0.8, name: "bar" },
    { prob: 0.8, name: "bedroom" },
    { prob: 0.4, name: "acidpool" },
    { prob: 0.4, name: "polymorphroom" },
    { prob: 0.2, name: "teleroom" },
    { prob: 0.3, name: "sauna" },
    { prob: 0.3, name: "kitchen" }
  ],
  "g_pods_large": [
    { prob: 1, name: "pod_large_blank_01" },
    { prob: 1, name: "pod_large_01" },
    { prob: 1, name: "pod_large_01" },
    { prob: 1, name: "pod_large_01" }
  ],
  "g_pods_small_l": [
    { prob: 1, name: "pod_small_l_blank_01" },
    { prob: 1, name: "pod_small_l_01" },
    { prob: 1, name: "pod_small_l_01" }
  ],
  "g_pods_small_r": [
    { prob: 1, name: "pod_small_r_blank_01" },
    { prob: 1, name: "pod_small_r_01" },
    { prob: 1, name: "pod_small_r_01" }
  ],
  "extras": [
    { name: "chamfer_top_r" },
    { name: "chamfer_top_l" },
    { name: "chamfer_bottom_r" },
    { name: "chamfer_bottom_l" },
    { name: "chamfer_inner_top_r" },
    { name: "chamfer_inner_top_l" },
    { name: "chamfer_inner_bottom_r" },
    { name: "chamfer_inner_bottom_l" },
    { name: "pillar_filler_01" },
    { name: "pillar_filler_tall_01" },
    { name: "forge" },
    { name: "altar_snowcastle_capsule" }
  ]
};
var RAINFOREST_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "pit01" },
    { prob: 0.5, name: "pit02" },
    { prob: 0.5, name: "pit03" },
    { prob: 0.8, name: "oiltank_01" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "hut01" },
    { prob: 0.5, name: "hut02" },
    { prob: 0.4, name: "base" },
    { prob: 0.5, name: "hut03" },
    { prob: 1.2, name: "symbolroom" }
  ],
  "g_pixel_scene_04": [
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" }
  ]
};
var RAINFOREST_OPEN_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "pit01" },
    { prob: 0.5, name: "pit02" },
    { prob: 0.5, name: "pit03" },
    { prob: 0.8, name: "oiltank_01" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "hut01" },
    { prob: 0.5, name: "hut02" },
    { prob: 0.4, name: "base" },
    { prob: 0.5, name: "hut03" },
    { prob: 1.2, name: "symbolroom" }
  ],
  "g_pixel_scene_04": [
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" },
    { prob: 0.5, name: "plantlife" }
  ]
};
var RAINFOREST_DARK_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "pit01" },
    { prob: 0.5, name: "pit02" },
    { prob: 0.5, name: "pit03" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "hut03" },
    { prob: 1.2, name: "symbolroom" }
  ]
};
var VAULT_LAB_LIQUIDS = {
  "f0bbee": ["radioactive_liquid", "radioactive_liquid", "acid", "acid", "acid", "alcohol"],
  "a4dbd5": ["radioactive_liquid", "radioactive_liquid", "acid", "acid", "acid", "alcohol"]
  // TODO: Second liquid replacement not yet implemented
};
var VAULT_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "acidtank" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "lab", color_material: { "f0bbee": ["radioactive_liquid", "radioactive_liquid", "acid", "acid", "acid", "alcohol"] } },
    { prob: 0.5, name: "lab2", color_material: VAULT_LAB_LIQUIDS },
    { prob: 0.5, name: "lab3", color_material: VAULT_LAB_LIQUIDS },
    { prob: 1.2, name: "symbolroom" },
    { prob: 0.3, name: "lab_puzzle" }
  ],
  "g_pixel_scene_wide": [
    { prob: 0.5, name: "brain_room" },
    { prob: 0.5, name: "shop" }
  ],
  "g_pixel_scene_tall": [
    { prob: 0.5, name: "electric_tunnel_room" }
  ],
  "g_pipes_hor": [
    { prob: 0.5, name: "pipe_hor_1" },
    { prob: 0.5, name: "pipe_hor_2" },
    { prob: 0.05, name: "pipe_hor_3" }
  ],
  "g_pipes_ver": [
    { prob: 0.5, name: "pipe_ver_1" },
    { prob: 0.5, name: "pipe_ver_2" },
    { prob: 0.05, name: "pipe_ver_3" },
    { prob: 0.1, name: "pipe_ver_4" }
  ],
  "g_pipes_turn_right": [
    { prob: 0.5, name: "pipe_turn_right" }
  ],
  "g_pipes_turn_left": [
    { prob: 0.5, name: "pipe_turn_left" }
  ],
  "g_pipes_cross": [
    { prob: 0.5, name: "pipe_cross" }
  ],
  "g_pipes_big_hor": [
    { prob: 0.5, name: "pipe_big_hor_1" },
    { prob: 0.5, name: "pipe_big_hor_2" }
  ],
  "g_pipes_big_ver": [
    { prob: 0.5, name: "pipe_big_ver_1" },
    { prob: 0.5, name: "pipe_big_ver_2" }
  ],
  "g_pipes_big_turn_right": [
    { prob: 0.5, name: "pipe_big_turn_right" }
  ],
  "g_pipes_big_turn_left": [
    { prob: 0.5, name: "pipe_big_turn_left" }
  ],
  "g_stains": [
    { prob: 0.5, name: "" },
    { prob: 0.5, name: "stain" },
    { prob: 0.5, name: "stain" },
    { prob: 0.5, name: "stain" }
  ],
  "g_stains_ceiling": [
    { prob: 0.5, name: "" },
    { prob: 0.5, name: "stain_ceiling" },
    { prob: 0.5, name: "stain_ceiling" }
  ],
  "g_catwalks": [
    { prob: 1, name: "catwalk_01" },
    { prob: 0.1, name: "catwalk_02" },
    { prob: 0.1, name: "catwalk_02b" },
    { prob: 0.1, name: "catwalk_03" },
    { prob: 0.1, name: "catwalk_04" }
  ],
  "extras": [
    { name: "hole" },
    { name: "altar_vault_capsule" }
  ]
};
var VAULT_FROZEN_SCENES = {
  "g_pipes_hor": [
    { prob: 0.5, name: "pipe_hor_1" },
    { prob: 0.5, name: "pipe_hor_2" }
  ],
  "g_pipes_ver": [
    { prob: 0.5, name: "pipe_ver_1" },
    { prob: 0.5, name: "pipe_ver_2" }
  ],
  "g_pipes_turn_right": [
    { prob: 0.5, name: "pipe_turn_right" }
  ],
  "g_pipes_turn_left": [
    { prob: 0.5, name: "pipe_turn_left" }
  ],
  "g_pipes_cross": [
    { prob: 0.5, name: "pipe_cross" }
  ]
};
var CRYPT_SCENES = {
  "g_pixel_scene_01": [
    { prob: 1, name: "cathedral" },
    { prob: 1, name: "mining" },
    { prob: 1, name: "polymorphroom" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.5, name: "stairs_right" }
  ],
  "g_pixel_scene_03": [
    { prob: 1, name: "lavaroom" },
    { prob: 1, name: "pit" },
    { prob: 1, name: "symbolroom" },
    { prob: 1, name: "water_lava" }
  ],
  "g_pixel_scene_04": [
    { prob: 0.5, name: "stairs_left" }
  ],
  "g_pixel_scene_05": [
    { prob: 1, name: "room_liquid_funnel" },
    { prob: 1, name: "room_gate_drop" },
    { prob: 1, name: "shop" }
  ],
  "g_pixel_scene_05b": [
    { prob: 1, name: "room_liquid_funnel_b" },
    { prob: 1, name: "room_gate_drop_b" },
    { prob: 1, name: "shop_b" }
  ],
  "g_beam": [
    { prob: 1, name: "beam_01" },
    { prob: 1, name: "beam_02" },
    { prob: 1, name: "beam_03" },
    { prob: 1, name: "beam_04" },
    { prob: 1, name: "beam_05" },
    { prob: 1, name: "beam_06" },
    { prob: 1, name: "beam_07" },
    { prob: 1, name: "beam_08" }
  ],
  "g_caveins": [
    { prob: 5, name: "" },
    { prob: 1, name: "cavein_01" },
    { prob: 1, name: "cavein_02" },
    { prob: 1, name: "cavein_03" },
    { prob: 1, name: "cavein_04" }
  ]
};
var TOWER_SCENES = {
  /*
  "g_pixel_scene_01": [
  	{prob: 0.5, name: "coalpit01"},
  	{prob: 0.5, name: "coalpit02"},
  	{prob: 0.5, name: "carthill"},
  	{prob: 0.5, name: "coalpit03"},
  	{prob: 0.5, name: "coalpit04"},
  	{prob: 0.5, name: "coalpit05"},
  ],
  "g_pixel_scene_02": [
  	{prob: 0.5, name: "shrine01"},
  	{prob: 0.5, name: "shrine02"},
  	{prob: 0.5, name: "slimepit"},
  	{prob: 0.5, name: "laboratory"},
  	{prob: 0.5, name: "swarm"},
  	{prob: 0.5, name: "symbolroom"},
  	{prob: 1.2, name: "physics_01"},
  	{prob: 1.2, name: "physics_02"},
  	{prob: 1.2, name: "physics_03"},
  	{prob: 0.75, name: "shop"},
  	{prob: 0.1, name: "radioactivecave"},
  	{prob: 1.5, name: "wandtrap_h_02"},
  	{prob: 1.5, name: "wandtrap_h_04", color_material: {"f0bbee": ["oil", "alcohol", "gunpowder_explosive", "oil", "alcohol", "oil", "alcohol"]}},
  	{prob: 1.5, name: "wandtrap_h_06", color_material: {"f0bbee": ["magic_liquid_teleportation", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "radioactive_liquid"]}},
  	{prob: 1.5, name: "wandtrap_h_07", color_material: {"f0bbee": ["water", "oil", "alcohol", "radioactive_liquid"]}},
  ],
  "g_oiltank": [
  	{prob: 1.0, name: "oiltank_1", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "coal", "radioactive_liquid"]}},
  	{prob: 0.0004, name: "oiltank_1", color_material: {"f0bbee": ["magic_liquid_teleportation", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "magic_liquid_berserk", "magic_liquid_charm", "magic_liquid_invisibility", "magic_liquid_hp_regeneration", "salt", "blood", "gold", "honey"]}},
  	{prob: 0.01, name: "oiltank_2", color_material: {"f0bbee": ["blood_fungi", "blood_cold", "lava", "poison", "slime", "gunpowder_explosive", "soil", "salt", "blood", "cement"]}},
  	{prob: 1.0, name: "oiltank_2", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "oil", "coal", "radioactive_liquid"]}},
  	{prob: 1.0, name: "oiltank_3", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "water", "coal", "radioactive_liquid", "magic_liquid_teleportation"]}},
  	{prob: 1.0, name: "oiltank_4", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "coal", "radioactive_liquid", "magic_liquid_polymorph"]}},
  	{prob: 1.0, name: "oiltank_5", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "radioactive_liquid", "coal", "radioactive_liquid"]}},
  ],
  "g_oiltank_alt": [
  	{prob: 1.0, name: "oiltank_alt", color_material: {"f0bbee": ["water", "oil", "water", "oil", "alcohol", "sand", "radioactive_liquid", "radioactive_liquid", "magic_liquid_berserk"]}},
  ],
  */
};
var SANDCAVE_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.6, name: "shaft" },
    { prob: 0.4, name: "bridge" }
  ],
  "g_pixel_scene_02": [
    { prob: 0.4, name: "cargobay" },
    { prob: 0.4, name: "bar" },
    { prob: 0.4, name: "bedroom" }
  ]
};
var LIQUIDCAVE_SCENES = {
  "g_pixel_scene_01": [
    { prob: 0.5, name: "container_01", color_material: { "f0bbee": ["oil", "alcohol", "lava", "magic_liquid_teleportation", "magic_liquid_protection_all", "material_confusion", "liquid_fire", "magic_liquid_weakness"] } }
  ]
};
var THE_END_SCENES = {
  "g_pixel_scene_01": [
    { prob: 1, name: "cathedral" },
    { prob: 1, name: "mining" }
  ]
};
var PYRAMID_SCENES = {
  "extras": [
    { name: "boss_limbs" },
    { name: "entrance" },
    { name: "hallway" },
    { name: "left" },
    { name: "left_bottom" },
    //{name: "reward"}, // Unused
    { name: "right" },
    { name: "right_bottom" },
    { name: "top" }
  ]
};
var THE_SKY_SCENES = {
  "g_pixel_scene_01": [
    { prob: 1, name: "cathedral" },
    { prob: 1, name: "mining" }
  ]
};
var GENERAL_SCENES = {
  "extras": [
    { name: "wand_altar" },
    { name: "wand_altar_vault" },
    { name: "potion_altar" },
    { name: "potion_altar_vault" },
    { name: "the_end_shop" },
    // Moving this to general to avoid alias issue
    { name: "tower_start" },
    { name: "greed_treasure" },
    { name: "fishing_hut" },
    { name: "bunker" },
    { name: "bunker2" },
    { name: "rainbow_cloud" },
    { name: "eyespot" },
    { name: "huussi" },
    { name: "dragoncave" },
    { name: "funroom" },
    { name: "meatroom" },
    { name: "null_room" },
    { name: "roboroom" },
    { name: "robot_egg" },
    { name: "wizardcave_entrance" },
    { name: "teleportroom" },
    // Renamed because of another non-general one with the smae name
    { name: "ocarina" },
    { name: "orbroom" },
    { name: "secret_lab" },
    { name: "essenceroom" },
    { name: "essenceroom_submerged" },
    { name: "alchemist_secret" },
    { name: "alchemist_secret_music" },
    { name: "boss_victoryroom" },
    { name: "cavern" },
    { name: "friendroom" },
    { name: "watercave_layout_1" },
    { name: "watercave_layout_2" },
    { name: "watercave_layout_3" },
    { name: "watercave_layout_4" },
    { name: "watercave_layout_5" },
    { name: "solid_wall_hidden_cavern" },
    { name: "mystery_teleport" },
    { name: "roadblock" },
    { name: "boss_arena_top" },
    { name: "lavalake_racing" },
    { name: "lavalake_pit" },
    { name: "lavalake_pit_cracked" },
    { name: "cauldron" },
    { name: "clean_entrance" },
    { name: "scale" },
    { name: "scale_old" }
  ]
};
var OVERWORLD_SCENES = {
  "extras": [
    { name: "essence_altar" },
    { name: "essence_altar_desert" },
    { name: "snowy_ruins_eye_pillar" },
    { name: "cliff" },
    { name: "desert_ruins_base_01" },
    { name: "music_machine_stand" }
  ]
};
var TEMPLE_SCENES = {
  "extras": [
    { name: "altar" },
    { name: "altar_left" },
    { name: "altar_right" },
    { name: "altar_right_snowcastle" },
    { name: "altar_top" },
    { name: "altar_top_blood" },
    { name: "altar_top_lava" },
    { name: "altar_top_oil" },
    { name: "altar_top_radioactive" },
    { name: "altar_top_water" },
    { name: "altar_top_ending" }
  ]
};
var MOUNTAIN_SCENES = {
  "extras": [
    { name: "floating_island" },
    { name: "top" },
    { name: "left_entrance" },
    { name: "hall" },
    { name: "right" },
    { name: "right_stub" }
  ]
};
var TEMPLE_ALTAR_SCENES = {};
var FUNGICAVE_SCENES = {};
var FUNGIFOREST_SCENES = {};
var WANDCAVE_SCENES = {};
var WIZARDCAVE_SCENES = {};
var ROBOBASE_SCENES = {};
var SNOWCHASM_SCENES = {};
var CLOUDS_SCENES = {};
var EXCAVATIONSITE_CUBE_CHAMBER_SCENES = {
  "extras": [
    { name: "cube_chamber" }
  ]
};
var SNOWCAVE_SECRET_CHAMBER_SCENES = {
  "extras": [
    { name: "secret_chamber" }
  ]
};
var SNOWCASTLE_CAVERN_SCENES = {
  "extras": [
    { name: "side_cavern_left" },
    { name: "side_cavern_right" }
  ]
};
var SNOWCASTLE_HOURGLASS_CHAMBER_SCENES = {
  "extras": [
    { name: "hourglass_chamber" }
  ]
};
var BIOME_WATCHTOWER_SCENES = {};
var BIOME_BARREN_SCENES = {};
var BIOME_POTION_MIMICS_SCENES = {};
var BIOME_DARKNESS_SCENES = {};
var BIOME_BOSS_SKY_SCENES = {};
var SPLICED_SCENES = {
  "extras": [
    { name: "boss_arena" },
    { name: "gourd_room" },
    { name: "lake_statue" },
    { name: "lavalake_pit_bottom" },
    { name: "lavalake2" },
    { name: "moon" },
    { name: "moon_dark" },
    { name: "mountain_lake" },
    { name: "skull" },
    { name: "skull_in_desert" },
    { name: "tree" },
    { name: "watercave" }
  ]
};
var PIXEL_SCENE_BIOME_MAP = {
  "coalmine": COALMINE_SCENES,
  "coalmine_alt": COALMINE_ALT_SCENES,
  "excavationsite": EXCAVATIONSITE_SCENES,
  "snowcave": SNOWCAVE_SCENES,
  "snowcastle": SNOWCASTLE_SCENES,
  "rainforest": RAINFOREST_SCENES,
  "rainforest_open": RAINFOREST_OPEN_SCENES,
  "rainforest_dark": RAINFOREST_DARK_SCENES,
  "vault": VAULT_SCENES,
  "vault_frozen": VAULT_FROZEN_SCENES,
  "crypt": CRYPT_SCENES,
  "fungicave": FUNGICAVE_SCENES,
  "fungiforest": FUNGIFOREST_SCENES,
  "wandcave": WANDCAVE_SCENES,
  "wizardcave": WIZARDCAVE_SCENES,
  "liquidcave": LIQUIDCAVE_SCENES,
  "robobase": ROBOBASE_SCENES,
  "sandcave": SANDCAVE_SCENES,
  "winter_caves": SNOWCHASM_SCENES,
  "clouds": CLOUDS_SCENES,
  "the_sky": THE_SKY_SCENES,
  "the_end": THE_END_SCENES,
  "temple_altar": TEMPLE_ALTAR_SCENES,
  // (Note that the tower biomes do not have pixel scenes, aside from the general ones like wand/potion pedestals)
  "solid_wall_tower_1": TOWER_SCENES,
  // Mines
  "solid_wall_tower_2": TOWER_SCENES,
  // Coal Pits
  "solid_wall_tower_3": TOWER_SCENES,
  // Snowy Depths
  "solid_wall_tower_4": TOWER_SCENES,
  // Hiisi Base
  "solid_wall_tower_5": TOWER_SCENES,
  // Fungal Caverns
  "solid_wall_tower_6": TOWER_SCENES,
  // Underground Jungle
  "solid_wall_tower_7": TOWER_SCENES,
  // The Vault
  "solid_wall_tower_8": TOWER_SCENES,
  // Temple of the Art
  "solid_wall_tower_9": TOWER_SCENES,
  // Hell
  "excavationsite_cube_chamber": EXCAVATIONSITE_CUBE_CHAMBER_SCENES,
  "snowcave_secret_chamber": SNOWCAVE_SECRET_CHAMBER_SCENES,
  "snowcastle_cavern": SNOWCASTLE_CAVERN_SCENES,
  "snowcastle_hourglass_chamber": SNOWCASTLE_HOURGLASS_CHAMBER_SCENES,
  "pyramid": PYRAMID_SCENES,
  "biome_watchtower": BIOME_WATCHTOWER_SCENES,
  "biome_barren": BIOME_BARREN_SCENES,
  "biome_potion_mimics": BIOME_POTION_MIMICS_SCENES,
  "biome_darkness": BIOME_DARKNESS_SCENES,
  "biome_boss_sky": BIOME_BOSS_SKY_SCENES,
  "overworld": OVERWORLD_SCENES,
  "temple": TEMPLE_SCENES,
  "mountain": MOUNTAIN_SCENES,
  "general": GENERAL_SCENES,
  "spliced": SPLICED_SCENES
};

// vendor/noita-telescope-main/js/spawn_function_config.js
var COALMINE_SPAWNS = [
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 11796480, funcName: "spawn_fungi", active: true },
  { color: 9868920, funcName: "load_structures" },
  { color: 9861240, funcName: "load_large_structures" },
  { color: 9861270, funcName: "load_i_structures" },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 12801792, funcName: "load_oiltank", isPixelScene: true, active: true },
  { color: 5615435, funcName: "load_altar", isPixelScene: true, active: true },
  { color: 2341315, funcName: "spawn_altar_torch" },
  { color: 5615500, funcName: "spawn_skulls" },
  { color: 5635980, funcName: "spawn_chest", active: true },
  { color: 5117790, funcName: "load_oiltank_alt", isPixelScene: true, active: true },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 5307130, funcName: "spawn_trapwand", active: true },
  { color: 15805109, funcName: "spawn_bbqbox", active: true },
  { color: 23805, funcName: "spawn_swing_puzzle_box" },
  { color: 46588, funcName: "spawn_swing_puzzle_target", active: true },
  { color: 9685504, funcName: "spawn_oiltank_puzzle", active: true },
  { color: 12153600, funcName: "spawn_receptacle_oil", active: true }
];
var COALMINE_ALT_SPAWNS = [
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 11796480, funcName: "spawn_fungi", active: true },
  { color: 9868920, funcName: "load_structures" },
  { color: 9861240, funcName: "load_large_structures" },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 3380044, funcName: "spawn_shopitem", active: true }
];
var EXCAVATIONSITE_SPAWNS = [
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 16732415, funcName: "spawn_hanger" },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 44142, funcName: "load_pixel_scene4_alt", isPixelScene: true, active: true },
  { color: 20735, funcName: "spawn_wheel" },
  { color: 86271, funcName: "spawn_wheel_small" },
  { color: 151807, funcName: "spawn_wheel_tiny" },
  { color: 2961068, funcName: "spawn_rock" },
  { color: 676095, funcName: "spawn_physicsstructure" },
  { color: 13212159, funcName: "spawn_hanging_prop" },
  { color: 7891199, funcName: "load_puzzleroom", isPixelScene: true, active: true },
  { color: 7395230, funcName: "load_gunpowderpool_01", isPixelScene: true, active: true },
  { color: 7395231, funcName: "load_gunpowderpool_02", isPixelScene: true, active: true },
  { color: 7395232, funcName: "load_gunpowderpool_03", isPixelScene: true, active: true },
  { color: 7395233, funcName: "load_gunpowderpool_04", isPixelScene: true, active: true },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 11571222, funcName: "spawn_meditation_cube", active: true },
  { color: 34140, funcName: "spawn_receptacle" },
  { color: 11665305, funcName: "spawn_tower_short" },
  { color: 6063440, funcName: "spawn_tower_tall" },
  { color: 2260991, funcName: "spawn_beam_low" },
  { color: 8530175, funcName: "spawn_beam_low_flipped" },
  { color: 39098, funcName: "spawn_beam_steep" },
  { color: 7733417, funcName: "spawn_beam_steep_flipped" }
];
var SNOWCAVE_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 44083, funcName: "load_pixel_scene3", isPixelScene: true, active: true },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 4624839, funcName: "load_puzzle_capsule", isPixelScene: true, active: true },
  { color: 3576279, funcName: "load_puzzle_capsule_b", isPixelScene: true, active: true },
  { color: 5615435, funcName: "load_altar", isPixelScene: true, active: true },
  { color: 2341315, funcName: "spawn_altar_torch" },
  { color: 5615500, funcName: "spawn_skulls" },
  { color: 16062179, funcName: "spawn_scavenger_party", active: true },
  { color: 16762958, funcName: "spawn_acid" },
  { color: 7505348, funcName: "load_acidtank_right", isPixelScene: true, active: true },
  { color: 9728708, funcName: "load_acidtank_left", isPixelScene: true, active: true },
  { color: 5260800, funcName: "spawn_stones" },
  { color: 13107455, funcName: "load_pixel_scene_alt", isPixelScene: true, active: true },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 4407360, funcName: "spawn_burning_barrel" },
  { color: 11837450, funcName: "spawn_fish", active: true },
  { color: 11158271, funcName: "spawn_electricity_trap" },
  { color: 3563896, funcName: "spawn_buried_eye_teleporter", active: true },
  { color: 8873283, funcName: "spawn_statue_hand" },
  { color: 34140, funcName: "spawn_receptacle" }
];
var SNOWCASTLE_SPAWNS = [
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 107002, funcName: "spawn_turret", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 13078304, funcName: "spawn_barricade" },
  { color: 12591861, funcName: "spawn_forcefield_generator" },
  { color: 10737920, funcName: "spawn_brimstone", active: true },
  { color: 55682, funcName: "spawn_vasta_or_vihta", active: true },
  { color: 9642016, funcName: "spawn_cook", active: true },
  { color: 6374960, funcName: "load_panel_01" },
  { color: 6374965, funcName: "load_panel_02" },
  { color: 6374974, funcName: "load_panel_03" },
  { color: 6374968, funcName: "load_panel_04" },
  { color: 6374982, funcName: "load_panel_07" },
  { color: 6374992, funcName: "load_panel_08" },
  { color: 6375e3, funcName: "load_panel_09" },
  { color: 12661759, funcName: "load_chamfer_top_r", isPixelScene: true, active: true },
  { color: 9122815, funcName: "load_chamfer_top_l", isPixelScene: true, active: true },
  { color: 8922291, funcName: "load_chamfer_bottom_r", isPixelScene: true, active: true },
  { color: 6235053, funcName: "load_chamfer_bottom_l", isPixelScene: true, active: true },
  { color: 7602087, funcName: "load_chamfer_inner_top_r", isPixelScene: true, active: true },
  { color: 14024575, funcName: "load_chamfer_inner_top_l", isPixelScene: true, active: true },
  { color: 3702097, funcName: "load_chamfer_inner_bottom_r", isPixelScene: true, active: true },
  { color: 9942363, funcName: "load_chamfer_inner_bottom_l", isPixelScene: true, active: true },
  { color: 4481180, funcName: "load_pillar_filler", isPixelScene: true, active: true },
  { color: 4474012, funcName: "load_pillar_filler_tall", isPixelScene: true, active: true },
  { color: 11546712, funcName: "load_pod_large", isPixelScene: true, active: true },
  { color: 11556912, funcName: "load_pod_small_l", isPixelScene: true, active: true },
  { color: 11571248, funcName: "load_pod_small_r", isPixelScene: true, active: true },
  { color: 16754265, funcName: "load_furniture" },
  { color: 16696208, funcName: "load_furniture_bunk" },
  { color: 5006304, funcName: "spawn_root_grower" },
  { color: 5024939, funcName: "spawn_forge_check" },
  { color: 2783487, funcName: "spawn_drill_laser" }
];
var RAINFOREST_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 4194304, funcName: "spawn_scavengers", active: true },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 9711664, funcName: "spawn_dragonspot", active: true },
  { color: 5006304, funcName: "spawn_root_grower" },
  { color: 8413990, funcName: "spawn_tree" }
];
var RAINFOREST_OPEN_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 4194304, funcName: "spawn_scavengers", active: true },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 9711664, funcName: "spawn_dragonspot", active: true },
  { color: 5006304, funcName: "spawn_root_grower" },
  { color: 8413990, funcName: "spawn_tree" }
];
var RAINFOREST_DARK_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 4194304, funcName: "spawn_scavengers", active: true },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 9711664, funcName: "spawn_dragonspot", active: true },
  { color: 5006304, funcName: "spawn_root_grower" },
  { color: 8413990, funcName: "spawn_tree" }
];
var VAULT_SPAWNS = [
  { color: 6893204, funcName: "load_pixel_scene_wide", isPixelScene: true, active: true },
  { color: 8531547, funcName: "load_pixel_scene_tall", isPixelScene: true, active: true },
  { color: 44132, funcName: "load_warning_strip" },
  { color: 107002, funcName: "spawn_turret", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 5262180, funcName: "spawn_machines" },
  { color: 13212159, funcName: "spawn_hanging_prop" },
  { color: 12485190, funcName: "spawn_pipes_hor", isPixelScene: true, active: true },
  { color: 12485220, funcName: "spawn_pipes_turn_right", isPixelScene: true, active: true },
  { color: 12485250, funcName: "spawn_pipes_turn_left", isPixelScene: true, active: true },
  { color: 12485280, funcName: "spawn_pipes_ver", isPixelScene: true, active: true },
  { color: 12485310, funcName: "spawn_pipes_cross", isPixelScene: true, active: true },
  { color: 3048006, funcName: "spawn_pipes_big_hor", isPixelScene: true, active: true },
  { color: 3048036, funcName: "spawn_pipes_big_turn_right", isPixelScene: true, active: true },
  { color: 3048066, funcName: "spawn_pipes_big_turn_left", isPixelScene: true, active: true },
  { color: 3048096, funcName: "spawn_pipes_big_ver", isPixelScene: true, active: true },
  { color: 6058970, funcName: "spawn_stains", isPixelScene: true, active: true },
  { color: 6058971, funcName: "spawn_stains_ceiling", isPixelScene: true, active: true },
  { color: 13078304, funcName: "spawn_barricade" },
  { color: 4853885, funcName: "load_pillar" },
  { color: 8083883, funcName: "load_pillar_base" },
  { color: 4259790, funcName: "load_catwalk", isPixelScene: true, active: true },
  { color: 12536966, funcName: "spawn_apparatus" },
  { color: 11158271, funcName: "spawn_electricity_trap" },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 11333963, funcName: "spawn_laser_trap", isPixelScene: true, active: true },
  { color: 10771199, funcName: "spawn_lab_puzzle", active: true }
];
var CRYPT_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 8421376, funcName: "spawn_statues" },
  { color: 44083, funcName: "load_pixel_scene3", isPixelScene: true, active: true },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 9939712, funcName: "load_pixel_scene5", isPixelScene: true, active: true },
  { color: 13228377, funcName: "load_pixel_scene5b", isPixelScene: true, active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13107226, funcName: "spawn_ghost_crystal", active: true },
  { color: 8585050, funcName: "spawn_crawlers" },
  { color: 6585725, funcName: "spawn_pressureplates" },
  { color: 6593405, funcName: "spawn_doors" },
  { color: 10516580, funcName: "spawn_scavengers", active: true },
  { color: 16764202, funcName: "spawn_scorpions", active: true },
  { color: 2956890, funcName: "spawn_bones" },
  { color: 7872608, funcName: "load_beam", isPixelScene: true, active: true },
  { color: 7876704, funcName: "load_background_scene" },
  { color: 3641028, funcName: "load_small_background_scene" },
  { color: 7890016, funcName: "load_cavein", isPixelScene: true, active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 5462408, funcName: "spawn_statue_back" },
  { color: 3380044, funcName: "spawn_shopitem", active: true }
];
var PYRAMID_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 8421376, funcName: "spawn_statues" },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13107226, funcName: "spawn_ghost_crystal", active: true },
  { color: 8585050, funcName: "spawn_crawlers" },
  { color: 6585725, funcName: "spawn_pressureplates" },
  { color: 6593405, funcName: "spawn_doors" },
  { color: 10516580, funcName: "spawn_scavengers", active: true },
  { color: 44083, funcName: "load_pixel_scene3", isPixelScene: true, active: true },
  { color: 16764202, funcName: "spawn_scorpions", active: true },
  { color: 9461451, funcName: "spawn_reward_wands" },
  { color: 9461452, funcName: "spawn_boss_limbs_trigger" }
];
var FUNGICAVE_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 4194304, funcName: "spawn_robots", active: true },
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 3191728, funcName: "spawn_physics_fungus" }
];
var FUNGIFOREST_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 3191728, funcName: "spawn_physics_fungus" },
  { color: 3191792, funcName: "spawn_physics_acid_fungus" },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 6983033, funcName: "spawn_fungitrap" }
];
var WIZARDCAVE_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 8421376, funcName: "spawn_statues" },
  { color: 44083, funcName: "load_pixel_scene3", isPixelScene: true, active: true },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 9939712, funcName: "load_pixel_scene5", isPixelScene: true, active: true },
  { color: 13228377, funcName: "load_pixel_scene5b", isPixelScene: true, active: true },
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 4194432, funcName: "spawn_large_enemies", active: true },
  { color: 13107226, funcName: "spawn_ghost_crystal", active: true },
  { color: 8585050, funcName: "spawn_crawlers" },
  { color: 6585725, funcName: "spawn_pressureplates" },
  { color: 6593405, funcName: "spawn_doors" },
  { color: 10516580, funcName: "spawn_scavengers", active: true },
  { color: 16764202, funcName: "spawn_scorpions", active: true },
  { color: 2956890, funcName: "spawn_bones" },
  { color: 7872608, funcName: "load_beam", isPixelScene: true, active: true },
  { color: 7876704, funcName: "load_background_scene" },
  { color: 3641028, funcName: "load_small_background_scene" },
  { color: 7890016, funcName: "load_cavein", isPixelScene: true, active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 5462408, funcName: "spawn_statue_back" },
  { color: 3380044, funcName: "spawn_shopitem", active: true }
];
var WANDCAVE_SPAWNS = [
  { color: 8409088, funcName: "spawn_cloud_trap" },
  { color: 3766144, funcName: "load_floor_rubble" },
  { color: 65440, funcName: "load_floor_rubble_l" },
  { color: 1878015, funcName: "load_floor_rubble_r" }
];
var LIQUIDCAVE_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 44132, funcName: "load_background_panel_big" },
  { color: 9861240, funcName: "spawn_lasergun", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 13143467, funcName: "spawn_statues", active: true }
];
var ROBOBASE_SPAWNS = [
  { color: 44132, funcName: "load_warning_strip" },
  { color: 107002, funcName: "spawn_turret", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 13212159, funcName: "spawn_hanging_prop" },
  { color: 13078304, funcName: "spawn_barricade" },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 3778400, funcName: "spawn_lasergate_ver" }
];
var SANDCAVE_SPAWNS = [
  { color: 13158400, funcName: "spawn_lamp2" },
  { color: 14418016, funcName: "spawn_props4" }
];
var SNOWCHASM_SPAWNS = [
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 13684916, funcName: "spawn_treasure", active: true },
  { color: 4288589, funcName: "spawn_specialshop", active: true },
  { color: 2316821, funcName: "spawn_music_machine", active: true },
  { color: 16772829, funcName: "init" }
];
var THE_END_SPAWNS = [
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 12480589, funcName: "spawn_specialshop", active: true }
];
var THE_SKY_SPAWNS = [
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 12480589, funcName: "spawn_specialshop", active: true }
];
var MEAT_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 5615500, funcName: "spawn_skulls" },
  { color: 5006305, funcName: "spawn_cyst" },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 14253951, funcName: "spawn_mouth", active: true },
  { color: 13212159, funcName: "spawn_hanging_prop" }
];
var VAULT_FROZEN_SPAWNS = [
  { color: 4194304, funcName: "spawn_robots", active: true },
  { color: 44132, funcName: "load_pixel_scene4", isPixelScene: true, active: true },
  { color: 107002, funcName: "spawn_turret", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 5262180, funcName: "spawn_machines" },
  { color: 12485190, funcName: "spawn_pipes_hor", isPixelScene: true, active: true },
  { color: 12485220, funcName: "spawn_pipes_turn_right", isPixelScene: true, active: true },
  { color: 12485250, funcName: "spawn_pipes_turn_left", isPixelScene: true, active: true },
  { color: 12485280, funcName: "spawn_pipes_ver", isPixelScene: true, active: true },
  { color: 12485310, funcName: "spawn_pipes_cross", isPixelScene: true, active: true },
  { color: 13078304, funcName: "spawn_barricade" }
];
var TOWER_SPAWNS = [
  { color: 255, funcName: "spawn_nest", active: true },
  { color: 11796480, funcName: "spawn_fungi", active: true },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 5615500, funcName: "spawn_skulls" },
  { color: 5635980, funcName: "spawn_chest", active: true },
  { color: 3380044, funcName: "spawn_shopitem", active: true }
];
var SNOWCASTLE_CAVERN_SPAWNS = [
  { color: 13158400, funcName: "spawn_lamp" },
  { color: 8453978, funcName: "spawn_vines" },
  { color: 3380044, funcName: "spawn_shopitem", active: true },
  { color: 16772829, funcName: "init" },
  { color: 253615, funcName: "spawn_fish", active: true },
  { color: 16722292, funcName: "spawn_hourglass_blood" },
  { color: 16748834, funcName: "spawn_hourglass_master" },
  { color: 2190335, funcName: "spawn_hourglass_music_trigger" }
];
var EXCAVATIONSITE_CUBE_CHAMBER_SPAWNS = [
  { color: 5615500, funcName: "spawn_skulls" },
  { color: 16772829, funcName: "init" },
  { color: 3563896, funcName: "spawn_teleporter" }
];
var ROBOT_EGG_SPAWNS = [
  { color: 16772829, funcName: "init" },
  { color: 5541751, funcName: "spawn_teleport" },
  { color: 7378453, funcName: "spawn_chest" }
];
var TEMPLES_COMMON_SPAWNS = [
  { color: 8409088, funcName: "spawn_cloud_trap" },
  { color: 3766144, funcName: "load_floor_rubble" },
  { color: 65440, funcName: "load_floor_rubble_l" },
  { color: 1878015, funcName: "load_floor_rubble_r" },
  { color: 16772817, funcName: "spawn_puzzle_watchtower" },
  { color: 16772826, funcName: "spawn_puzzle_barren" },
  { color: 16772827, funcName: "spawn_puzzle_potion_mimics" },
  { color: 16772828, funcName: "spawn_puzzle_darkness" },
  { color: 16772829, funcName: "spawn_boss", active: true },
  { color: 16772830, funcName: "spawn_potion_mimic_empty", active: true },
  { color: 16772831, funcName: "spawn_potion_mimic", active: true },
  { color: 16772816, funcName: "spawn_fish_many" },
  { color: 16772818, funcName: "spawn_boss_phase2_marker", active: true },
  { color: 16772819, funcName: "spawn_book_barren" },
  { color: 16772820, funcName: "spawn_potion_beer", active: true },
  { color: 16772821, funcName: "spawn_potion_milk", active: true },
  { color: 16772822, funcName: "spawn_scorpion", active: true },
  { color: 16755370, funcName: "spawn_sign_left" },
  { color: 16755421, funcName: "spawn_sign_right" }
];
var WATCHTOWER_SPAWNS = [
  { color: 11206400, funcName: "spawn_small_enemies2", active: true },
  { color: 16755200, funcName: "spawn_big_enemies2", active: true }
];
var CLOUDS_SPAWNS = [];
var TEMPLE_ALTAR_SPAWNS = [];
var LAKE_DEEP_SPAWNS = [];
var DEFAULT_SPAWNS = [
  { color: 16711680, funcName: "spawn_small_enemies", active: true },
  { color: 8388608, funcName: "spawn_big_enemies", active: true },
  { color: 65280, funcName: "spawn_items", isPixelScene: true, active: true },
  // Could occasionally not be a pixel scene...
  { color: 13143322, funcName: "spawn_props", active: true },
  { color: 13139968, funcName: "spawn_props2", active: true },
  { color: 13107264, funcName: "spawn_props3", active: true },
  { color: 16776960, funcName: "spawn_lamp", active: true },
  { color: 16714495, funcName: "load_pixel_scene", isPixelScene: true, active: true },
  { color: 16711808, funcName: "load_pixel_scene2", isPixelScene: true, active: true },
  { color: 16744448, funcName: "spawn_unique_enemy", active: true },
  { color: 13123648, funcName: "spawn_unique_enemy2", active: true },
  { color: 8405056, funcName: "spawn_unique_enemy3", active: true },
  { color: 9881680, funcName: "spawn_ghostlamp", active: true },
  { color: 6332516, funcName: "spawn_candles", active: true },
  { color: 5283840, funcName: "spawn_potion_altar", isPixelScene: true, active: true },
  { color: 12361968, funcName: "spawn_potions", active: true },
  { color: 65370, funcName: "spawn_apparition", active: true },
  { color: 7929855, funcName: "spawn_heart", active: true },
  { color: 5284080, funcName: "spawn_wands", active: true },
  { color: 12527270, funcName: "spawn_portal", active: true },
  { color: 305527, funcName: "spawn_end_portal", active: true },
  { color: 16765297, funcName: "spawn_orb", active: true },
  { color: 16765313, funcName: "spawn_perk", active: true },
  { color: 16777089, funcName: "spawn_all_perks", active: true },
  { color: 13101864, funcName: "spawn_wand_trap", active: true },
  { color: 15269760, funcName: "spawn_wand_trap_ignite", active: true },
  { color: 2582750, funcName: "spawn_wand_trap_electricity_source", active: true },
  { color: 2582751, funcName: "spawn_wand_trap_electricity", active: true },
  { color: 7032731, funcName: "spawn_moon", active: true },
  { color: 14136296, funcName: "spawn_collapse", active: true }
];
var BIOME_SPAWN_FUNCTION_MAP = {
  "general": [...DEFAULT_SPAWNS],
  // Not a real biome, just for things that can spawn anywhere
  "coalmine": [...DEFAULT_SPAWNS, ...COALMINE_SPAWNS],
  "coalmine_alt": [...DEFAULT_SPAWNS, ...COALMINE_ALT_SPAWNS],
  "excavationsite": [...DEFAULT_SPAWNS, ...EXCAVATIONSITE_SPAWNS],
  "snowcave": [...DEFAULT_SPAWNS, ...SNOWCAVE_SPAWNS],
  "snowcastle": [...DEFAULT_SPAWNS, ...SNOWCASTLE_SPAWNS],
  "rainforest": [...DEFAULT_SPAWNS, ...RAINFOREST_SPAWNS],
  "rainforest_open": [...DEFAULT_SPAWNS, ...RAINFOREST_OPEN_SPAWNS],
  "rainforest_dark": [...DEFAULT_SPAWNS, ...RAINFOREST_DARK_SPAWNS],
  "vault": [...DEFAULT_SPAWNS, ...VAULT_SPAWNS],
  "vault_frozen": [...DEFAULT_SPAWNS, ...VAULT_FROZEN_SPAWNS],
  "crypt": [...DEFAULT_SPAWNS, ...CRYPT_SPAWNS],
  "pyramid": [...DEFAULT_SPAWNS, ...PYRAMID_SPAWNS],
  "fungicave": [...DEFAULT_SPAWNS, ...FUNGICAVE_SPAWNS],
  "fungiforest": [...DEFAULT_SPAWNS, ...FUNGIFOREST_SPAWNS],
  "wandcave": [...DEFAULT_SPAWNS, ...WANDCAVE_SPAWNS],
  "wizardcave": [...DEFAULT_SPAWNS, ...WIZARDCAVE_SPAWNS],
  "liquidcave": [...DEFAULT_SPAWNS, ...LIQUIDCAVE_SPAWNS],
  "robobase": [...DEFAULT_SPAWNS, ...ROBOBASE_SPAWNS],
  "sandcave": [...DEFAULT_SPAWNS, ...SANDCAVE_SPAWNS],
  "winter_caves": [...DEFAULT_SPAWNS, ...SNOWCHASM_SPAWNS],
  // Snowy Chasm
  "clouds": [...DEFAULT_SPAWNS, ...CLOUDS_SPAWNS],
  "the_sky": [...DEFAULT_SPAWNS, ...THE_SKY_SPAWNS],
  "the_end": [...DEFAULT_SPAWNS, ...THE_END_SPAWNS],
  "temple_altar": [...DEFAULT_SPAWNS, ...TEMPLE_ALTAR_SPAWNS],
  "meat": [...DEFAULT_SPAWNS, ...MEAT_SPAWNS],
  "lake_deep": [...DEFAULT_SPAWNS, ...LAKE_DEEP_SPAWNS],
  "solid_wall_tower_1": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Mines
  "solid_wall_tower_2": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Coal Pits
  "solid_wall_tower_3": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Snowy Depths
  "solid_wall_tower_4": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Hiisi Base
  "solid_wall_tower_5": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Fungal Caverns
  "solid_wall_tower_6": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Underground Jungle
  "solid_wall_tower_7": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // The Vault
  "solid_wall_tower_8": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Temple of the Art
  "solid_wall_tower_9": [...DEFAULT_SPAWNS, ...TOWER_SPAWNS],
  // Hell
  "snowcastle_cavern": [...DEFAULT_SPAWNS, ...SNOWCASTLE_CAVERN_SPAWNS],
  "excavationsite_cube_chamber": [...DEFAULT_SPAWNS, ...EXCAVATIONSITE_CUBE_CHAMBER_SPAWNS],
  "robot_egg": [...DEFAULT_SPAWNS, ...ROBOT_EGG_SPAWNS],
  "biome_watchtower": [...DEFAULT_SPAWNS, ...TEMPLES_COMMON_SPAWNS, ...WATCHTOWER_SPAWNS],
  "biome_barren": [...DEFAULT_SPAWNS, ...TEMPLES_COMMON_SPAWNS],
  "biome_potion_mimics": [...DEFAULT_SPAWNS, ...TEMPLES_COMMON_SPAWNS],
  "biome_darkness": [...DEFAULT_SPAWNS, ...TEMPLES_COMMON_SPAWNS],
  "biome_boss_sky": [...DEFAULT_SPAWNS, ...TEMPLES_COMMON_SPAWNS]
};

// vendor/noita-telescope-main/js/spawn_config.js
var ALTAR_SPAWN_DATA = {
  // Some of these will apparently have extra offsets that I can't explain but just work?
  "coalmine": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4,
    gx: 0,
    gy: 0
  },
  "coalmine_alt": {
    r0: 0.47,
    rl: 0.725,
    x: 0,
    y: -14,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "excavationsite": {
    rl: 0.725,
    x: 0,
    y: -14,
    xoff: -11.431,
    yoff: 10.5257
  },
  "snowcave": {
    rg: 0.45,
    x: -5,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "snowcastle": {
    rl: 0.2,
    x: 5,
    y: -5,
    // -5 if offset is 5
    xoff: -11.631,
    yoff: 10.2257,
    gx: 0,
    gy: 0,
    // Fixes the 1 tile offset, though not sure where it came from
    rp: 0.65,
    px: 6,
    py: -3
  },
  // TODO: Still bugged, might be a hack in game because of the slightly offset tiles of the two biomes
  "rainforest": {
    rl: 0.27,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    gx: 0,
    gy: 0,
    // Fixes the 1 tile offset, though not sure where it came from
    rp: 0.65,
    px: 5,
    py: -4
  },
  "rainforest_open": {
    rl: 0.27,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "rainforest_dark": {
    rl: 0.27,
    // Seems off, getting false positives occasionally?
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "vault": {
    rg: 0.93,
    x: 5,
    y: -6,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 6,
    py: -4
  },
  "crypt": {
    rl: 0.38,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "fungicave": {
    rl: 0.06,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0,
    // No threshold here
    px: 0,
    py: -6
  },
  "fungiforest": {
    rl: 0.06,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0,
    // No threshold here
    px: 0,
    py: -6
  },
  "wizardcave": {
    rl: 0.38,
    x: 0,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "liquidcave": {
    rg: 0,
    x: 0,
    y: -14,
    // No wands here anyway
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4,
    gx: 0,
    gy: 0
  },
  // Copied from snowcastle, no wands or potions yet there are configs for them
  "sandcave": {
    rg: 0.94,
    x: 5,
    y: -5,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 6,
    py: -3
  },
  "robobase": {
    rg: 0.93,
    x: 5,
    y: -6,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 6,
    py: -4
  },
  "vault_frozen": {
    // Utility box
    ru: 0.93,
    rg: 0.83,
    x: 5,
    y: -6,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 6,
    py: -4
  },
  "meat": {
    // Utility box
    ru: 0.55,
    rg: 0.3,
    x: -5,
    y: -14,
    xoff: -11.631,
    yoff: 10.2257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_1": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_2": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_3": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_4": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_5": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_6": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_7": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "solid_wall_tower_8": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  // This one is broken for some reason? Maybe
  "solid_wall_tower_9": {
    r0: 0.47,
    rl: 0.755,
    x: 5,
    y: -9,
    xoff: -11.431,
    yoff: 10.5257,
    rp: 0.65,
    px: 5,
    py: -4
  },
  "excavationsite_cube_chamber": {
    rg: 1,
    x: 0,
    y: 0,
    xoff: 0,
    yoff: 0,
    rp: 0,
    px: 0,
    py: 0
  },
  "snowcave_secret_chamber": {
    rg: 1,
    x: 0,
    y: 0,
    xoff: 0,
    yoff: 0,
    rp: 0,
    px: 0,
    py: 0
  },
  "robot_egg": {
    rg: 1,
    x: 0,
    y: 0,
    xoff: 0,
    yoff: 0,
    rp: 0,
    px: 0,
    py: 0
  }
};
var WAND_SPAWN_DATA = {
  "coalmine": {
    types: [
      "premade_1",
      "premade_2",
      "premade_3",
      "premade_4",
      "premade_5",
      "premade_6",
      "premade_7",
      "premade_8",
      "premade_9",
      "premade_10",
      "premade_11",
      "premade_12",
      "premade_13",
      "premade_14",
      "premade_15",
      "premade_16",
      "premade_17",
      "wand_level_01"
    ],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9]
  },
  "coalmine_alt": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "excavationsite": {
    types: ["wand_unshuffle_01", "wand_level_02", "wand_level_02_better"],
    weights: [2, 2, 2]
  },
  "snowcave": {
    types: ["wand_level_02", "wand_level_02_better", "wand_unshuffle_02"],
    weights: [5, 5, 5]
  },
  "snowcastle": {
    types: ["wand_level_03", "wand_level_03_better", "wand_unshuffle_03"],
    weights: [5, 5, 5]
  },
  "rainforest": {
    types: ["wand_level_04", "wand_level_05", "wand_unshuffle_02", "wand_unshuffle_03", "wand_level_04_better"],
    weights: [5, 3, 3, 3, 5]
  },
  "rainforest_open": {
    types: ["wand_level_04", "wand_level_05", "wand_unshuffle_02", "wand_unshuffle_03", "wand_level_04_better"],
    weights: [5, 3, 3, 3, 5]
  },
  "vault": {
    types: ["wand_level_05", "wand_level_05_better", "wand_unshuffle_03", "wand_unshuffle_04"],
    weights: [5, 5, 3, 2]
  },
  "crypt": {
    types: ["wand_level_06", "wand_level_06_better", "wand_unshuffle_05", "wand_unshuffle_06"],
    weights: [5, 5, 3, 2]
  },
  "fungicave": {
    types: ["wand_unshuffle_02", "wand_unshuffle_01"],
    weights: [0.5, 0.5]
  },
  "fungiforest": {
    types: ["wand_unshuffle_03", "wand_unshuffle_04", "wand_level_05_better"],
    weights: [5, 5, 5]
  },
  "rainforest_dark": {
    types: ["wand_level_04", "wand_level_05", "wand_unshuffle_03", "wand_unshuffle_04", "wand_level_05_better"],
    weights: [5, 3, 3, 3, 5]
  },
  "wizardcave": {
    types: ["wand_level_06", "wand_level_06_better", "wand_unshuffle_05", "wand_unshuffle_06"],
    weights: [5, 5, 3, 2]
  },
  "liquidcave": {
    types: [],
    weights: []
  },
  "sandcave": {
    types: ["wand_level_04", "wand_unshuffle_02"],
    weights: [5, 5]
  },
  "robobase": {
    types: ["wand_level_05", "wand_level_05_better", "wand_unshuffle_03", "wand_unshuffle_04"],
    weights: [5, 5, 3, 2]
  },
  "vault_frozen": {
    types: ["wand_level_05", "wand_unshuffle_03", "wand_unshuffle_04"],
    weights: [5, 3, 2]
  },
  "meat": {
    types: ["wand_level_05", "wand_level_06", "wand_unshuffle_04", "wand_unshuffle_05"],
    weights: [5, 5, 5, 5]
  },
  "solid_wall_tower_1": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_2": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_3": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_4": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_5": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_6": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_7": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_8": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "solid_wall_tower_9": {
    types: ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  "excavationsite_cube_chamber": {
    types: ["wand_level_03", "wand_unshuffle_02"],
    weights: [0.5, 0.5]
  },
  "snowcave_secret_chamber": {
    types: ["wand_level_03", "wand_unshuffle_02"],
    weights: [0.5, 0.5]
  },
  "robot_egg": {
    types: ["wand_level_05", "wand_level_05_better", "wand_unshuffle_03", "wand_unshuffle_04"],
    weights: [5, 5, 3, 2]
  }
};
var BIOMES_WITH_SMALL_ALTARS = [
  "snowcastle",
  "vault",
  "vault_frozen",
  "robobase"
];
var BIOME_WAND_ALTAR_OFFSET_MAP = {
  // TODO: 
  coalmine: { x: -5, y: -12 },
  //coalmine_alt: {x: -10, y: -17},
  //excavationsite: {x: -10, y: -17},
  snowcave: { x: -15, y: -17 },
  snowcastle: { x: -5, y: -9 },
  //rainforest: {x: -10, y: -17},
  //rainforest_open: {x: -10, y: -17},
  //rainforest_dark: {x: -10, y: -17},
  vault: { x: -5, y: -10 },
  vault_frozen: { x: -5, y: -10 },
  robobase: { x: -5, y: -10 },
  meat: { x: -15, y: -17 },
  solid_wall_tower_1: { x: -5, y: -12 },
  solid_wall_tower_2: { x: -5, y: -12 },
  solid_wall_tower_3: { x: -5, y: -12 },
  solid_wall_tower_4: { x: -5, y: -12 },
  solid_wall_tower_5: { x: -5, y: -12 },
  solid_wall_tower_6: { x: -5, y: -12 },
  solid_wall_tower_7: { x: -5, y: -12 },
  solid_wall_tower_8: { x: -5, y: -12 },
  solid_wall_tower_9: { x: -5, y: -12 }
  // Note: pyramid and liquidcave explcitly *disable* this spawn...
  // So does meditation cube, winter_caves, probably some other ones too
  // Normal side biomes with wand altars don't though.
};
var BIOME_POTION_ALTAR_OFFSET_MAP = {
  // TODO: 
  snowcastle: { x: -3, y: -9 },
  vault: { x: -3, y: -10 },
  vault_frozen: { x: -3, y: -10 },
  robobase: { x: -3, y: -10 },
  fungicave: { x: -10, y: -17 },
  fungiforest: { x: -10, y: -17 }
};

// vendor/noita-telescope-main/js/spells.js
var PROJECTILE = 0;
var STATIC_PROJECTILE = 1;
var MODIFIER = 2;
var DRAW_MANY = 3;
var MATERIAL = 4;
var OTHER = 5;
var UTILITY = 6;
var PASSIVE = 7;
var Spell = class {
  constructor(name, type, spawn_probabilities) {
    this.name = name;
    this.type = type;
    this.spawn_probabilities = spawn_probabilities;
  }
};
var ALL_SPELLS = [
  new Spell("BOMB", PROJECTILE, [1, 1, 1, 1, 0.5, 0.5, 0.1, 0, 0, 0, 0]),
  new Spell("LIGHT_BULLET", PROJECTILE, [2, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("LIGHT_BULLET_TRIGGER", PROJECTILE, [1, 0.5, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("LIGHT_BULLET_TRIGGER_2", PROJECTILE, [0, 0, 1, 0.5, 0, 1, 1, 0, 0, 0, 0.2]),
  new Spell("LIGHT_BULLET_TIMER", PROJECTILE, [0, 0.5, 0.5, 0.75, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("BULLET", PROJECTILE, [0, 1, 1, 1, 0.8, 0.5, 0, 0, 0, 0, 0]),
  new Spell("BULLET_TRIGGER", PROJECTILE, [0, 0.5, 0.5, 0.5, 0.6, 0.5, 0, 0, 0, 0, 0]),
  new Spell("BULLET_TIMER", PROJECTILE, [0, 0, 0.5, 0.5, 0.5, 0.5, 0.6, 0, 0, 0, 0]),
  new Spell("HEAVY_BULLET", PROJECTILE, [0, 0.5, 1, 1, 1, 1, 1, 0, 0, 0, 0]),
  new Spell("HEAVY_BULLET_TRIGGER", PROJECTILE, [0, 0, 0.5, 0.5, 0.5, 0.7, 0.5, 0, 0, 0, 0]),
  new Spell("HEAVY_BULLET_TIMER", PROJECTILE, [0, 0, 0.5, 0.5, 0.5, 0.5, 0.7, 0, 0, 0, 0]),
  new Spell("AIR_BULLET", PROJECTILE, [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SLOW_BULLET", PROJECTILE, [0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
  new Spell("SLOW_BULLET_TRIGGER", PROJECTILE, [0, 0.5, 0.5, 0.5, 0.5, 1, 0, 0, 0, 0, 0]),
  new Spell("SLOW_BULLET_TIMER", PROJECTILE, [0, 0.5, 0.5, 0.5, 0.5, 1, 1, 0, 0, 0, 0]),
  new Spell("HOOK", PROJECTILE, [0, 0.1, 0.3, 0.4, 0.2, 0.1, 0, 0, 0, 0, 0]),
  new Spell("BLACK_HOLE", PROJECTILE, [0.8, 0, 0.8, 0, 0.8, 0.8, 0, 0, 0, 0, 0]),
  new Spell("BLACK_HOLE_DEATH_TRIGGER", PROJECTILE, [0, 0, 0.5, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0]),
  new Spell("WHITE_HOLE", PROJECTILE, [0.05, 0, 0.05, 0, 0.1, 0, 0.2, 0, 0, 0, 0.5]),
  new Spell("BLACK_HOLE_BIG", STATIC_PROJECTILE, [0, 0.8, 0, 0.8, 0, 0.8, 0.8, 0, 0, 0, 0.5]),
  new Spell("WHITE_HOLE_BIG", STATIC_PROJECTILE, [0, 0.05, 0, 0.05, 0, 0.1, 0.4, 0, 0, 0, 0.2]),
  new Spell("BLACK_HOLE_GIGA", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("WHITE_HOLE_GIGA", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("TENTACLE_PORTAL", PROJECTILE, [0, 0.4, 0.4, 0.4, 0.5, 0, 0, 0, 0, 0, 0.2]),
  new Spell("SPITTER", PROJECTILE, [1, 1, 1, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SPITTER_TIMER", PROJECTILE, [0.5, 0.5, 0.5, 1, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SPITTER_TIER_2", PROJECTILE, [0, 0, 1, 1, 1, 0.5, 0, 0, 0, 0, 0]),
  new Spell("SPITTER_TIER_2_TIMER", PROJECTILE, [0, 0, 0.5, 0.5, 0.5, 1, 0, 0, 0, 0, 0]),
  new Spell("SPITTER_TIER_3", PROJECTILE, [0, 0, 0, 0.8, 0.8, 1, 1, 0, 0, 0, 0]),
  new Spell("SPITTER_TIER_3_TIMER", PROJECTILE, [0, 0, 0, 0, 0.5, 0.65, 0.5, 0, 0, 0, 0]),
  new Spell("BUBBLESHOT", PROJECTILE, [1, 0.6, 1, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("BUBBLESHOT_TRIGGER", PROJECTILE, [0, 0.5, 0.5, 1, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("DISC_BULLET", PROJECTILE, [1, 0, 1, 0, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("DISC_BULLET_BIG", PROJECTILE, [0.6, 0, 0.7, 0, 0.8, 0, 0, 0, 0, 0, 0]),
  new Spell("DISC_BULLET_BIGGER", PROJECTILE, [0, 0, 0.1, 0.6, 0, 1, 0, 0, 0, 0, 0.4]),
  new Spell("BOUNCY_ORB", PROJECTILE, [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]),
  new Spell("BOUNCY_ORB_TIMER", PROJECTILE, [0.5, 0, 0.5, 0, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("RUBBER_BALL", PROJECTILE, [1, 1, 0, 0, 0, 0, 0.2, 0, 0, 0, 0]),
  new Spell("ARROW", PROJECTILE, [0, 1, 1, 0, 0.6, 0.3, 0, 0, 0, 0, 0]),
  new Spell("POLLEN", PROJECTILE, [0.6, 1, 0, 1, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("LANCE", PROJECTILE, [0, 0.9, 1, 0, 0, 0.8, 1, 0, 0, 0, 0]),
  new Spell("LANCE_HOLY", PROJECTILE, [0, 0, 0, 0.5, 0, 0.8, 1, 0, 0, 0, 0]),
  new Spell("ROCKET", PROJECTILE, [0, 1, 1, 1, 0.5, 0.3, 0, 0, 0, 0, 0]),
  new Spell("ROCKET_TIER_2", PROJECTILE, [0, 0, 0.5, 1, 1, 0.8, 0.5, 0, 0, 0, 0]),
  new Spell("ROCKET_TIER_3", PROJECTILE, [0, 0, 0.25, 0.5, 1, 1, 1, 0, 0, 0, 0]),
  new Spell("GRENADE", PROJECTILE, [1, 1, 0.5, 0.25, 0.2, 0, 0, 0, 0, 0, 0]),
  new Spell("GRENADE_TRIGGER", PROJECTILE, [0.5, 0.5, 0.2, 0.5, 0.5, 1, 0, 0, 0, 0, 0]),
  new Spell("GRENADE_TIER_2", PROJECTILE, [0, 0.5, 1, 1, 1, 0.5, 0, 0, 0, 0, 0]),
  new Spell("GRENADE_TIER_3", PROJECTILE, [0, 0.25, 0.5, 0.75, 1, 1, 0, 0, 0, 0, 0]),
  new Spell("GRENADE_ANTI", PROJECTILE, [0.4, 0.4, 0.7, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("GRENADE_LARGE", PROJECTILE, [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("MINE", PROJECTILE, [0, 1, 0, 0.75, 1, 0, 0.5, 0, 0, 0, 0]),
  new Spell("MINE_DEATH_TRIGGER", PROJECTILE, [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]),
  new Spell("PIPE_BOMB", PROJECTILE, [0, 0, 1, 1, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("PIPE_BOMB_DEATH_TRIGGER", PROJECTILE, [0, 0, 0.6, 0.8, 1, 0.8, 0, 0, 0, 0, 0]),
  new Spell("FISH", PROJECTILE, [0, 0, 0, 0.01, 0.01, 0.01, 0, 0, 0, 0, 0]),
  new Spell("EXPLODING_DEER", PROJECTILE, [0, 0, 0, 0.6, 0.6, 0.6, 0, 0, 0, 0, 0]),
  new Spell("EXPLODING_DUCKS", PROJECTILE, [0, 0, 0, 0.8, 0.5, 0.6, 0, 0, 0, 0, 0]),
  new Spell("WORM_SHOT", PROJECTILE, [0, 0, 0, 0.6, 0.8, 0.6, 0.4, 0, 0, 0, 0.6]),
  new Spell("BOMB_DETONATOR", STATIC_PROJECTILE, [0, 0, 0.5, 1, 0.4, 0.5, 1, 0, 0, 0, 0]),
  new Spell("LASER", PROJECTILE, [0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0]),
  new Spell("MEGALASER", PROJECTILE, [0, 0, 0, 0.6, 0.6, 0.8, 0.6, 0, 0, 0, 0.3]),
  new Spell("LIGHTNING", PROJECTILE, [0, 1, 0.9, 0, 0, 0.7, 1, 0, 0, 0, 0]),
  new Spell("BALL_LIGHTNING", PROJECTILE, [0, 0.2, 0.4, 0, 1, 1, 0, 0, 0, 0, 0]),
  new Spell("LASER_EMITTER", PROJECTILE, [0, 0.2, 0.8, 1, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("LASER_EMITTER_FOUR", PROJECTILE, [0, 0.2, 0.9, 0.3, 0.5, 1, 0, 0, 0, 0, 0]),
  new Spell("LASER_EMITTER_CUTTER", PROJECTILE, [0.2, 0.3, 1, 0.5, 0.1, 0, 0, 0, 0, 0, 0]),
  new Spell("DIGGER", PROJECTILE, [0, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("POWERDIGGER", PROJECTILE, [0, 0, 0.5, 1, 0.8, 0, 0, 0, 0, 0, 0]),
  new Spell("CHAINSAW", PROJECTILE, [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("LUMINOUS_DRILL", PROJECTILE, [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0.1]),
  new Spell("LASER_LUMINOUS_DRILL", PROJECTILE, [1, 0, 1, 0, 0, 0, 0.2, 0, 0, 0, 0.1]),
  new Spell("TENTACLE", PROJECTILE, [0, 0, 0, 1, 0.5, 1, 0.8, 0, 0, 0, 0]),
  new Spell("TENTACLE_TIMER", PROJECTILE, [0, 0, 0, 0.6, 0.8, 0.6, 0.7, 0, 0, 0, 0]),
  new Spell("HEAL_BULLET", PROJECTILE, [0, 0, 1, 1, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("ANTIHEAL", PROJECTILE, [0, 0, 0.4, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0]),
  new Spell("SPIRAL_SHOT", PROJECTILE, [0, 0, 0, 0, 0.7, 0.8, 0.7, 0, 0, 0, 0]),
  new Spell("MAGIC_SHIELD", PROJECTILE, [0, 0, 0.5, 0, 0.6, 0.7, 1, 0, 0, 0, 0]),
  new Spell("BIG_MAGIC_SHIELD", PROJECTILE, [0, 0, 0.2, 0, 0.4, 0.5, 0.6, 0, 0, 0, 0.2]),
  new Spell("CHAIN_BOLT", PROJECTILE, [0.75, 0, 0, 0, 1, 0.8, 0.6, 0, 0, 0, 0]),
  new Spell("FIREBALL", PROJECTILE, [1, 0, 0, 0.7, 1, 0, 0.5, 0, 0, 0, 0]),
  new Spell("METEOR", PROJECTILE, [0, 0, 0, 0, 0.6, 0.6, 0.7, 0, 0, 0, 0.5]),
  new Spell("FLAMETHROWER", PROJECTILE, [0, 0, 0.8, 0.9, 0.9, 0, 0.6, 0, 0, 0, 0]),
  new Spell("ICEBALL", PROJECTILE, [0, 0, 0.8, 0.9, 0.9, 0, 0.6, 0, 0, 0, 0]),
  new Spell("SLIMEBALL", PROJECTILE, [1, 0, 0, 1, 0.7, 0, 0, 0, 0, 0, 0]),
  new Spell("DARKFLAME", PROJECTILE, [0, 0, 0, 1, 0, 0.9, 0.8, 0, 0, 0, 0]),
  new Spell("MISSILE", PROJECTILE, [0, 0.5, 0.5, 1, 0, 1, 0, 0, 0, 0, 0]),
  new Spell("FUNKY_SPELL", PROJECTILE, [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 0.1]),
  new Spell("PEBBLE", PROJECTILE, [0, 0.9, 1, 0, 0.9, 0, 0.6, 0, 0, 0, 0]),
  new Spell("DYNAMITE", PROJECTILE, [1, 0.9, 0.8, 0.7, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("GLITTER_BOMB", PROJECTILE, [0.8, 0.9, 0.8, 0.7, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("BUCKSHOT", PROJECTILE, [1, 1, 0.9, 0.9, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("FREEZING_GAZE", PROJECTILE, [0, 0, 0.9, 1, 1, 0, 0, 0, 0, 0, 0]),
  new Spell("GLOWING_BOLT", PROJECTILE, [0, 0, 0, 0.8, 0.9, 1, 0, 0, 0, 0, 0.1]),
  new Spell("SPORE_POD", PROJECTILE, [0, 0.7, 0.8, 0.9, 0.8, 0.6, 0, 0, 0, 0, 0]),
  new Spell("GLUE_SHOT", PROJECTILE, [0, 0, 0.7, 0.4, 0.2, 0.5, 0, 0, 0, 0, 0]),
  new Spell("BOMB_HOLY", PROJECTILE, [0, 0, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0, 0, 0.5]),
  new Spell("BOMB_HOLY_GIGA", PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("PROPANE_TANK", PROJECTILE, [0, 0, 1, 1, 0.8, 0.8, 0.7, 0, 0, 0, 0]),
  new Spell("BOMB_CART", PROJECTILE, [0, 0, 0.6, 0.6, 0.5, 0.8, 0.6, 0, 0, 0, 0]),
  new Spell("CURSED_ORB", PROJECTILE, [0, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("EXPANDING_ORB", PROJECTILE, [0, 0, 0.5, 0.5, 1, 1, 0.5, 0, 0, 0, 0]),
  new Spell("CRUMBLING_EARTH", PROJECTILE, [0, 0, 0.4, 0.3, 0.5, 0.6, 0.9, 0, 0, 0, 0]),
  new Spell("SUMMON_ROCK", PROJECTILE, [0.8, 0.8, 0.6, 0.6, 0.3, 0.7, 0.7, 0, 0, 0, 0]),
  new Spell("SUMMON_EGG", PROJECTILE, [0.7, 0.8, 0.8, 0.7, 0.6, 0.6, 0.5, 0, 0, 0, 0]),
  new Spell("SUMMON_HOLLOW_EGG", PROJECTILE, [0.6, 0.8, 0.7, 0, 0, 0.8, 0.3, 0, 0, 0, 0]),
  new Spell("TNTBOX", PROJECTILE, [0, 0.8, 0.9, 0.5, 0, 0.4, 0, 0, 0, 0, 0]),
  new Spell("TNTBOX_BIG", PROJECTILE, [0, 0, 0.8, 0, 1, 0.7, 0, 0, 0, 0, 0]),
  new Spell("SWARM_FLY", STATIC_PROJECTILE, [0, 0, 0.3, 0, 0.4, 0.5, 0, 0, 0, 0, 0]),
  new Spell("SWARM_FIREBUG", STATIC_PROJECTILE, [0, 0, 0.2, 0, 0, 0.4, 0.5, 0, 0, 0, 0]),
  new Spell("SWARM_WASP", STATIC_PROJECTILE, [0, 0, 0, 0, 0.2, 0.5, 0.6, 0, 0, 0, 0]),
  new Spell("FRIEND_FLY", STATIC_PROJECTILE, [0, 0, 0, 0, 0.2, 0.6, 0.5, 0, 0, 0, 0]),
  new Spell("ACIDSHOT", PROJECTILE, [0, 1, 1, 0.9, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("THUNDERBALL", PROJECTILE, [0, 0, 0.9, 0, 1, 0, 0.7, 0, 0, 0, 0.2]),
  new Spell("FIREBOMB", PROJECTILE, [0, 1, 0.9, 0.7, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SOILBALL", MATERIAL, [0, 0.8, 0.8, 1, 0, 0.75, 0, 0, 0, 0, 0]),
  new Spell("DEATH_CROSS", PROJECTILE, [0, 1, 0.8, 0.6, 0.5, 0.5, 0.3, 0, 0, 0, 0]),
  new Spell("DEATH_CROSS_BIG", PROJECTILE, [0, 0, 0.4, 0.5, 0.55, 0.3, 0.4, 0, 0, 0, 0.2]),
  new Spell("INFESTATION", PROJECTILE, [0, 0, 0.1, 0.3, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("WALL_HORIZONTAL", STATIC_PROJECTILE, [0.4, 0.4, 0.6, 0, 0.5, 0.2, 0, 0, 0, 0, 0]),
  new Spell("WALL_VERTICAL", STATIC_PROJECTILE, [0.4, 0.4, 0.6, 0, 0.5, 0.2, 0, 0, 0, 0, 0]),
  new Spell("WALL_SQUARE", STATIC_PROJECTILE, [0.3, 0.2, 0.6, 0, 0.5, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("TEMPORARY_WALL", UTILITY, [0.1, 0.1, 0.3, 0, 0.4, 0.2, 0, 0, 0, 0, 0]),
  new Spell("TEMPORARY_PLATFORM", UTILITY, [0.1, 0.1, 0.3, 0, 0.4, 0.2, 0, 0, 0, 0, 0]),
  new Spell("PURPLE_EXPLOSION_FIELD", STATIC_PROJECTILE, [0.7, 1, 0.7, 0, 0.5, 0.5, 0.3, 0, 0, 0, 0]),
  new Spell("DELAYED_SPELL", STATIC_PROJECTILE, [0.8, 0.8, 1, 0, 0.7, 0.5, 0.4, 0, 0, 0, 0]),
  new Spell("LONG_DISTANCE_CAST", UTILITY, [0.6, 0.7, 0.8, 0, 0.6, 0.3, 0.4, 0, 0, 0, 0]),
  new Spell("TELEPORT_CAST", UTILITY, [0, 0.6, 0.6, 0, 0.6, 0.8, 1, 0, 0, 0, 0]),
  new Spell("SUPER_TELEPORT_CAST", UTILITY, [0, 0, 0.2, 0, 0.6, 0.8, 0.8, 0, 0, 0, 0]),
  new Spell("CASTER_CAST", UTILITY, [0, 0, 0.2, 0, 0.2, 0.4, 0.4, 0, 0, 0, 0.2]),
  new Spell("MIST_RADIOACTIVE", PROJECTILE, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("MIST_ALCOHOL", PROJECTILE, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("MIST_SLIME", PROJECTILE, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("MIST_BLOOD", PROJECTILE, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("CIRCLE_FIRE", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("CIRCLE_ACID", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("CIRCLE_OIL", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("CIRCLE_WATER", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("MATERIAL_WATER", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("MATERIAL_OIL", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("MATERIAL_BLOOD", MATERIAL, [0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("MATERIAL_ACID", MATERIAL, [0, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("MATERIAL_CEMENT", MATERIAL, [0, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("TELEPORT_PROJECTILE", PROJECTILE, [0.6, 0.6, 0.6, 0, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("TELEPORT_PROJECTILE_SHORT", PROJECTILE, [0.6, 0.6, 0.6, 0, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("TELEPORT_PROJECTILE_STATIC", PROJECTILE, [0.6, 0.6, 0.6, 0, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("SWAPPER_PROJECTILE", PROJECTILE, [0.05, 0.05, 0.1, 0, 0.4, 0.4, 0.1, 0, 0, 0, 0]),
  new Spell("TELEPORT_PROJECTILE_CLOSER", PROJECTILE, [0.4, 0.6, 0.6, 0, 0.7, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("NUKE", PROJECTILE, [0, 0.3, 0, 0, 0, 1, 1, 0, 0, 0, 0.2]),
  new Spell("NUKE_GIGA", PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("FIREWORK", PROJECTILE, [0, 1, 0.8, 1, 1, 0.5, 0.3, 0, 0, 0, 0]),
  new Spell("SUMMON_WANDGHOST", UTILITY, [0, 0, 0.08, 0, 0.1, 0.3, 0.3, 0, 0, 0, 0.1]),
  new Spell("TOUCH_GOLD", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.5]),
  new Spell("TOUCH_WATER", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.4]),
  new Spell("TOUCH_OIL", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.4]),
  new Spell("TOUCH_ALCOHOL", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.4]),
  new Spell("TOUCH_PISS", MATERIAL, [0, 0, 0, 0, 0, 0.035, 0.035, 0.035, 0, 0, 0.1]),
  new Spell("TOUCH_GRASS", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.2]),
  new Spell("TOUCH_BLOOD", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.5]),
  new Spell("TOUCH_SMOKE", MATERIAL, [0, 0, 0, 0, 0, 0.1, 0.1, 0.1, 0, 0, 0.4]),
  new Spell("DESTRUCTION", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("MASS_POLYMORPH", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("BURST_2", DRAW_MANY, [0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0, 0, 0, 0]),
  new Spell("BURST_3", DRAW_MANY, [0, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0, 0, 0, 0]),
  new Spell("BURST_4", DRAW_MANY, [0, 0, 0.4, 0.5, 0.6, 0.6, 0.6, 0, 0, 0, 0]),
  new Spell("BURST_8", DRAW_MANY, [0, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0, 0.5]),
  new Spell("BURST_X", DRAW_MANY, [0, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0, 0.5]),
  new Spell("SCATTER_2", DRAW_MANY, [0.8, 0.8, 0.7, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SCATTER_3", DRAW_MANY, [0.6, 0.7, 0.7, 0.8, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SCATTER_4", DRAW_MANY, [0, 0.5, 0.6, 0.7, 0.8, 0.8, 0.6, 0, 0, 0, 0]),
  new Spell("I_SHAPE", DRAW_MANY, [0, 0.4, 0.5, 0.3, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("Y_SHAPE", DRAW_MANY, [0.8, 0.5, 0.4, 0.3, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("T_SHAPE", DRAW_MANY, [0, 0.4, 0.5, 0.4, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("W_SHAPE", DRAW_MANY, [0, 0, 0.4, 0.3, 0.5, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("CIRCLE_SHAPE", DRAW_MANY, [0, 0.1, 0.2, 0.3, 0.3, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("PENTAGRAM_SHAPE", DRAW_MANY, [0, 0.4, 0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0]),
  new Spell("I_SHOT", UTILITY, [0, 0.1, 0.2, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("Y_SHOT", UTILITY, [0, 0.1, 0.2, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("T_SHOT", UTILITY, [0, 0, 0.1, 0.2, 0, 0.5, 0, 0, 0, 0, 0]),
  new Spell("W_SHOT", UTILITY, [0, 0, 0.1, 0.2, 0, 0.5, 0.4, 0, 0, 0, 0]),
  new Spell("QUAD_SHOT", UTILITY, [0, 0.1, 0.2, 0, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("PENTA_SHOT", UTILITY, [0, 0, 0, 0.1, 0.2, 0.5, 0.5, 0, 0, 0, 0.2]),
  new Spell("HEXA_SHOT", UTILITY, [0, 0, 0, 0.1, 0.2, 0.5, 0.5, 0, 0, 0, 0.2]),
  new Spell("SPREAD_REDUCE", MODIFIER, [0, 0.8, 0.8, 0.8, 0.8, 0.7, 0.6, 0, 0, 0, 0]),
  new Spell("HEAVY_SPREAD", MODIFIER, [0.6, 0.7, 0.8, 0, 0.8, 0.8, 0.6, 0, 0, 0, 0]),
  new Spell("RECHARGE", MODIFIER, [0, 0.8, 0.9, 1, 0.8, 0.9, 1, 0, 0, 0, 0]),
  new Spell("LIFETIME", MODIFIER, [0, 0, 0, 0.5, 0.5, 0.5, 0.75, 0, 0, 0, 0.1]),
  new Spell("LIFETIME_DOWN", MODIFIER, [0, 0, 0, 0.5, 0.5, 0.75, 0.5, 0, 0, 0, 0.1]),
  new Spell("NOLLA", MODIFIER, [0, 0, 0.2, 0, 0.2, 0.5, 0.5, 0, 0, 0, 1]),
  new Spell("SLOW_BUT_STEADY", MODIFIER, [0, 0, 0, 0.1, 0.2, 0.6, 0.6, 0, 0, 0, 0.4]),
  new Spell("EXPLOSION_REMOVE", MODIFIER, [0, 0, 0.2, 0, 0.6, 0.7, 0.2, 0, 0, 0, 0]),
  new Spell("EXPLOSION_TINY", MODIFIER, [0, 0, 0.2, 0, 0.6, 0.7, 0.2, 0, 0, 0, 0]),
  new Spell("LASER_EMITTER_WIDER", MODIFIER, [0, 0, 0.3, 0.3, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("MANA_REDUCE", MODIFIER, [0, 0.7, 0.9, 1, 1, 1, 1, 0, 0, 0, 0]),
  new Spell("BLOOD_MAGIC", UTILITY, [0, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0.5]),
  new Spell("MONEY_MAGIC", UTILITY, [0, 0, 0, 0.2, 0, 0.8, 0.3, 0, 0, 0, 0.5]),
  new Spell("BLOOD_TO_POWER", UTILITY, [0, 0, 0.2, 0, 0, 0.8, 0.2, 0, 0, 0, 0.5]),
  new Spell("DUPLICATE", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("QUANTUM_SPLIT", MODIFIER, [0, 0, 0.5, 0.6, 0.5, 0.5, 1, 0, 0, 0, 0]),
  new Spell("GRAVITY", MODIFIER, [0, 0, 0.5, 0.4, 0.4, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("GRAVITY_ANTI", MODIFIER, [0, 0, 0.5, 0.4, 0.4, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("SINEWAVE", MODIFIER, [0, 0, 0.4, 0, 0.55, 0, 0.4, 0, 0, 0, 0]),
  new Spell("CHAOTIC_ARC", MODIFIER, [0, 0.4, 0, 0.55, 0, 0.4, 0, 0, 0, 0, 0]),
  new Spell("PINGPONG_PATH", MODIFIER, [0, 0.4, 0, 0.5, 0, 0.4, 0, 0, 0, 0, 0]),
  new Spell("AVOIDING_ARC", MODIFIER, [0, 0, 0.5, 0, 0.4, 0, 0.4, 0, 0, 0, 0]),
  new Spell("FLOATING_ARC", MODIFIER, [0, 0.4, 0, 0.4, 0, 0.5, 0, 0, 0, 0, 0]),
  new Spell("FLY_DOWNWARDS", MODIFIER, [0, 0.3, 0, 0.45, 0, 0.3, 0, 0, 0, 0, 0]),
  new Spell("FLY_UPWARDS", MODIFIER, [0, 0, 0.3, 0, 0.45, 0, 0.3, 0, 0, 0, 0]),
  new Spell("HORIZONTAL_ARC", MODIFIER, [0, 0.4, 0, 0.4, 0, 0.4, 0, 0, 0, 0, 0]),
  new Spell("LINE_ARC", MODIFIER, [0, 0.3, 0, 0.4, 0, 0.5, 0, 0, 0, 0, 0]),
  new Spell("ORBIT_SHOT", MODIFIER, [0, 0.2, 0.4, 0.4, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("SPIRALING_SHOT", MODIFIER, [0, 0.2, 0.3, 0.4, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("PHASING_ARC", MODIFIER, [0, 0, 0.2, 0.3, 0.6, 0.1, 0, 0, 0, 0, 0]),
  new Spell("TRUE_ORBIT", MODIFIER, [0, 0, 0.2, 0.3, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE", MODIFIER, [0, 0, 1, 1, 0.4, 0, 0.2, 0, 0, 0, 0]),
  new Spell("REMOVE_BOUNCE", MODIFIER, [0, 0, 0.2, 0.2, 1, 1, 0, 0, 0, 0, 0]),
  new Spell("HOMING", MODIFIER, [0, 0.1, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("ANTI_HOMING", MODIFIER, [0, 0.05, 0.3, 0.3, 0.1, 0.1, 0.01, 0, 0, 0, 0]),
  new Spell("HOMING_WAND", MODIFIER, [0, 1e-5, 0.08, 0, 0.08, 0.25, 0.25, 0, 0, 0, 0.2]),
  new Spell("HOMING_SHORT", MODIFIER, [0, 0.4, 0.8, 1, 0.4, 0.3, 0.1, 0, 0, 0, 0]),
  new Spell("HOMING_ROTATE", MODIFIER, [0, 0, 0.2, 0.4, 0.6, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("HOMING_SHOOTER", MODIFIER, [0, 0, 0.2, 0.3, 0.2, 0, 0.2, 0, 0, 0, 0]),
  new Spell("AUTOAIM", MODIFIER, [0, 0, 0.4, 0.4, 0.4, 0.4, 0.4, 0, 0, 0, 0]),
  new Spell("HOMING_ACCELERATING", MODIFIER, [0, 0.1, 0.3, 0.3, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("HOMING_CURSOR", MODIFIER, [0, 0, 0.7, 0.7, 0.4, 0.4, 1, 0, 0, 0, 0]),
  new Spell("HOMING_AREA", MODIFIER, [0, 0, 0.2, 0.4, 0.6, 0.7, 0.4, 0, 0, 0, 0]),
  new Spell("PIERCING_SHOT", MODIFIER, [0, 0, 0.4, 0.5, 0.6, 0.6, 0.4, 0, 0, 0, 0]),
  new Spell("CLIPPING_SHOT", MODIFIER, [0, 0, 0.2, 0.3, 0.6, 0.4, 0.6, 0, 0, 0, 0]),
  new Spell("DAMAGE", MODIFIER, [0, 0.6, 0.6, 0.8, 0.6, 0.6, 0, 0, 0, 0, 0]),
  new Spell("DAMAGE_RANDOM", MODIFIER, [0, 0, 0, 0.7, 0.6, 0.6, 0, 0, 0, 0, 0]),
  new Spell("BLOODLUST", MODIFIER, [0, 0.2, 0, 0.3, 0.6, 0.7, 0.3, 0, 0, 0, 0]),
  new Spell("DAMAGE_FOREVER", MODIFIER, [0, 0, 0.2, 0.3, 0.6, 0.5, 0.2, 0, 0, 0, 0.2]),
  new Spell("CRITICAL_HIT", MODIFIER, [0, 0.5, 0.6, 0.6, 0.7, 0.6, 0, 0, 0, 0, 0]),
  new Spell("AREA_DAMAGE", MODIFIER, [0, 0, 0.4, 0.5, 0.5, 0.5, 0.6, 0, 0, 0, 0]),
  new Spell("SPELLS_TO_POWER", MODIFIER, [0, 0, 0.3, 0.3, 0.5, 0.5, 0.5, 0, 0, 0, 0.1]),
  new Spell("ESSENCE_TO_POWER", MODIFIER, [0, 0.2, 0.5, 0.5, 0, 0, 0.5, 0, 0, 0, 0.1]),
  new Spell("ZERO_DAMAGE", MODIFIER, [0, 0, 0, 0.3, 0.3, 0.6, 0, 0, 0, 0, 0.3]),
  new Spell("HEAVY_SHOT", MODIFIER, [0, 0, 0.4, 0.4, 0.5, 0, 0, 0, 0, 0, 0]),
  new Spell("LIGHT_SHOT", MODIFIER, [0, 0, 0.3, 0.5, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("KNOCKBACK", MODIFIER, [0, 0, 0, 0.7, 0, 0.6, 0, 0, 0, 0, 0]),
  new Spell("RECOIL", MODIFIER, [0, 0, 0.6, 0, 0.7, 0, 0, 0, 0, 0, 0]),
  new Spell("RECOIL_DAMPER", MODIFIER, [0, 0, 0, 0.6, 0, 0, 0.7, 0, 0, 0, 0]),
  new Spell("SPEED", MODIFIER, [0, 1, 0.5, 0.5, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("ACCELERATING_SHOT", MODIFIER, [0, 0, 0.5, 0.4, 1, 0, 0, 0, 0, 0, 0]),
  new Spell("DECELERATING_SHOT", MODIFIER, [0, 0, 0.4, 0.1, 0.7, 0, 0, 0, 0, 0, 0]),
  new Spell("EXPLOSIVE_PROJECTILE", MODIFIER, [0, 0, 1, 1, 0.8, 0, 0, 0, 0, 0, 0]),
  new Spell("CLUSTERMOD", MODIFIER, [0, 0.5, 1, 0.6, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("WATER_TO_POISON", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("BLOOD_TO_ACID", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("LAVA_TO_BLOOD", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("LIQUID_TO_EXPLOSION", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("TOXIC_TO_ACID", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("STATIC_TO_SAND", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0.2]),
  new Spell("TRANSMUTATION", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0.3, 0.3, 0, 0, 0, 0.2]),
  new Spell("RANDOM_EXPLOSION", MODIFIER, [0, 0, 0, 0.3, 0, 0.6, 1, 0, 0, 0, 0]),
  new Spell("NECROMANCY", MODIFIER, [0, 0, 0.4, 0.6, 0.6, 0.3, 0, 0, 0, 0, 0]),
  new Spell("LIGHT", MODIFIER, [1, 0.8, 0.6, 0.4, 0.2, 0, 0, 0, 0, 0, 0]),
  new Spell("EXPLOSION", STATIC_PROJECTILE, [0.5, 0, 1, 0, 1, 0.7, 0, 0, 0, 0, 0]),
  new Spell("EXPLOSION_LIGHT", STATIC_PROJECTILE, [0, 0, 0.5, 1, 0, 0.7, 0.5, 0, 0, 0, 0]),
  new Spell("FIRE_BLAST", STATIC_PROJECTILE, [0.5, 0.7, 0, 0.6, 0, 0.4, 0, 0, 0, 0, 0]),
  new Spell("POISON_BLAST", STATIC_PROJECTILE, [0, 0.5, 0.8, 0, 0.4, 0, 0.3, 0, 0, 0, 0]),
  new Spell("ALCOHOL_BLAST", STATIC_PROJECTILE, [0, 0.5, 0.6, 0, 0.65, 0, 0.3, 0, 0, 0, 0]),
  new Spell("THUNDER_BLAST", STATIC_PROJECTILE, [0, 0.5, 0, 0.6, 0, 0.7, 0.5, 0, 0, 0, 0.1]),
  new Spell("BERSERK_FIELD", STATIC_PROJECTILE, [0, 0, 0.3, 0.6, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("POLYMORPH_FIELD", STATIC_PROJECTILE, [0.3, 0.3, 0.3, 0.8, 0.8, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("CHAOS_POLYMORPH_FIELD", STATIC_PROJECTILE, [0, 0.3, 0.3, 0.5, 0.6, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("ELECTROCUTION_FIELD", STATIC_PROJECTILE, [0, 0.3, 0, 0.6, 0, 0.8, 0.3, 0, 0, 0, 0]),
  new Spell("FREEZE_FIELD", STATIC_PROJECTILE, [0.3, 0, 0.6, 0, 0.7, 0.3, 0, 0, 0, 0, 0]),
  new Spell("REGENERATION_FIELD", STATIC_PROJECTILE, [0, 0.3, 0.3, 0.4, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("TELEPORTATION_FIELD", STATIC_PROJECTILE, [0.3, 0.6, 0.3, 0.3, 0.6, 0.3, 0, 0, 0, 0, 0]),
  new Spell("LEVITATION_FIELD", STATIC_PROJECTILE, [0, 0.3, 0.6, 0.6, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("SHIELD_FIELD", STATIC_PROJECTILE, [0, 0, 0.3, 0.3, 0.4, 0.5, 0.3, 0, 0, 0, 0]),
  new Spell("PROJECTILE_TRANSMUTATION_FIELD", STATIC_PROJECTILE, [0, 0, 0.3, 0.4, 0.4, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("PROJECTILE_THUNDER_FIELD", STATIC_PROJECTILE, [0, 0, 0, 0.3, 0.3, 0.5, 0.3, 0, 0, 0, 0]),
  new Spell("PROJECTILE_GRAVITY_FIELD", STATIC_PROJECTILE, [0, 0, 0.6, 0, 0, 0.3, 0.3, 0, 0, 0, 0]),
  new Spell("VACUUM_POWDER", STATIC_PROJECTILE, [0, 0, 0.3, 0.7, 0, 0.3, 0.4, 0, 0, 0, 0]),
  new Spell("VACUUM_LIQUID", STATIC_PROJECTILE, [0, 0, 0.3, 0, 0.7, 0.4, 0.3, 0, 0, 0, 0]),
  new Spell("VACUUM_ENTITIES", STATIC_PROJECTILE, [0, 0, 0.3, 0.7, 0, 0.3, 0.4, 0, 0, 0, 0]),
  new Spell("SEA_LAVA", MATERIAL, [0.2, 0, 0, 0, 0.2, 0.5, 0.6, 0, 0, 0, 0]),
  new Spell("SEA_ALCOHOL", MATERIAL, [0.3, 0, 0, 0, 0.5, 0.6, 0.3, 0, 0, 0, 0]),
  new Spell("SEA_OIL", MATERIAL, [0.3, 0, 0, 0, 0.5, 0.6, 0.3, 0, 0, 0, 0]),
  new Spell("SEA_WATER", MATERIAL, [0.5, 0, 0, 0, 0.4, 0.3, 0.2, 0, 0, 0, 0]),
  new Spell("SEA_SWAMP", MATERIAL, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("SEA_ACID", MATERIAL, [0.2, 0, 0, 0, 0.2, 0.4, 0.5, 0, 0, 0, 0]),
  new Spell("SEA_ACID_GAS", MATERIAL, [0.3, 0, 0, 0, 0.4, 0.4, 0.3, 0, 0, 0, 0]),
  new Spell("SEA_MIMIC", MATERIAL, [0.05, 0, 0, 0, 0.05, 0.1, 0.1, 0, 0, 0, 0.2]),
  new Spell("CLOUD_WATER", STATIC_PROJECTILE, [0.2, 0.3, 0.4, 0.4, 0.3, 0.2, 0, 0, 0, 0, 0]),
  new Spell("CLOUD_OIL", STATIC_PROJECTILE, [0.2, 0.3, 0.4, 0.4, 0.3, 0.2, 0, 0, 0, 0, 0]),
  new Spell("CLOUD_BLOOD", STATIC_PROJECTILE, [0.2, 0.3, 0.3, 0.4, 0.3, 0.2, 0, 0, 0, 0, 0]),
  new Spell("CLOUD_ACID", STATIC_PROJECTILE, [0.2, 0.2, 0.4, 0.2, 0.2, 0.5, 0, 0, 0, 0, 0]),
  new Spell("CLOUD_THUNDER", STATIC_PROJECTILE, [0.3, 0.3, 0.2, 0.3, 0.4, 0.5, 0, 0, 0, 0, 0]),
  new Spell("ELECTRIC_CHARGE", MODIFIER, [0, 1, 1, 0, 0.8, 0.7, 0, 0, 0, 0, 0]),
  new Spell("MATTER_EATER", MODIFIER, [0, 0.1, 0.9, 0, 0.1, 0.2, 0, 0, 0, 0, 0.2]),
  new Spell("FREEZE", MODIFIER, [0, 1, 0, 1, 0.9, 0.8, 0, 0, 0, 0, 0]),
  new Spell("HITFX_BURNING_CRITICAL_HIT", MODIFIER, [0, 0.2, 0, 0.4, 0.2, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_CRITICAL_WATER", MODIFIER, [0, 0.2, 0, 0.2, 0.4, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_CRITICAL_OIL", MODIFIER, [0, 0.2, 0, 0.4, 0.2, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_CRITICAL_BLOOD", MODIFIER, [0, 0.2, 0, 0.2, 0.2, 0.4, 0, 0, 0, 0, 0]),
  new Spell("HITFX_TOXIC_CHARM", MODIFIER, [0, 0.2, 0, 0.2, 0.3, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_EXPLOSION_SLIME", MODIFIER, [0, 0.2, 0, 0.3, 0.2, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_EXPLOSION_SLIME_GIGA", MODIFIER, [0, 0.1, 0, 0.1, 0.3, 0.1, 0, 0, 0, 0, 0]),
  new Spell("HITFX_EXPLOSION_ALCOHOL", MODIFIER, [0, 0.3, 0, 0.2, 0.2, 0.2, 0, 0, 0, 0, 0]),
  new Spell("HITFX_EXPLOSION_ALCOHOL_GIGA", MODIFIER, [0, 0.1, 0, 0.1, 0.1, 0.3, 0, 0, 0, 0, 0]),
  new Spell("HITFX_PETRIFY", MODIFIER, [0, 0, 0.2, 0.3, 0, 0.2, 0.3, 0, 0, 0, 0]),
  new Spell("ROCKET_DOWNWARDS", MODIFIER, [0, 0.2, 0.5, 0.7, 0.7, 0, 0, 0, 0, 0, 0]),
  new Spell("ROCKET_OCTAGON", MODIFIER, [0, 0, 0.5, 0.6, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("FIZZLE", MODIFIER, [0, 0, 0, 0.4, 0.3, 0.1, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_EXPLOSION", MODIFIER, [0, 0, 0.2, 0.6, 0.8, 0.8, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_SPARK", MODIFIER, [0, 0.2, 0.6, 0.6, 0.6, 0, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_LASER", MODIFIER, [0, 0, 0, 0.4, 0.8, 0.4, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_LASER_EMITTER", MODIFIER, [0, 0, 0, 0.4, 0.8, 0.4, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_LARPA", MODIFIER, [0, 0, 0, 0, 0.4, 0.6, 0.4, 0, 0, 0, 0]),
  new Spell("BOUNCE_SMALL_EXPLOSION", MODIFIER, [0.5, 0.3, 0.3, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_LIGHTNING", MODIFIER, [0, 0.1, 0, 0.3, 0, 0.6, 0, 0, 0, 0, 0]),
  new Spell("BOUNCE_HOLE", MODIFIER, [0, 0, 0.1, 0, 0.4, 0, 0.4, 0, 0, 0, 0.1]),
  new Spell("FIREBALL_RAY", MODIFIER, [0, 0.6, 0.6, 0, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("LIGHTNING_RAY", MODIFIER, [0, 0, 0.2, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("TENTACLE_RAY", MODIFIER, [0, 0.1, 0, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("LASER_EMITTER_RAY", MODIFIER, [0, 0, 0.1, 0.4, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("FIREBALL_RAY_LINE", MODIFIER, [0, 0, 0.6, 0.4, 0.4, 0.4, 1, 0, 0, 0, 0]),
  new Spell("FIREBALL_RAY_ENEMY", MODIFIER, [0, 0.5, 0.6, 0, 0.4, 0.3, 0, 0, 0, 0, 0]),
  new Spell("LIGHTNING_RAY_ENEMY", MODIFIER, [0, 0, 0.2, 0.4, 0.4, 0.5, 0, 0, 0, 0, 0]),
  new Spell("TENTACLE_RAY_ENEMY", MODIFIER, [0, 0, 0.1, 0.4, 0.5, 0.4, 0, 0, 0, 0, 0]),
  new Spell("GRAVITY_FIELD_ENEMY", MODIFIER, [0, 0.5, 0.6, 0, 0.4, 0.4, 0, 0, 0, 0, 0]),
  new Spell("CURSE", MODIFIER, [0, 0, 0.6, 0.7, 0, 0.4, 0, 0, 0, 0, 0.1]),
  new Spell("CURSE_WITHER_PROJECTILE", MODIFIER, [0, 0, 0, 0.2, 0.4, 0.7, 0.7, 0, 0, 0, 0.1]),
  new Spell("CURSE_WITHER_EXPLOSION", MODIFIER, [0, 0, 0.2, 0.4, 0.7, 0.7, 0, 0, 0, 0, 0.1]),
  new Spell("CURSE_WITHER_MELEE", MODIFIER, [0, 0, 0, 0.2, 0.4, 0.7, 0.7, 0, 0, 0, 0.1]),
  new Spell("CURSE_WITHER_ELECTRICITY", MODIFIER, [0, 0.2, 0, 0, 0.4, 0.7, 0.7, 0, 0, 0, 0.1]),
  new Spell("ORBIT_DISCS", MODIFIER, [0, 0.3, 0.65, 0, 0.4, 0.3, 0, 0, 0, 0, 0]),
  new Spell("ORBIT_FIREBALLS", MODIFIER, [0.2, 0.3, 0.7, 0, 0.4, 0.2, 0, 0, 0, 0, 0]),
  new Spell("ORBIT_NUKES", MODIFIER, [0, 0, 0.1, 0, 0.2, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("ORBIT_LASERS", MODIFIER, [0, 0.2, 0.7, 0, 0.4, 0.3, 0, 0, 0, 0, 0.2]),
  new Spell("ORBIT_LARPA", MODIFIER, [0, 0, 0, 0.2, 0.2, 0, 0.8, 0, 0, 0, 0.2]),
  new Spell("CHAIN_SHOT", MODIFIER, [0, 0, 0.4, 0, 0.6, 0.8, 0, 0, 0, 0, 0]),
  new Spell("ARC_ELECTRIC", MODIFIER, [0, 0, 0.4, 0.4, 0.4, 0.4, 0.8, 0, 0, 0, 0]),
  new Spell("ARC_FIRE", MODIFIER, [0, 0.4, 0.2, 0.2, 0.5, 0.2, 0, 0, 0, 0, 0]),
  new Spell("ARC_GUNPOWDER", MODIFIER, [0, 0.4, 0.4, 0.2, 0.4, 0.2, 0, 0, 0, 0, 0]),
  new Spell("ARC_POISON", MODIFIER, [0, 0.4, 0.2, 0.4, 0.2, 0.4, 0, 0, 0, 0, 0]),
  new Spell("CRUMBLING_EARTH_PROJECTILE", MODIFIER, [0, 0.2, 0.3, 0.4, 0.4, 0.3, 0, 0, 0, 0, 0]),
  new Spell("X_RAY", UTILITY, [0.8, 1, 1, 0.7, 0.5, 0.3, 0.2, 0, 0, 0, 0]),
  new Spell("UNSTABLE_GUNPOWDER", MODIFIER, [0, 0, 0.3, 0.4, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("ACID_TRAIL", MODIFIER, [0, 0.3, 0.2, 0.3, 0.3, 0.4, 0, 0, 0, 0, 0]),
  new Spell("POISON_TRAIL", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("OIL_TRAIL", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("WATER_TRAIL", MODIFIER, [0, 0.3, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("GUNPOWDER_TRAIL", MODIFIER, [0, 0, 0.3, 0.3, 0.3, 0, 0, 0, 0, 0, 0]),
  new Spell("FIRE_TRAIL", MODIFIER, [0.4, 0.5, 0.3, 0.3, 0.2, 0, 0, 0, 0, 0, 0]),
  new Spell("BURN_TRAIL", MODIFIER, [0.4, 0.3, 0.3, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("TORCH", PASSIVE, [1, 0.6, 0.5, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("TORCH_ELECTRIC", PASSIVE, [0.8, 0.6, 0.4, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("ENERGY_SHIELD", PASSIVE, [0, 0.05, 0.4, 0.8, 0.4, 0.4, 0.6, 0, 0, 0, 0]),
  new Spell("ENERGY_SHIELD_SECTOR", PASSIVE, [0.1, 0.5, 0.6, 0.8, 0.5, 0.4, 0, 0, 0, 0, 0]),
  new Spell("ENERGY_SHIELD_SHOT", MODIFIER, [0, 0, 0.3, 0.3, 0.5, 0.4, 0.3, 0, 0, 0, 0]),
  new Spell("TINY_GHOST", PASSIVE, [0, 0.1, 0.5, 1, 0.8, 0.7, 0.5, 0, 0, 0, 0]),
  new Spell("OCARINA_A", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_B", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_C", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_D", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_E", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_F", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_GSHARP", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("OCARINA_A2", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("KANTELE_A", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("KANTELE_D", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("KANTELE_DIS", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("KANTELE_E", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("KANTELE_G", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("RANDOM_SPELL", OTHER, [0, 0, 0, 0.2, 0.3, 0.2, 0.1, 0, 0, 0, 0.5]),
  new Spell("RANDOM_PROJECTILE", PROJECTILE, [0, 0, 0.2, 0, 0.4, 0.1, 0.2, 0, 0, 0, 0.5]),
  new Spell("RANDOM_MODIFIER", MODIFIER, [0, 0, 0, 0, 0.3, 0.2, 0.1, 0, 0, 0, 0.5]),
  new Spell("RANDOM_STATIC_PROJECTILE", STATIC_PROJECTILE, [0, 0, 0, 0.2, 0, 0.1, 0.2, 0, 0, 0, 0.5]),
  new Spell("DRAW_RANDOM", OTHER, [0, 0, 0.3, 0.2, 0.2, 0.1, 0.1, 0, 0, 0, 1]),
  new Spell("DRAW_RANDOM_X3", OTHER, [0, 0, 0, 0.1, 0.3, 0.1, 0.1, 0, 0, 0, 1]),
  new Spell("DRAW_3_RANDOM", OTHER, [0, 0, 0.1, 0.2, 0, 0.1, 0.1, 0, 0, 0, 1]),
  new Spell("ALL_NUKES", UTILITY, [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 1]),
  new Spell("ALL_DISCS", UTILITY, [0.1, 0, 0, 0, 0, 0, 0.05, 0, 0, 0, 1]),
  new Spell("ALL_ROCKETS", UTILITY, [0, 0.1, 0, 0, 0, 0, 0.05, 0, 0, 0, 1]),
  new Spell("ALL_DEATHCROSSES", UTILITY, [0, 0, 0.1, 0, 0, 0, 0.05, 0, 0, 0, 1]),
  new Spell("ALL_BLACKHOLES", UTILITY, [0, 0, 0, 0.1, 0, 0, 0.05, 0, 0, 0, 1]),
  new Spell("ALL_ACID", UTILITY, [0, 0, 0, 0, 0.1, 0, 0.05, 0, 0, 0, 1]),
  new Spell("ALL_SPELLS", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("SUMMON_PORTAL", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("ADD_TRIGGER", OTHER, [0, 0, 0, 0.3, 0.6, 0.6, 0, 0, 0, 0, 1]),
  new Spell("ADD_TIMER", OTHER, [0, 0, 0, 0.3, 0.6, 0.6, 0, 0, 0, 0, 1]),
  new Spell("ADD_DEATH_TRIGGER", OTHER, [0, 0, 0, 0.3, 0.6, 0.6, 0, 0, 0, 0, 1]),
  new Spell("LARPA_CHAOS", MODIFIER, [0, 0, 0.1, 0.2, 0.3, 0.4, 0, 0, 0, 0, 0.2]),
  new Spell("LARPA_DOWNWARDS", MODIFIER, [0, 0, 0.1, 0.3, 0.4, 0.2, 0, 0, 0, 0, 0.2]),
  new Spell("LARPA_UPWARDS", MODIFIER, [0, 0, 0.1, 0.1, 0.2, 0.4, 0, 0, 0, 0, 0.2]),
  new Spell("LARPA_CHAOS_2", MODIFIER, [0, 0, 0, 0.1, 0, 0.4, 0, 0, 0, 0, 0.1]),
  new Spell("LARPA_DEATH", MODIFIER, [0, 0, 0.1, 0.1, 0.3, 0.4, 0, 0, 0, 0, 0.2]),
  new Spell("ALPHA", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("GAMMA", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("TAU", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("OMEGA", OTHER, [0, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0, 1]),
  new Spell("MU", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("PHI", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("SIGMA", OTHER, [0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 0, 1]),
  new Spell("ZETA", OTHER, [0, 0, 0.2, 0, 0, 0.4, 0, 0, 0, 0, 0.5]),
  new Spell("DIVIDE_2", OTHER, [0, 0, 0, 0.2, 0, 0.3, 0.2, 0, 0, 0, 1]),
  new Spell("DIVIDE_3", OTHER, [0, 0, 0, 0, 0.1, 0.1, 0.2, 0, 0, 0, 1]),
  new Spell("DIVIDE_4", OTHER, [0, 0, 0, 0, 0, 0.1, 0.1, 0, 0, 0, 1]),
  new Spell("DIVIDE_10", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("METEOR_RAIN", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 1]),
  new Spell("WORM_RAIN", STATIC_PROJECTILE, [0, 0, 0, 0, 0, 0, 0.1, 0, 0, 0, 1]),
  new Spell("RESET", UTILITY, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_ENEMY", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_PROJECTILE", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_HP", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_HALF", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_END", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("IF_ELSE", OTHER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
  new Spell("COLOUR_RED", MODIFIER, [0, 0.2, 0.2, 0.4, 0.2, 0.2, 0.2, 0, 0, 0, 0]),
  new Spell("COLOUR_ORANGE", MODIFIER, [0, 0, 0.1, 0.1, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("COLOUR_GREEN", MODIFIER, [0, 0, 0.4, 0.1, 0.1, 0, 0, 0, 0, 0, 0]),
  new Spell("COLOUR_YELLOW", MODIFIER, [0, 0, 0.1, 0.4, 0.1, 0, 0, 0, 0, 0, 0]),
  new Spell("COLOUR_PURPLE", MODIFIER, [0, 0, 0.1, 0.1, 0.4, 0, 0, 0, 0, 0, 0]),
  new Spell("COLOUR_BLUE", MODIFIER, [0, 0, 0.4, 0.1, 0.1, 0, 0, 0, 0, 0, 0]),
  new Spell("COLOUR_RAINBOW", MODIFIER, [0, 0, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 0.2]),
  new Spell("COLOUR_INVIS", MODIFIER, [0, 0, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1]),
  new Spell("RAINBOW_TRAIL", MODIFIER, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  new Spell("CESSATION", OTHER, [0, 0, 0, 0, 0, 0.1, 0.2, 0, 0, 0, 1])
];
for (const spell of ALL_SPELLS) {
  let totalProb = 0;
  for (let i = 0; i < spell.spawn_probabilities.length; i++) {
    totalProb += spell.spawn_probabilities[i];
  }
  spell.can_spawn = spell.name === "SEA_SWAMP" || spell.name === "SUMMON_PORTAL" || totalProb > 0;
  spell.can_spawn_in_boxes = (spell.type === MODIFIER || spell.type === UTILITY) && (spell.name === "SEA_SWAMP" || spell.name === "SUMMON_PORTAL" || totalProb > 0);
}
var spellTierData = {};
for (let i = 0; i <= 10; i++) {
  spellTierData[i] = {
    spells: [],
    probs: [],
    totalProb: 0
  };
}
for (const spell of ALL_SPELLS) {
  for (let tier = 0; tier <= 10; tier++) {
    const prob = spell.spawn_probabilities[tier];
    if (prob > 0) {
      spellTierData[tier].spells.push(spell.name);
      spellTierData[tier].probs.push(prob);
      spellTierData[tier].totalProb += prob;
    }
  }
}
var T10_SPELLS = ALL_SPELLS.filter((spell) => spell.spawn_probabilities[10] > 0).map((spell) => spell.name);

// vendor/noita-telescope-main/js/unlocks.js
var unlockedSpells = new Array(ALL_SPELLS.length).fill(true);

// vendor/noita-telescope-main/js/settings.js
var appSettings = {
  enableStaticPixelScenes: "some",
  skipCosmeticScenes: true,
  enableEdgeNoise: true,
  blockEdgeSpawns: false,
  fixHolyMountainEdgeNoise: true,
  rngInfo: false,
  recolorMaterials: true,
  clearSpawnPixels: false,
  visitedCoalmineAltShrine: false,
  excludeTaikasauva: false,
  excludeEdgeCases: false,
  // Not yet implemented
  biomeOverlayMode: "cheap",
  showEnemies: false,
  enableHamisHints: false,
  gameMode: "normal",
  noMoreShuffle: false,
  greedCurse: false,
  extraItemsInHolyMountain: 0,
  accessibilityMode: false,
  simplePoiSymbols: false,
  poiScale: 1,
  scalePoisWithZoom: false,
  highlightPoiScale: 1,
  scaleHighlightedPoisWithZoom: true,
  date: null,
  spellFlags: [],
  // Special flags
  sunGem: false,
  darksunGem: false,
  sunState: false,
  darksunState: false
  // UI related options are not included here, this is mainly for settings which the web workers will need
};
function updateSettings(newSettings) {
  const spellFlags = newSettings.spellFlags ?? appSettings.spellFlags ?? [];
  Object.assign(appSettings, newSettings);
  appSettings.date = getDateAndTime();
  appSettings.spellFlags = spellFlags;
}

// vendor/noita-telescope-main/js/potion_generation.js
function checkPotionAltar(ws, ng, x, y, biome) {
  const prng2 = new NollaPrng(0);
  if (!ALTAR_SPAWN_DATA[biome]) {
    return null;
  }
  if (ALTAR_SPAWN_DATA[biome].gx !== void 0 && ALTAR_SPAWN_DATA[biome].gy !== void 0) {
    x += ALTAR_SPAWN_DATA[biome].gx;
    y += ALTAR_SPAWN_DATA[biome].gy;
  }
  let r = prng2.ProceduralRandom(ws + ng, x, y);
  let rp = ALTAR_SPAWN_DATA[biome].rp !== void 0 ? ALTAR_SPAWN_DATA[biome].rp : 0.65;
  if (r < rp) {
    return null;
  }
  return true;
}
function spawnItem(ws, ng, x, y, biome, perks = {}, gameMode = "normal") {
  let item;
  if (biome === "liquidcave") {
    item = generateItemLiquidcave(ws, ng, x, y, gameMode);
  } else {
    item = generateItem(ws, ng, x, y, perks, gameMode);
  }
  if (!item) {
    return null;
  }
  if (item["x"] === void 0) item["x"] = x;
  if (item["y"] === void 0) item["y"] = y;
  item["type"] = "item";
  return item;
}
function generateItem(ws, ng, x, y, perks = {}, gameMode = "normal") {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  let rnd = prng2.Random(1, 1e3);
  if (rnd > 995 && y >= 512 * 3) {
    return { type: "item", item: "mimic_potion", x, y };
  }
  prng2.SetRandomSeed(ws + ng, x + 425, y - 243);
  rnd = prng2.Random(1, 91);
  if (rnd <= 65) {
    return createPotion(ws, ng, x, y - 2, "normal", gameMode);
  } else if (rnd <= 70) {
    return createPowderPouch(ws, ng, x, y - 2);
  } else if (rnd <= 71) {
    let unlocked = unlockedSpells[363];
    if (unlocked) {
      if (perks["greedCurse"]) {
        return { type: "item", item: "greed_die", x, y: y - 12 };
      } else {
        return { type: "item", item: "chaos_die", x, y: y - 12 };
      }
    } else {
      return null;
    }
  } else if (rnd <= 72) {
    const options = ["runestone_light", "runestone_fire", "runestone_magma", "runestone_weight", "runestone_emptiness", "runestone_edges", "runestone_metal"];
    prng2.SetRandomSeed(ws, x + 2617.941, y - 1229.3581);
    rnd = prng2.Random(0, 6);
    let runestoneActive = prng2.Random(1, 10);
    return { type: "item", item: options[rnd], active: runestoneActive === 2, x, y: y - 10 };
  } else if (rnd <= 73) {
    return { type: "item", item: "egg_purple", x, y: y - 2 };
  } else if (rnd <= 77) {
    return { type: "item", item: "egg_slime", x, y: y - 2 };
  } else if (rnd <= 79) {
    return { type: "item", item: "egg_monster", x, y: y - 2 };
  } else if (rnd <= 83) {
    return { type: "item", item: "kiuaskivi", x, y: y - 2 };
  } else if (rnd <= 85) {
    return { type: "item", item: "ukkoskivi", x, y: y - 2 };
  } else if (rnd <= 89) {
    return { type: "item", item: "broken_wand", x, y: y - 2 };
  } else {
    if (perks["greedCurse"]) {
      return { type: "item", item: "greed_orb", x, y: y - 2 };
    } else {
      return { type: "item", item: "shiny_orb", x, y: y - 2 };
    }
  }
}
function generateItemLiquidcave(ws, ng, x, y, gameMode = "normal") {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x + 425, y - 243);
  let rnd = prng2.Random(1, 86);
  if (rnd <= 49) {
    return createPotion(ws, ng, x, y - 2, "normal", gameMode);
  } else if (rnd <= 52) {
    return { type: "item", item: "egg_purple", x, y: y - 2 };
  } else if (rnd <= 55) {
    return { type: "item", item: "egg_fire", x, y: y - 2 };
  } else if (rnd <= 58) {
    return { type: "item", item: "egg_slime", x, y: y - 2 };
  } else if (rnd <= 64) {
    return { type: "item", item: "egg_monster", x, y: y - 2 };
  } else if (rnd <= 70) {
    return { type: "item", item: "kiuaskivi", x, y: y - 2 };
  } else if (rnd <= 76) {
    return { type: "item", item: "ukkoskivi", x, y: y - 2 };
  } else if (rnd <= 82) {
    return { type: "item", item: "kuu", x, y: y - 2 };
  } else {
    return { type: "item", item: "broken_wand", x, y: y - 2 };
  }
}
function createPotion(ws, ng, x, y, type, gameMode = "normal") {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x - 4.5, y - 4);
  if (type === "normal") {
    if (gameMode === "nightmare") {
      let rnd = prng2.Random(1, 100);
      if (rnd <= 50) {
        return { type: "item", item: "potion", material: POTION_MATERIALS_MAGIC_NIGHTMARE[prng2.Random(0, POTION_MATERIALS_MAGIC_NIGHTMARE.length - 1)], x, y };
      } else {
        return { type: "item", item: "potion", material: POTION_MATERIALS_STANDARD[prng2.Random(0, POTION_MATERIALS_STANDARD.length - 1)], x, y };
      }
    } else {
      let rnd = prng2.Random(0, 100);
      let material = null;
      if (rnd <= 75) {
        if (prng2.Random(0, 1e5) <= 50) {
          material = "magic_liquid_hp_regeneration";
        } else if (prng2.Random(200, 1e5) <= 250) {
          material = "purifying_powder";
        } else if (prng2.Random(250, 1e5) <= 500) {
          material = "magic_liquid_weakness";
        } else {
          material = POTION_MATERIALS_MAGIC[prng2.Random(0, POTION_MATERIALS_MAGIC.length - 1)];
        }
      } else {
        material = POTION_MATERIALS_STANDARD[prng2.Random(0, POTION_MATERIALS_STANDARD.length - 1)];
      }
      if (appSettings.date.month === 4 && appSettings.date.day === 30 || appSettings.date.month === 5 && appSettings.date.day === 1) {
        if (prng2.Random(0, 100) <= 20) {
          if (prng2.Random(0, 5) <= 4) {
            material = "sima";
          } else {
            material = "beer";
          }
        }
      }
      if (appSettings.date.month === 6 && appSettings.date.day >= 19 && appSettings.date.day <= 25) {
        if (prng2.Random(0, 100) <= 9) {
          if (prng2.Random(0, 3) <= 2) {
            material = "juhannussima";
          } else {
            material = "beer";
          }
        }
      }
      if (appSettings.date.month === 3 && appSettings.date.day >= 29 || appSettings.date.month === 4 && appSettings.date.day <= 4) {
        if (prng2.Random(0, 100) <= 10) material = "mammi";
      }
      if (appSettings.date.month === 2 && appSettings.date.day === 14) {
        if (prng2.Random(0, 100) <= 8) material = "magic_liquid_charm";
      }
      return { type: "item", item: "potion", material, x, y };
    }
  } else if (type === "secret") {
    return { type: "item", item: "potion", material: POTION_MATERIALS_SECRET[prng2.Random(0, POTION_MATERIALS_SECRET.length - 1)], x, y };
  } else if (type === "random") {
    if (prng2.Random(0, 100) <= 50) {
      return { type: "item", item: "potion", material: POTION_LIQUIDS[prng2.Random(0, POTION_LIQUIDS.length - 1)], x, y };
    } else {
      return { type: "item", item: "potion", material: POTION_SANDS[prng2.Random(0, POTION_SANDS.length - 1)], x, y };
    }
  }
}
function createPowderPouch(ws, ng, x, y) {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x - 4.5, y - 5.5);
  let rnd = prng2.Random(0, 100);
  if (rnd <= 75) {
    const selected = prng2.Random(0, POWDER_MATERIALS_MAGIC.length - 1);
    return { type: "item", item: "pouch", material: POWDER_MATERIALS_MAGIC[selected].material, x, y };
  } else {
    const selected = prng2.Random(0, POWDER_MATERIALS_STANDARD.length - 1);
    return { type: "item", item: "pouch", material: POWDER_MATERIALS_STANDARD[selected].material, x, y };
  }
}
function spawnJar(x, y) {
  return { type: "item", item: "jar", material: "urine", x, y };
}
var POTION_DEBUG = false;
if (POTION_DEBUG) {
  console.log("--- Initial Test ---");
  let target_material = "magic_liquid_charm";
  let target_item = "potion";
  let temp_seed = 8;
  let base_x = -100;
  let base_y = 894;
  let max_search = 10;
  let matches1 = [];
  for (let i = -max_search; i < max_search; i++) {
    for (let j = -max_search; j < max_search; j++) {
      let x = base_x + i;
      let y = base_y + j;
      let item = createPotion(temp_seed, x, y, "normal", "normal");
      if (target_item == "potion" && item && item.item == "potion" || target_item == "pouch" && item.item == "pouch") {
        let material = item ? item.material : "null";
        if (material === target_material) {
          console.log(i, j, x, y, material);
          matches1.push({ i, j });
        }
      } else if (item && item.item === target_item) {
        console.log(i, j, x, y);
      }
    }
  }
  console.log("--- Dual Test ---");
  let base_x2 = -84;
  let base_y2 = 894;
  let target_material2 = "radioactive_liquid";
  let target_item2 = "potion";
  let matches2 = [];
  for (let i = -max_search; i < max_search; i++) {
    for (let j = -max_search; j < max_search; j++) {
      let x = base_x2 + i;
      let y = base_y2 + j;
      let item = createPotion(temp_seed, x, y, "normal", "normal");
      if (target_item2 == "potion" && item && item.item == "potion" || target_item2 == "pouch" && item.item == "pouch") {
        let material = item ? item.material : "null";
        if (material === target_material2) {
          console.log(i, j, x, y, material);
          matches2.push({ i, j });
        }
      } else if (item && item.item === target_item2) {
        console.log(i, j, x, y);
      }
    }
  }
  console.log("--- Matches in Both ---");
  for (let match1 of matches1) {
    for (let match2 of matches2) {
      if (match1.i === match2.i && match1.j === match2.j) {
        console.log("Match found at offset: ", match1.i, match1.j);
      }
    }
  }
}

// vendor/noita-telescope-main/js/wand_config.js
var SPRITE_RARITY = await fetchSafeJson("../data/sprite_distributions/wand_sprite_rates.json");
var GUN_NAMES = [
  "Deadly",
  "Rusty",
  "Old",
  "New",
  "Shiny",
  "Lethal",
  "Dangerous",
  "Large",
  "Enormous",
  "Tiny",
  "Small",
  "Big",
  "Pretty",
  "Terrifying",
  "Confusing",
  "Mystery",
  "Superior",
  "Inferior",
  "Destructive",
  "Chaotic",
  "Lawful",
  "Good",
  "Bad",
  "Neutral",
  "Worn",
  "Polished",
  "Waxen",
  "Strong",
  "Weak",
  "Complex",
  "Tactical",
  "Horrifying",
  "Scary",
  "Scratched",
  "Untested",
  "Prototype",
  "Type a",
  "Type b",
  "Type x",
  "Secret",
  "Special",
  "Unique",
  "Mega",
  "Super",
  "Giga",
  "Turbo",
  "Hyper",
  "Alpha",
  "Omega",
  "Extreme",
  "Vanilla",
  "Flavourful",
  "Sturdy",
  "Solid",
  "Used",
  "Unused",
  "Grey",
  "Gray",
  "Sepia",
  "Secretly",
  "Actual",
  "Genuine",
  "Powerful",
  "Double",
  "Triple",
  "Stereo",
  "Ancient",
  "Antique",
  "Rustic",
  "Artisan",
  "Slick",
  "Slim",
  "Bulky",
  "Heavy",
  "Efficient",
  "Fast",
  "Quick",
  "Rapid",
  "Slow",
  "Veteran",
  "Agile",
  "Bitcoin",
  "Online"
];
var GUN_PROBS = {
  normal: {
    deck_capacity: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 3, max: 10, mean: 6, sharpness: 2 },
        { prob: 0.1, min: 2, max: 7, mean: 4, sharpness: 4, extra: (gun) => gun["prob_unshuffle"] += 0.8 },
        { prob: 0.05, min: 1, max: 5, mean: 3, sharpness: 4, extra: (gun) => gun["prob_unshuffle"] += 0.8 },
        { prob: 0.15, min: 5, max: 11, mean: 8, sharpness: 2 },
        { prob: 0.12, min: 2, max: 20, mean: 8, sharpness: 4 },
        { prob: 0.15, min: 3, max: 12, mean: 6, sharpness: 6, extra: (gun) => gun["prob_draw_many"] += 0.8 },
        { prob: 1, min: 1, max: 20, mean: 6, sharpness: 0 }
      ]
    },
    reload_time: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 5, max: 60, mean: 30, sharpness: 2 },
        { prob: 0.5, min: 1, max: 100, mean: 40, sharpness: 2 },
        { prob: 0.02, min: 1, max: 100, mean: 20, sharpness: 0 },
        { prob: 0.35, min: 1, max: 240, mean: 40, sharpness: 0, extra: (gun) => gun["prob_unshuffle"] += 0.5 }
      ]
    },
    fire_rate_wait: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 1, max: 30, mean: 5, sharpness: 2 },
        { prob: 0.1, min: 1, max: 50, mean: 15, sharpness: 3 },
        { prob: 0.1, min: -15, max: 15, mean: 0, sharpness: 3 },
        { prob: 0.45, min: 0, max: 35, mean: 12, sharpness: 0 }
      ]
    },
    spread_degrees: {
      totalProb: 0,
      probs: [
        { prob: 1, min: -5, max: 10, mean: 0, sharpness: 3 },
        { prob: 0.1, min: -35, max: 35, mean: 0, sharpness: 0 }
      ]
    },
    speed_multiplier: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 0.8, max: 1.2, mean: 1, sharpness: 6 },
        { prob: 0.05, min: 1, max: 2, mean: 1.1, sharpness: 3 },
        { prob: 0.05, min: 0.5, max: 1, mean: 0.9, sharpness: 3 },
        { prob: 1, min: 0.8, max: 1.2, mean: 1, sharpness: 0 },
        { prob: 1e-3, min: 1, max: 10, mean: 5, sharpness: 2 }
      ]
    },
    actions_per_round: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 1, max: 3, mean: 1, sharpness: 3 },
        { prob: 0.2, min: 2, max: 4, mean: 2, sharpness: 8 },
        { prob: 0.05, min: 1, max: 5, mean: 2, sharpness: 2 },
        { prob: 1, min: 1, max: 5, mean: 2, sharpness: 0 }
      ]
    }
  },
  better: {
    deck_capacity: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 5, max: 13, mean: 8, sharpness: 2 }
      ]
    },
    reload_time: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 5, max: 40, mean: 20, sharpness: 2 }
      ]
    },
    fire_rate_wait: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 1, max: 35, mean: 5, sharpness: 2 }
      ]
    },
    spread_degrees: {
      totalProb: 0,
      probs: [
        { prob: 1, min: -1, max: 2, mean: 0, sharpness: 3 }
      ]
    },
    speed_multiplier: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 0.8, max: 1.2, mean: 1, sharpness: 6 }
      ]
    },
    actions_per_round: {
      totalProb: 0,
      probs: [
        { prob: 1, min: 1, max: 3, mean: 1, sharpness: 3 }
      ]
    }
  }
};
var WAND_TYPES = {
  "wand_level_01": {
    type: "normal",
    cost: 30,
    level: 1,
    force_unshuffle: false
  },
  "wand_level_01_better": {
    type: "better",
    cost: 30,
    level: 1,
    force_unshuffle: false
  },
  "wand_unshuffle_01": {
    type: "normal",
    cost: 25,
    level: 1,
    force_unshuffle: true
  },
  "wand_level_02": {
    type: "normal",
    cost: 40,
    level: 2,
    force_unshuffle: false
  },
  "wand_level_02_better": {
    type: "better",
    cost: 40,
    level: 2,
    force_unshuffle: false
  },
  "wand_unshuffle_02": {
    type: "normal",
    cost: 40,
    level: 2,
    force_unshuffle: true
  },
  "wand_level_03": {
    type: "normal",
    cost: 60,
    level: 3,
    force_unshuffle: false
  },
  "wand_level_03_better": {
    type: "better",
    cost: 60,
    level: 3,
    force_unshuffle: false
  },
  "wand_unshuffle_03": {
    type: "normal",
    cost: 60,
    level: 3,
    force_unshuffle: true
  },
  "wand_level_04": {
    type: "normal",
    cost: 80,
    level: 4,
    force_unshuffle: false
  },
  "wand_level_04_better": {
    type: "better",
    cost: 80,
    level: 4,
    force_unshuffle: false
  },
  "wand_unshuffle_04": {
    type: "normal",
    cost: 80,
    level: 4,
    force_unshuffle: true
  },
  "wand_level_05": {
    type: "normal",
    cost: 100,
    level: 5,
    force_unshuffle: false
  },
  "wand_level_05_better": {
    type: "better",
    cost: 100,
    level: 5,
    force_unshuffle: false
  },
  "wand_unshuffle_05": {
    type: "normal",
    cost: 100,
    level: 5,
    force_unshuffle: true
  },
  "wand_level_06": {
    type: "normal",
    cost: 120,
    level: 6,
    force_unshuffle: false
  },
  "wand_level_06_better": {
    type: "better",
    cost: 120,
    level: 6,
    force_unshuffle: false
  },
  "wand_unshuffle_06": {
    type: "normal",
    cost: 120,
    level: 6,
    force_unshuffle: true
  },
  "wand_level_10": {
    type: "normal",
    cost: 200,
    level: 11,
    force_unshuffle: false
  },
  "wand_unshuffle_10": {
    type: "normal",
    cost: 180,
    level: 11,
    force_unshuffle: true
  }
};
var PREMADE_WANDS = [
  {
    premade_index: 1,
    name: "Good Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 7,
    reload_time: 27,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 2,
    spread_degrees: 8,
    mana_max: 220,
    mana_charge_speed: 45,
    speed_multiplier: 1.03398,
    sprite: "wand_0484",
    grip: { x: 2, y: 2 },
    tip: { x: 10, y: 2 }
  },
  {
    premade_index: 2,
    name: "Good Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 5,
    reload_time: 25,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 2,
    spread_degrees: 2,
    mana_max: 250,
    mana_charge_speed: 53,
    speed_multiplier: 0.982264,
    sprite: "wand_0654",
    grip: { x: 1, y: 2 },
    tip: { x: 10, y: 2 }
  },
  {
    premade_index: 3,
    name: "Neutral Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 6,
    reload_time: 90,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 2,
    spread_degrees: -3,
    mana_max: 180,
    mana_charge_speed: 54,
    speed_multiplier: 0.994967,
    sprite: "wand_0958",
    grip: { x: 2, y: 3 },
    tip: { x: 10, y: 3 }
  },
  {
    premade_index: 4,
    name: "Antique Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 3,
    reload_time: 16,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 23,
    spread_degrees: -1,
    mana_max: 190,
    mana_charge_speed: 51,
    speed_multiplier: 0.934037,
    sprite: "wand_0516",
    grip: { x: 1, y: 5 },
    tip: { x: 8, y: 5 }
  },
  {
    premade_index: 5,
    name: "Slim Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 5,
    reload_time: 4,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 6,
    spread_degrees: 6,
    mana_max: 210,
    mana_charge_speed: 52,
    speed_multiplier: 0.824541,
    sprite: "wand_0484",
    grip: { x: 2, y: 2 },
    tip: { x: 10, y: 2 }
  },
  {
    premade_index: 6,
    name: "Superior Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 6,
    reload_time: 23,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 13,
    spread_degrees: 3,
    mana_max: 250,
    mana_charge_speed: 49,
    speed_multiplier: 0.985946,
    sprite: "wand_0058",
    grip: { x: 2, y: 3 },
    tip: { x: 10, y: 3 }
  },
  {
    premade_index: 7,
    name: "Shiny Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 3,
    reload_time: 40,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 26,
    spread_degrees: 1,
    mana_max: 170,
    mana_charge_speed: 55,
    speed_multiplier: 0.955205,
    sprite: "wand_0120",
    grip: { x: 1, y: 8 },
    tip: { x: 8, y: 8 }
  },
  {
    premade_index: 8,
    name: "Solid Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 7,
    reload_time: 26,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 10,
    spread_degrees: 2,
    mana_max: 160,
    mana_charge_speed: 52,
    speed_multiplier: 0.987743,
    sprite: "wand_0898",
    grip: { x: 2, y: 2 },
    tip: { x: 10, y: 2 }
  },
  {
    premade_index: 9,
    name: "Turbo Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 6,
    reload_time: 49,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 3,
    spread_degrees: 3,
    mana_max: 160,
    mana_charge_speed: 46,
    speed_multiplier: 0.853983,
    sprite: "wand_0724",
    grip: { x: 1, y: 1 },
    tip: { x: 10, y: 1 }
  },
  {
    premade_index: 10,
    name: "Large Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 3,
    reload_time: 26,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 3,
    spread_degrees: -1,
    mana_max: 210,
    mana_charge_speed: 46,
    speed_multiplier: 1.05598,
    sprite: "wand_0326",
    grip: { x: 1, y: 3 },
    tip: { x: 8, y: 3 }
  },
  {
    premade_index: 11,
    name: "Vanilla Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 2,
    reload_time: 26,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 20,
    spread_degrees: -2,
    mana_max: 250,
    mana_charge_speed: 50,
    speed_multiplier: 1.02408,
    sprite: "wand_0374",
    grip: { x: 1, y: 3 },
    tip: { x: 8, y: 3 }
  },
  {
    premade_index: 12,
    name: "Bad Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 6,
    reload_time: 50,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 14,
    spread_degrees: -2,
    mana_max: 250,
    mana_charge_speed: 49,
    speed_multiplier: 0.995504,
    sprite: "wand_0324",
    grip: { x: 1, y: 4 },
    tip: { x: 10, y: 4 }
  },
  {
    premade_index: 13,
    name: "Large Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 5,
    reload_time: 45,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 4,
    spread_degrees: 1,
    mana_max: 220,
    mana_charge_speed: 51,
    speed_multiplier: 0.969829,
    sprite: "wand_0309",
    grip: { x: 1, y: 3 },
    tip: { x: 9, y: 3 }
  },
  {
    premade_index: 14,
    name: "Slick Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 2,
    reload_time: 12,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 6,
    spread_degrees: 1,
    mana_max: 210,
    mana_charge_speed: 50,
    speed_multiplier: 0.988051,
    sprite: "wand_0230",
    grip: { x: 1, y: 3 },
    tip: { x: 8, y: 3 }
  },
  {
    premade_index: 15,
    name: "Bulky Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 11,
    reload_time: 53,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 24,
    spread_degrees: 1,
    mana_max: 170,
    mana_charge_speed: 49,
    speed_multiplier: 0.904531,
    sprite: "wand_0063",
    grip: { x: 1, y: 5 },
    tip: { x: 14, y: 5 }
  },
  {
    premade_index: 16,
    name: "Giga Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 9,
    reload_time: 18,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 26,
    spread_degrees: -3,
    mana_max: 750,
    mana_charge_speed: 10,
    speed_multiplier: 1.07678,
    sprite: "wand_0830",
    grip: { x: 2, y: 5 },
    tip: { x: 12, y: 5 }
  },
  {
    premade_index: 17,
    name: "Type a Rapid bolt",
    actions_per_round: 1,
    deck_capacity: 6,
    reload_time: 14,
    shuffle_deck_when_empty: 1,
    fire_rate_wait: 2,
    spread_degrees: 5,
    mana_max: 190,
    mana_charge_speed: 52,
    speed_multiplier: 0.987879,
    sprite: "wand_1000",
    grip: { x: 2, y: 2 },
    tip: { x: 10, y: 2 }
  }
];
var WAND_SHAPES = [
  [0, 2, 5, 21, 5, 4, 1, 0, 5, 1, 1],
  [1, 2, 5, 19, 5, 3, 0, 1, 6, 0, 1],
  [2, 1, 6, 21, 6, 3, 1, 1, 7, 0, 0],
  [3, 2, 4, 13, 4, 3, 2, 0, 2, 0, 1],
  [4, 3, 4, 21, 4, 3, 2, 1, 6, 0, 1],
  [5, 1, 7, 19, 7, 4, 2, 0, 5, 0, 2],
  [6, 2, 3, 14, 3, 0, 1, 1, 4, 1, 2],
  [7, 1, 6, 8, 6, 3, 0, 0, 0, 0, 2],
  [8, 1, 6, 16, 6, 3, 1, 1, 5, 0, 1],
  [9, 2, 6, 20, 6, 3, 0, 0, 6, 1, 0],
  [10, 1, 4, 9, 4, 2, 2, 1, 0, 1, 2],
  [11, 1, 3, 12, 3, 1, 0, 0, 2, 1, 1],
  [12, 1, 6, 9, 6, 3, 1, 1, 1, 1, 1],
  [13, 1, 5, 9, 5, 3, 1, 0, 1, 2, 2],
  [14, 3, 3, 17, 3, 1, 0, 0, 5, 0, 0],
  [15, 2, 3, 14, 3, 0, 0, 0, 3, 1, 0],
  [16, 3, 6, 15, 6, 4, 2, 0, 3, 1, 0],
  [17, 1, 3, 8, 3, 1, 1, 1, 1, 2, 2],
  [18, 1, 5, 7, 5, 2, 1, 0, 0, 1, 0],
  [19, 2, 7, 14, 7, 4, 1, 0, 4, 0, 0],
  [20, 0, 5, 19, 5, 2, 1, 1, 4, 1, 1],
  [21, 1, 4, 16, 4, 0, 2, 1, 3, 1, 1],
  [22, 1, 4, 11, 4, 2, 2, 1, 1, 2, 1],
  [23, 1, 6, 7, 6, 3, 1, 0, 0, 1, 0],
  [24, 1, 4, 18, 4, 3, 2, 1, 5, 1, 1],
  [25, 1, 3, 15, 3, 0, 2, 0, 3, 1, 1],
  [26, 2, 3, 14, 3, 0, 0, 0, 3, 0, 2],
  [27, 3, 4, 24, 4, 1, 1, 1, 6, 2, 0],
  [28, 1, 7, 15, 7, 4, 2, 1, 3, 2, 2],
  [29, 1, 7, 19, 7, 4, 0, 0, 6, 1, 2],
  [30, 1, 3, 7, 3, 0, 1, 0, 0, 2, 2],
  [31, 2, 5, 20, 5, 4, 2, 1, 6, 1, 0],
  [32, 1, 7, 16, 7, 4, 1, 0, 5, 2, 2],
  [33, 1, 5, 17, 5, 4, 1, 0, 5, 2, 2],
  [34, 2, 3, 19, 3, 3, 1, 0, 6, 2, 0],
  [35, 2, 5, 22, 5, 2, 2, 0, 7, 1, 0],
  [36, 1, 3, 13, 3, 0, 2, 0, 2, 1, 0],
  [37, 2, 5, 13, 5, 3, 1, 0, 3, 0, 1],
  [38, 1, 6, 16, 6, 3, 1, 1, 2, 0, 0],
  [39, 3, 2, 15, 2, 0, 1, 1, 4, 0, 2],
  [40, 3, 3, 17, 3, 0, 0, 0, 5, 1, 1],
  [41, 4, 5, 21, 5, 4, 1, 1, 5, 2, 0],
  [42, 3, 7, 16, 7, 4, 2, 1, 3, 1, 1],
  [43, 3, 4, 16, 4, 2, 2, 1, 3, 1, 0],
  [44, 2, 8, 20, 8, 4, 0, 0, 6, 0, 1],
  [45, 1, 3, 9, 3, 1, 1, 0, 1, 1, 2],
  [46, 2, 3, 15, 3, 2, 2, 1, 3, 1, 1],
  [47, 1, 7, 12, 7, 4, 0, 0, 2, 2, 2],
  [48, 2, 4, 19, 4, 2, 1, 0, 6, 0, 1],
  [49, 2, 4, 20, 4, 2, 0, 1, 6, 2, 1],
  [50, 4, 7, 26, 7, 4, 1, 0, 7, 2, 0],
  [51, 3, 4, 20, 4, 2, 0, 1, 6, 0, 2],
  [52, 2, 6, 17, 6, 3, 0, 1, 5, 1, 1],
  [53, 1, 4, 9, 4, 2, 2, 1, 0, 2, 0],
  [54, 1, 3, 13, 3, 0, 2, 0, 2, 2, 0],
  [55, 2, 5, 22, 5, 3, 0, 1, 7, 0, 1],
  [56, 3, 3, 19, 3, 1, 1, 0, 6, 2, 2],
  [57, 1, 7, 14, 7, 4, 0, 0, 3, 2, 0],
  [58, 2, 3, 10, 3, 1, 0, 0, 1, 0, 0],
  [59, 2, 2, 12, 2, 1, 0, 1, 2, 1, 2],
  [60, 1, 5, 21, 5, 4, 0, 1, 7, 1, 2],
  [61, 2, 5, 21, 5, 3, 1, 0, 7, 0, 1],
  [62, 0, 8, 16, 8, 4, 0, 0, 4, 0, 2],
  [63, 1, 5, 14, 5, 3, 0, 1, 3, 0, 1],
  [64, 3, 4, 16, 4, 2, 1, 1, 5, 0, 2],
  [65, 2, 5, 18, 5, 3, 0, 1, 5, 1, 1],
  [66, 1, 5, 17, 5, 3, 2, 1, 4, 1, 2],
  [67, 1, 5, 11, 5, 3, 1, 1, 2, 0, 0],
  [68, 1, 3, 19, 3, 0, 1, 1, 6, 2, 0],
  [69, 2, 6, 23, 6, 4, 1, 1, 6, 2, 2],
  [70, 2, 3, 10, 3, 0, 0, 0, 1, 2, 2],
  [71, 1, 5, 7, 5, 3, 1, 0, 0, 0, 0],
  [72, 1, 3, 7, 3, 1, 1, 0, 0, 2, 2],
  [73, 1, 3, 14, 3, 1, 0, 0, 3, 1, 1],
  [74, 1, 7, 9, 7, 4, 1, 0, 1, 2, 2],
  [75, 1, 4, 8, 4, 3, 0, 0, 0, 1, 1],
  [76, 1, 3, 10, 3, 2, 0, 1, 1, 2, 2],
  [77, 1, 5, 8, 5, 4, 0, 0, 0, 2, 0],
  [78, 2, 4, 26, 4, 2, 1, 1, 7, 0, 2],
  [79, 1, 5, 24, 5, 4, 1, 1, 6, 2, 2],
  [80, 3, 4, 18, 4, 0, 2, 1, 4, 2, 2],
  [81, 1, 3, 14, 3, 1, 0, 1, 3, 2, 1],
  [82, 3, 5, 18, 5, 3, 2, 0, 5, 1, 2],
  [83, 1, 4, 23, 4, 1, 2, 1, 7, 1, 2],
  [84, 4, 3, 20, 3, 1, 0, 0, 6, 0, 0],
  [85, 3, 4, 16, 4, 2, 0, 1, 4, 0, 1],
  [86, 2, 5, 12, 5, 3, 0, 0, 2, 1, 0],
  [87, 2, 5, 12, 5, 3, 0, 0, 2, 2, 2],
  [88, 2, 4, 18, 4, 1, 1, 1, 3, 0, 2],
  [89, 4, 3, 21, 3, 0, 2, 1, 6, 0, 2],
  [90, 4, 7, 22, 7, 4, 0, 0, 7, 2, 2],
  [91, 1, 6, 14, 6, 4, 0, 1, 3, 1, 1],
  [92, 1, 3, 15, 3, 1, 2, 1, 3, 0, 1],
  [93, 1, 3, 11, 3, 0, 2, 0, 1, 1, 1],
  [94, 1, 4, 19, 4, 1, 1, 1, 4, 2, 2],
  [95, 1, 3, 7, 3, 0, 1, 0, 0, 2, 1],
  [96, 1, 7, 11, 7, 4, 1, 1, 2, 1, 0],
  [97, 3, 4, 19, 4, 2, 1, 1, 6, 0, 2],
  [98, 1, 5, 14, 5, 3, 0, 0, 3, 0, 2],
  [99, 2, 4, 13, 4, 2, 2, 1, 2, 2, 1],
  [100, 0, 3, 19, 3, 1, 0, 1, 6, 2, 0],
  [101, 1, 5, 14, 5, 4, 0, 0, 3, 2, 0],
  [102, 1, 7, 9, 7, 4, 1, 0, 1, 0, 0],
  [103, 4, 4, 22, 4, 1, 2, 0, 6, 2, 1],
  [104, 2, 5, 17, 5, 3, 0, 1, 5, 0, 0],
  [105, 1, 4, 8, 4, 2, 0, 1, 0, 2, 1],
  [106, 1, 5, 7, 5, 2, 1, 0, 0, 2, 0],
  [107, 1, 7, 19, 7, 4, 2, 1, 5, 1, 2],
  [108, 2, 3, 11, 3, 0, 2, 0, 1, 0, 1],
  [109, 1, 3, 10, 3, 2, 2, 0, 1, 0, 2],
  [110, 2, 2, 11, 2, 1, 1, 1, 2, 2, 2],
  [111, 3, 5, 18, 5, 2, 1, 0, 3, 2, 2],
  [112, 3, 5, 16, 5, 3, 0, 1, 4, 0, 2],
  [113, 1, 6, 9, 6, 3, 2, 1, 0, 1, 0],
  [114, 1, 3, 9, 3, 0, 1, 0, 1, 0, 2],
  [115, 0, 5, 17, 5, 3, 2, 1, 4, 0, 2],
  [116, 0, 3, 14, 3, 0, 1, 0, 4, 1, 1],
  [117, 1, 3, 9, 3, 1, 0, 0, 1, 2, 1],
  [118, 2, 4, 12, 4, 0, 0, 1, 2, 1, 1],
  [119, 1, 4, 13, 4, 0, 2, 0, 2, 2, 2],
  [120, 1, 8, 8, 8, 4, 0, 0, 0, 0, 1],
  [121, 1, 5, 19, 5, 2, 2, 0, 5, 0, 0],
  [122, 3, 7, 21, 7, 4, 1, 0, 5, 2, 0],
  [123, 1, 4, 14, 4, 3, 0, 1, 3, 2, 2],
  [124, 1, 4, 14, 4, 0, 2, 1, 2, 2, 1],
  [125, 0, 3, 14, 3, 0, 1, 1, 4, 1, 1],
  [126, 3, 4, 24, 4, 1, 1, 0, 6, 0, 2],
  [127, 3, 5, 17, 5, 2, 0, 0, 5, 1, 2],
  [128, 2, 7, 17, 7, 4, 0, 1, 5, 0, 2],
  [129, 3, 5, 19, 5, 4, 1, 0, 6, 2, 0],
  [130, 0, 4, 17, 4, 1, 2, 1, 4, 2, 2],
  [131, 2, 3, 10, 3, 3, 0, 1, 1, 0, 2],
  [132, 3, 4, 15, 4, 2, 1, 0, 4, 1, 2],
  [133, 2, 4, 25, 4, 1, 1, 0, 7, 0, 2],
  [134, 3, 4, 15, 4, 2, 2, 1, 3, 0, 0],
  [135, 2, 7, 19, 7, 4, 1, 0, 6, 0, 2],
  [136, 2, 5, 22, 5, 1, 0, 1, 7, 0, 2],
  [137, 2, 4, 16, 4, 1, 1, 1, 2, 0, 1],
  [138, 2, 5, 10, 5, 3, 2, 0, 1, 0, 2],
  [139, 0, 3, 15, 3, 0, 0, 0, 4, 1, 2],
  [140, 1, 3, 21, 3, 0, 2, 0, 6, 0, 1],
  [141, 2, 2, 11, 2, 0, 1, 1, 2, 1, 0],
  [142, 1, 3, 7, 3, 1, 1, 0, 0, 2, 1],
  [143, 4, 6, 20, 6, 4, 0, 0, 6, 0, 2],
  [144, 3, 4, 16, 4, 0, 2, 1, 3, 0, 1],
  [145, 1, 4, 25, 4, 0, 1, 0, 7, 2, 2],
  [146, 2, 6, 23, 6, 4, 1, 1, 6, 0, 2],
  [147, 1, 8, 19, 8, 4, 1, 0, 4, 2, 0],
  [148, 2, 3, 13, 3, 0, 1, 1, 3, 0, 1],
  [149, 1, 5, 16, 5, 3, 0, 1, 4, 0, 1],
  [150, 1, 5, 9, 5, 2, 2, 1, 0, 0, 0],
  [151, 1, 7, 19, 7, 4, 1, 0, 6, 0, 1],
  [152, 3, 4, 23, 4, 0, 1, 1, 6, 0, 2],
  [153, 3, 3, 15, 3, 1, 2, 0, 3, 1, 1],
  [154, 1, 3, 8, 3, 1, 0, 0, 0, 1, 2],
  [155, 2, 4, 22, 4, 3, 0, 0, 7, 1, 2],
  [156, 3, 3, 16, 3, 0, 1, 1, 5, 0, 1],
  [157, 1, 3, 22, 3, 1, 0, 1, 7, 1, 1],
  [158, 1, 7, 18, 7, 4, 1, 0, 3, 1, 2],
  [159, 2, 4, 15, 4, 2, 2, 1, 3, 2, 0],
  [160, 2, 2, 15, 2, 1, 1, 1, 4, 1, 0],
  [161, 3, 4, 18, 4, 1, 1, 0, 3, 0, 2],
  [162, 1, 6, 11, 6, 4, 1, 0, 2, 1, 1],
  [163, 1, 5, 19, 5, 3, 1, 1, 4, 0, 1],
  [164, 2, 8, 18, 8, 4, 1, 0, 3, 0, 0],
  [165, 1, 3, 14, 3, 0, 1, 1, 4, 1, 2],
  [166, 2, 3, 12, 3, 3, 0, 0, 2, 1, 0],
  [167, 2, 4, 14, 4, 2, 2, 1, 2, 2, 0],
  [168, 1, 4, 16, 4, 3, 0, 1, 4, 0, 0],
  [169, 3, 5, 19, 5, 3, 2, 0, 5, 2, 2],
  [170, 1, 3, 11, 3, 1, 2, 0, 1, 2, 1],
  [171, 3, 3, 15, 3, 1, 1, 1, 4, 1, 2],
  [172, 2, 2, 18, 2, 0, 0, 1, 5, 1, 2],
  [173, 1, 3, 22, 3, 1, 0, 0, 7, 2, 1],
  [174, 2, 6, 12, 6, 4, 0, 0, 2, 0, 1],
  [175, 1, 3, 8, 3, 0, 0, 0, 0, 1, 2],
  [176, 4, 4, 24, 4, 2, 1, 0, 6, 1, 2],
  [177, 5, 5, 25, 5, 1, 1, 1, 7, 2, 1],
  [178, 2, 3, 14, 3, 1, 0, 0, 3, 1, 0],
  [179, 2, 6, 26, 6, 4, 1, 1, 7, 2, 0],
  [180, 1, 3, 7, 3, 0, 1, 0, 0, 2, 1],
  [181, 4, 3, 20, 3, 1, 0, 1, 6, 1, 2],
  [182, 1, 6, 18, 6, 3, 0, 1, 5, 2, 0],
  [183, 1, 4, 21, 4, 0, 1, 1, 5, 1, 2],
  [184, 3, 7, 18, 7, 4, 1, 1, 3, 0, 2],
  [185, 2, 4, 14, 4, 3, 2, 0, 2, 1, 0],
  [186, 1, 3, 15, 3, 1, 0, 0, 4, 2, 0],
  [187, 1, 6, 12, 6, 4, 0, 0, 2, 2, 2],
  [188, 3, 4, 16, 4, 0, 2, 0, 3, 0, 2],
  [189, 2, 4, 13, 4, 3, 2, 1, 2, 2, 1],
  [190, 1, 4, 7, 4, 2, 1, 0, 0, 2, 1],
  [191, 1, 6, 14, 6, 4, 2, 0, 2, 0, 2],
  [192, 1, 3, 7, 3, 1, 1, 0, 0, 2, 1],
  [193, 2, 6, 11, 6, 4, 2, 1, 1, 2, 0],
  [194, 1, 3, 9, 3, 1, 2, 0, 0, 1, 0],
  [195, 1, 3, 7, 3, 2, 1, 0, 0, 2, 2],
  [196, 2, 7, 16, 7, 4, 2, 1, 3, 1, 0],
  [197, 2, 7, 13, 7, 4, 1, 0, 3, 0, 1],
  [198, 1, 6, 13, 6, 3, 2, 1, 2, 2, 0],
  [199, 1, 7, 9, 7, 4, 2, 1, 0, 0, 2],
  [200, 1, 3, 9, 3, 0, 1, 0, 1, 2, 0],
  [201, 1, 2, 8, 2, 1, 0, 1, 0, 1, 2],
  [202, 3, 3, 21, 3, 3, 2, 1, 6, 2, 1],
  [203, 3, 6, 21, 6, 4, 0, 1, 7, 2, 2],
  [204, 1, 6, 7, 6, 3, 1, 0, 0, 1, 0],
  [205, 3, 4, 16, 4, 2, 2, 0, 3, 2, 0],
  [206, 1, 3, 9, 3, 0, 2, 0, 0, 0, 1],
  [207, 0, 4, 25, 4, 2, 1, 0, 7, 2, 2],
  [208, 1, 4, 20, 4, 2, 1, 1, 7, 1, 0],
  [209, 2, 6, 17, 6, 4, 0, 0, 5, 2, 1],
  [210, 2, 3, 12, 3, 0, 0, 1, 2, 2, 0],
  [211, 1, 8, 11, 8, 4, 2, 0, 1, 2, 0],
  [212, 1, 5, 20, 5, 3, 0, 1, 6, 1, 0],
  [213, 1, 4, 26, 4, 1, 1, 1, 7, 0, 0],
  [214, 1, 3, 14, 3, 0, 0, 0, 3, 1, 1],
  [215, 1, 7, 9, 7, 4, 2, 1, 0, 2, 0],
  [216, 2, 3, 17, 3, 0, 0, 1, 5, 2, 0],
  [217, 2, 3, 13, 3, 3, 2, 1, 2, 0, 0],
  [218, 2, 3, 20, 3, 0, 0, 0, 6, 0, 0],
  [219, 2, 3, 13, 3, 0, 1, 0, 3, 2, 1],
  [220, 1, 3, 17, 3, 0, 2, 0, 4, 1, 2],
  [221, 3, 8, 26, 8, 4, 1, 0, 7, 0, 1],
  [222, 3, 7, 20, 7, 4, 0, 0, 6, 2, 2],
  [223, 1, 6, 7, 6, 4, 1, 0, 0, 2, 1],
  [224, 1, 5, 11, 5, 3, 2, 1, 1, 0, 1],
  [225, 1, 5, 7, 5, 3, 1, 1, 0, 0, 1],
  [226, 1, 5, 16, 5, 2, 1, 0, 5, 0, 0],
  [227, 1, 5, 16, 5, 4, 0, 0, 4, 2, 1],
  [228, 2, 6, 16, 6, 3, 1, 0, 5, 1, 2],
  [229, 2, 8, 11, 8, 4, 2, 0, 1, 1, 1],
  [230, 1, 3, 8, 3, 1, 0, 0, 0, 0, 0],
  [231, 1, 3, 10, 3, 0, 0, 0, 1, 2, 1],
  [232, 1, 3, 22, 3, 1, 0, 0, 7, 1, 2],
  [233, 1, 5, 19, 5, 3, 2, 1, 5, 0, 0],
  [234, 1, 8, 11, 8, 4, 1, 1, 2, 0, 1],
  [235, 3, 4, 23, 4, 0, 2, 1, 7, 1, 0],
  [236, 2, 3, 17, 3, 0, 0, 0, 5, 0, 0],
  [237, 0, 7, 19, 7, 4, 0, 0, 6, 1, 2],
  [238, 1, 8, 9, 8, 4, 0, 1, 1, 1, 2],
  [239, 1, 8, 9, 8, 4, 1, 1, 1, 0, 2],
  [240, 0, 4, 15, 4, 2, 0, 0, 4, 2, 0],
  [241, 3, 3, 16, 3, 2, 1, 1, 5, 1, 1],
  [242, 0, 8, 19, 8, 4, 1, 0, 4, 2, 1],
  [243, 1, 3, 14, 3, 0, 0, 1, 3, 2, 1],
  [244, 3, 4, 18, 4, 3, 1, 0, 3, 2, 0],
  [245, 3, 5, 22, 5, 2, 0, 0, 7, 2, 1],
  [246, 1, 5, 16, 5, 2, 1, 1, 2, 0, 1],
  [247, 0, 4, 15, 4, 2, 0, 0, 4, 1, 1],
  [248, 2, 5, 17, 5, 3, 0, 0, 5, 0, 0],
  [249, 2, 4, 11, 4, 2, 2, 1, 1, 1, 0],
  [250, 1, 4, 9, 4, 3, 2, 1, 0, 1, 1],
  [251, 2, 3, 13, 3, 1, 1, 1, 3, 1, 0],
  [252, 1, 5, 11, 5, 3, 2, 1, 1, 0, 0],
  [253, 1, 4, 16, 4, 0, 2, 1, 3, 2, 0],
  [254, 3, 5, 19, 5, 3, 1, 1, 6, 1, 0],
  [255, 2, 8, 23, 8, 4, 2, 1, 7, 2, 0],
  [256, 2, 4, 21, 4, 2, 1, 0, 5, 0, 0],
  [257, 2, 5, 14, 5, 3, 0, 0, 3, 1, 0],
  [258, 4, 5, 21, 5, 3, 2, 1, 6, 2, 1],
  [259, 1, 5, 9, 5, 3, 0, 0, 1, 2, 2],
  [260, 4, 4, 23, 4, 1, 2, 0, 7, 2, 2],
  [261, 2, 6, 12, 6, 4, 0, 1, 2, 2, 1],
  [262, 2, 5, 14, 5, 4, 0, 1, 3, 2, 2],
  [263, 2, 7, 17, 7, 4, 0, 1, 5, 0, 0],
  [264, 2, 4, 16, 4, 2, 0, 1, 4, 1, 2],
  [265, 2, 3, 20, 3, 0, 0, 0, 6, 1, 2],
  [266, 1, 3, 9, 3, 1, 2, 0, 0, 2, 2],
  [267, 3, 5, 22, 5, 3, 1, 1, 5, 2, 2],
  [268, 1, 3, 15, 3, 2, 0, 1, 4, 2, 0],
  [269, 3, 3, 15, 3, 1, 1, 1, 4, 0, 1],
  [270, 4, 3, 20, 3, 1, 0, 0, 6, 0, 2],
  [271, 2, 5, 17, 5, 4, 1, 0, 5, 0, 2],
  [272, 2, 8, 16, 8, 4, 1, 1, 2, 1, 1],
  [273, 2, 4, 18, 4, 1, 1, 1, 3, 2, 1],
  [274, 1, 3, 7, 3, 1, 1, 0, 0, 2, 0],
  [275, 3, 3, 21, 3, 0, 2, 0, 6, 0, 0],
  [276, 2, 3, 14, 3, 1, 1, 1, 4, 1, 0],
  [277, 1, 4, 8, 4, 2, 1, 1, 1, 0, 0],
  [278, 1, 3, 18, 3, 1, 2, 0, 5, 0, 2],
  [279, 2, 5, 12, 5, 3, 0, 1, 2, 2, 2],
  [280, 4, 4, 22, 4, 1, 2, 1, 6, 1, 2],
  [281, 2, 3, 17, 3, 1, 0, 0, 5, 0, 2],
  [282, 0, 6, 19, 6, 3, 0, 1, 6, 0, 0],
  [283, 1, 4, 9, 4, 2, 2, 0, 0, 2, 0],
  [284, 2, 4, 14, 4, 1, 2, 1, 2, 0, 0],
  [285, 3, 4, 23, 4, 1, 2, 1, 7, 0, 0],
  [286, 2, 5, 21, 5, 1, 1, 1, 7, 2, 2],
  [287, 3, 4, 24, 4, 2, 1, 1, 6, 2, 2],
  [288, 1, 5, 14, 5, 3, 0, 0, 3, 2, 1],
  [289, 3, 5, 21, 5, 3, 1, 1, 5, 1, 0],
  [290, 1, 3, 19, 3, 0, 2, 1, 5, 2, 2],
  [291, 3, 6, 24, 6, 3, 1, 1, 6, 2, 1],
  [292, 1, 5, 9, 5, 3, 0, 1, 1, 1, 1],
  [293, 1, 4, 20, 4, 1, 2, 1, 5, 2, 0],
  [294, 1, 6, 22, 6, 3, 0, 0, 7, 2, 1],
  [295, 1, 6, 9, 6, 4, 2, 0, 0, 0, 2],
  [296, 1, 7, 10, 7, 4, 0, 0, 1, 2, 0],
  [297, 1, 3, 13, 3, 1, 2, 1, 2, 0, 2],
  [298, 1, 3, 13, 3, 0, 2, 0, 2, 1, 2],
  [299, 1, 3, 14, 3, 0, 0, 0, 3, 2, 0],
  [300, 1, 5, 7, 5, 2, 1, 0, 0, 1, 1],
  [301, 2, 4, 14, 4, 2, 0, 1, 3, 1, 0],
  [302, 2, 5, 10, 5, 3, 0, 0, 1, 2, 1],
  [303, 2, 3, 13, 3, 1, 1, 1, 3, 1, 1],
  [304, 3, 5, 21, 5, 0, 0, 1, 7, 0, 0],
  [305, 2, 3, 10, 3, 2, 2, 1, 1, 2, 2],
  [306, 1, 4, 19, 4, 2, 1, 0, 4, 0, 1],
  [307, 1, 8, 15, 8, 4, 2, 1, 3, 0, 0],
  [308, 1, 3, 9, 3, 3, 2, 0, 0, 2, 0],
  [309, 1, 3, 9, 3, 0, 0, 0, 1, 0, 0],
  [310, 1, 5, 15, 5, 3, 0, 0, 4, 1, 0],
  [311, 2, 7, 16, 7, 4, 2, 0, 3, 0, 2],
  [312, 0, 4, 17, 4, 3, 2, 0, 4, 2, 2],
  [313, 3, 4, 22, 4, 1, 2, 1, 7, 2, 1],
  [314, 2, 3, 16, 3, 1, 1, 1, 5, 2, 0],
  [315, 2, 6, 12, 6, 3, 0, 0, 2, 0, 1],
  [316, 1, 5, 9, 5, 3, 2, 1, 0, 2, 1],
  [317, 2, 3, 16, 3, 0, 1, 1, 5, 2, 0],
  [318, 2, 4, 18, 4, 0, 1, 0, 3, 0, 0],
  [319, 3, 4, 22, 4, 1, 2, 1, 6, 0, 1],
  [320, 1, 5, 9, 5, 3, 2, 1, 0, 0, 0],
  [321, 1, 6, 9, 6, 4, 2, 1, 0, 1, 2],
  [322, 1, 6, 18, 6, 4, 1, 0, 3, 2, 0],
  [323, 2, 3, 13, 3, 1, 1, 1, 3, 1, 2],
  [324, 1, 4, 10, 4, 2, 0, 0, 1, 1, 1],
  [325, 4, 4, 22, 4, 1, 2, 0, 6, 1, 0],
  [326, 1, 3, 8, 3, 0, 0, 0, 0, 0, 1],
  [327, 1, 4, 23, 4, 1, 2, 1, 7, 2, 0],
  [328, 1, 3, 8, 3, 0, 0, 0, 0, 0, 2],
  [329, 1, 3, 17, 3, 0, 0, 1, 5, 0, 0],
  [330, 1, 4, 9, 4, 2, 1, 1, 1, 0, 1],
  [331, 1, 4, 14, 4, 2, 0, 1, 3, 2, 2],
  [332, 2, 4, 19, 4, 0, 1, 0, 4, 0, 1],
  [333, 1, 7, 19, 7, 4, 2, 1, 5, 1, 0],
  [334, 1, 5, 9, 5, 3, 1, 1, 1, 1, 0],
  [335, 2, 3, 14, 3, 3, 0, 1, 3, 1, 1],
  [336, 1, 3, 9, 3, 1, 2, 1, 0, 1, 1],
  [337, 1, 4, 9, 4, 3, 0, 0, 1, 2, 1],
  [338, 2, 3, 23, 3, 1, 2, 0, 7, 1, 1],
  [339, 1, 2, 7, 2, 0, 1, 1, 0, 0, 0],
  [340, 2, 3, 15, 3, 2, 0, 1, 4, 0, 2],
  [341, 0, 7, 19, 7, 4, 0, 0, 6, 2, 2],
  [342, 2, 3, 12, 3, 1, 0, 1, 2, 2, 0],
  [343, 1, 4, 22, 4, 1, 0, 1, 7, 1, 0],
  [344, 1, 3, 16, 3, 0, 1, 1, 5, 1, 1],
  [345, 0, 7, 18, 7, 4, 1, 1, 6, 0, 0],
  [346, 1, 3, 11, 3, 2, 2, 1, 1, 1, 0],
  [347, 3, 5, 16, 5, 4, 1, 1, 2, 0, 1],
  [348, 2, 6, 10, 6, 4, 0, 1, 1, 1, 1],
  [349, 1, 7, 18, 7, 4, 1, 0, 3, 1, 0],
  [350, 3, 6, 21, 6, 3, 1, 0, 5, 2, 2],
  [351, 0, 5, 19, 5, 3, 1, 0, 4, 2, 2],
  [352, 3, 4, 24, 4, 0, 2, 1, 7, 0, 1],
  [353, 1, 3, 11, 3, 1, 2, 1, 1, 2, 1],
  [354, 1, 3, 9, 3, 0, 2, 1, 0, 1, 2],
  [355, 2, 4, 16, 4, 0, 2, 1, 3, 1, 0],
  [356, 4, 4, 24, 4, 1, 2, 1, 7, 1, 2],
  [357, 0, 8, 17, 8, 4, 2, 1, 4, 1, 2],
  [358, 3, 3, 18, 3, 1, 0, 0, 5, 0, 0],
  [359, 1, 4, 20, 4, 0, 1, 0, 7, 1, 0],
  [360, 1, 7, 17, 7, 4, 1, 1, 5, 1, 1],
  [361, 1, 7, 9, 7, 4, 1, 0, 1, 2, 0],
  [362, 4, 4, 22, 4, 3, 2, 0, 6, 0, 1],
  [363, 2, 5, 11, 5, 2, 1, 0, 2, 0, 0],
  [364, 2, 3, 11, 3, 0, 1, 0, 2, 1, 0],
  [365, 1, 6, 9, 6, 3, 2, 0, 0, 0, 2],
  [366, 1, 3, 8, 3, 3, 0, 1, 0, 1, 1],
  [367, 0, 3, 15, 3, 2, 0, 1, 4, 2, 0],
  [368, 2, 7, 18, 7, 4, 0, 0, 5, 1, 1],
  [369, 1, 4, 9, 4, 2, 1, 0, 1, 2, 2],
  [370, 2, 3, 17, 3, 0, 0, 1, 5, 1, 2],
  [371, 1, 3, 8, 3, 2, 0, 1, 0, 0, 1],
  [372, 1, 4, 21, 4, 2, 1, 1, 5, 2, 2],
  [373, 1, 7, 16, 7, 4, 1, 0, 5, 1, 1],
  [374, 1, 3, 8, 3, 2, 0, 0, 0, 1, 0],
  [375, 1, 3, 9, 3, 0, 2, 1, 0, 2, 1],
  [376, 1, 3, 20, 3, 1, 0, 0, 6, 2, 0],
  [377, 0, 8, 21, 8, 4, 2, 1, 6, 1, 1],
  [378, 1, 5, 23, 5, 3, 2, 1, 7, 2, 1],
  [379, 2, 3, 22, 3, 1, 0, 1, 7, 0, 2],
  [380, 1, 3, 11, 3, 0, 2, 1, 1, 1, 0],
  [381, 3, 4, 24, 4, 2, 2, 1, 7, 2, 0],
  [382, 4, 4, 20, 4, 0, 1, 1, 4, 0, 1],
  [383, 2, 3, 18, 3, 1, 0, 0, 5, 2, 1],
  [384, 2, 5, 16, 5, 3, 0, 0, 4, 0, 0],
  [385, 2, 3, 11, 3, 1, 2, 0, 1, 0, 1],
  [386, 1, 6, 22, 6, 3, 0, 0, 7, 2, 2],
  [387, 2, 4, 10, 4, 3, 2, 1, 1, 2, 0],
  [388, 2, 4, 21, 4, 2, 0, 1, 7, 2, 2],
  [389, 3, 2, 21, 2, 1, 1, 1, 7, 2, 2],
  [390, 2, 7, 16, 7, 4, 2, 0, 3, 2, 0],
  [391, 1, 3, 7, 3, 0, 1, 0, 0, 1, 1],
  [392, 0, 5, 19, 5, 4, 0, 1, 6, 1, 2],
  [393, 3, 3, 19, 3, 0, 1, 1, 6, 1, 2],
  [394, 2, 5, 11, 5, 3, 2, 0, 1, 1, 1],
  [395, 1, 8, 8, 8, 4, 1, 1, 1, 2, 1],
  [396, 1, 8, 9, 8, 4, 1, 0, 1, 0, 0],
  [397, 4, 7, 24, 7, 4, 1, 1, 6, 0, 1],
  [398, 2, 6, 20, 6, 3, 1, 0, 4, 2, 0],
  [399, 1, 3, 16, 3, 2, 1, 0, 5, 0, 0],
  [400, 1, 4, 14, 4, 0, 2, 0, 2, 2, 2],
  [401, 2, 5, 14, 5, 2, 0, 0, 3, 1, 1],
  [402, 3, 4, 19, 4, 1, 1, 1, 4, 2, 0],
  [403, 0, 7, 15, 7, 4, 0, 0, 4, 2, 1],
  [404, 1, 3, 7, 3, 1, 1, 0, 0, 2, 0],
  [405, 1, 3, 11, 3, 0, 2, 1, 1, 1, 0],
  [406, 2, 4, 22, 4, 3, 0, 0, 7, 1, 0],
  [407, 3, 3, 16, 3, 0, 0, 0, 4, 1, 1],
  [408, 3, 5, 20, 5, 3, 1, 0, 4, 1, 0],
  [409, 2, 5, 10, 5, 2, 0, 1, 1, 1, 2],
  [410, 2, 8, 15, 8, 4, 2, 0, 3, 2, 2],
  [411, 2, 8, 13, 8, 4, 1, 0, 3, 1, 2],
  [412, 2, 4, 15, 4, 3, 1, 0, 4, 1, 0],
  [413, 1, 3, 20, 3, 1, 0, 1, 6, 0, 1],
  [414, 2, 8, 23, 8, 4, 2, 1, 7, 0, 0],
  [415, 4, 4, 22, 4, 2, 2, 0, 7, 2, 0],
  [416, 2, 3, 13, 3, 0, 2, 1, 2, 1, 0],
  [417, 1, 2, 9, 2, 0, 1, 1, 1, 1, 0],
  [418, 0, 6, 20, 6, 4, 2, 1, 6, 1, 1],
  [419, 4, 7, 22, 7, 4, 0, 1, 7, 2, 2],
  [420, 1, 3, 18, 3, 0, 0, 0, 5, 2, 0],
  [421, 1, 4, 14, 4, 3, 0, 0, 3, 0, 2],
  [422, 3, 3, 16, 3, 2, 0, 0, 4, 0, 0],
  [423, 0, 3, 14, 3, 2, 1, 1, 4, 2, 2],
  [424, 2, 4, 14, 4, 3, 0, 0, 3, 2, 2],
  [425, 2, 8, 18, 8, 4, 2, 1, 5, 0, 0],
  [426, 2, 3, 14, 3, 1, 0, 1, 3, 0, 2],
  [427, 1, 3, 13, 3, 0, 2, 1, 2, 1, 0],
  [428, 1, 4, 18, 4, 2, 1, 1, 3, 1, 1],
  [429, 2, 4, 18, 4, 2, 2, 0, 5, 0, 0],
  [430, 2, 4, 12, 4, 2, 0, 0, 2, 2, 1],
  [431, 1, 7, 7, 7, 4, 1, 0, 0, 0, 1],
  [432, 2, 4, 17, 4, 1, 2, 0, 4, 0, 1],
  [433, 2, 4, 18, 4, 1, 2, 1, 4, 1, 0],
  [434, 2, 5, 19, 5, 3, 1, 1, 4, 0, 1],
  [435, 1, 3, 8, 3, 2, 1, 1, 1, 0, 0],
  [436, 2, 6, 11, 6, 3, 1, 1, 2, 2, 2],
  [437, 2, 7, 18, 7, 4, 2, 0, 5, 0, 2],
  [438, 1, 4, 9, 4, 2, 1, 1, 1, 0, 0],
  [439, 1, 5, 9, 5, 3, 2, 1, 0, 2, 2],
  [440, 2, 8, 17, 8, 4, 0, 1, 5, 2, 1],
  [441, 3, 3, 21, 3, 2, 2, 0, 6, 2, 0],
  [442, 1, 2, 12, 2, 0, 0, 1, 2, 2, 0],
  [443, 1, 8, 7, 8, 4, 1, 1, 0, 0, 1],
  [444, 1, 3, 9, 3, 1, 1, 1, 1, 1, 2],
  [445, 1, 3, 14, 3, 0, 0, 0, 3, 2, 0],
  [446, 2, 4, 14, 4, 3, 0, 0, 3, 2, 2],
  [447, 1, 2, 8, 2, 0, 0, 1, 0, 1, 2],
  [448, 2, 5, 22, 5, 3, 0, 1, 7, 2, 0],
  [449, 1, 4, 16, 4, 2, 2, 1, 3, 1, 1],
  [450, 1, 3, 14, 3, 0, 0, 1, 3, 1, 2],
  [451, 0, 3, 18, 3, 2, 1, 1, 6, 2, 1],
  [452, 4, 5, 21, 5, 3, 1, 0, 7, 0, 1],
  [453, 1, 7, 16, 7, 4, 1, 0, 2, 2, 1],
  [454, 3, 5, 22, 5, 4, 2, 0, 7, 0, 1],
  [455, 4, 3, 22, 3, 1, 2, 0, 7, 1, 2],
  [456, 1, 3, 9, 3, 0, 2, 0, 0, 1, 2],
  [457, 1, 3, 21, 3, 0, 1, 0, 7, 2, 2],
  [458, 1, 4, 14, 4, 0, 2, 0, 2, 0, 0],
  [459, 1, 3, 17, 3, 0, 1, 1, 5, 2, 1],
  [460, 1, 3, 15, 3, 0, 0, 0, 4, 0, 0],
  [461, 1, 2, 12, 2, 0, 0, 1, 2, 1, 1],
  [462, 1, 2, 7, 2, 0, 1, 1, 0, 2, 2],
  [463, 1, 2, 7, 2, 0, 1, 1, 0, 0, 2],
  [464, 2, 6, 14, 6, 3, 0, 0, 3, 0, 1],
  [465, 1, 8, 11, 8, 4, 2, 0, 1, 2, 2],
  [466, 0, 6, 16, 6, 3, 0, 1, 4, 0, 0],
  [467, 2, 5, 19, 5, 4, 2, 0, 5, 0, 0],
  [468, 2, 7, 11, 7, 4, 1, 0, 2, 0, 0],
  [469, 1, 4, 18, 4, 3, 2, 1, 4, 1, 0],
  [470, 0, 8, 14, 8, 4, 1, 0, 4, 0, 0],
  [471, 2, 3, 10, 3, 0, 2, 0, 1, 2, 0],
  [472, 3, 4, 18, 4, 0, 2, 0, 4, 1, 2],
  [473, 1, 4, 21, 4, 2, 1, 0, 5, 0, 2],
  [474, 1, 3, 15, 3, 0, 0, 1, 4, 2, 0],
  [475, 3, 4, 16, 4, 1, 1, 0, 2, 0, 2],
  [476, 1, 8, 10, 8, 4, 0, 0, 1, 0, 1],
  [477, 0, 3, 20, 3, 0, 2, 1, 6, 0, 2],
  [478, 4, 3, 21, 3, 2, 2, 0, 6, 1, 1],
  [479, 1, 3, 14, 3, 0, 0, 0, 3, 1, 1],
  [480, 3, 5, 18, 5, 3, 1, 1, 3, 1, 2],
  [481, 4, 3, 23, 3, 0, 2, 0, 7, 2, 1],
  [482, 3, 4, 23, 4, 2, 2, 1, 7, 0, 2],
  [483, 1, 5, 26, 5, 3, 1, 0, 7, 1, 0],
  [484, 2, 2, 10, 2, 0, 0, 1, 1, 1, 0],
  [485, 1, 4, 16, 4, 0, 1, 1, 2, 1, 2],
  [486, 2, 4, 16, 4, 2, 2, 0, 3, 2, 2],
  [487, 2, 3, 11, 3, 1, 2, 1, 1, 0, 1],
  [488, 4, 5, 25, 5, 3, 1, 1, 7, 0, 1],
  [489, 1, 3, 15, 3, 0, 2, 0, 3, 1, 1],
  [490, 1, 3, 9, 3, 2, 2, 1, 0, 0, 2],
  [491, 1, 2, 12, 2, 0, 0, 1, 2, 2, 1],
  [492, 1, 3, 14, 3, 2, 0, 0, 3, 0, 2],
  [493, 1, 5, 9, 5, 3, 2, 1, 0, 2, 2],
  [494, 2, 7, 24, 7, 4, 2, 1, 7, 1, 0],
  [495, 2, 5, 18, 5, 3, 2, 0, 5, 2, 1],
  [496, 2, 3, 17, 3, 1, 0, 1, 5, 1, 0],
  [497, 4, 6, 23, 6, 3, 2, 1, 7, 0, 0],
  [498, 1, 3, 9, 3, 0, 1, 0, 1, 2, 1],
  [499, 1, 8, 19, 8, 4, 1, 0, 4, 0, 0],
  [500, 2, 5, 20, 5, 2, 1, 1, 4, 2, 0],
  [501, 2, 3, 12, 3, 2, 0, 1, 2, 1, 0],
  [502, 4, 5, 24, 5, 0, 2, 1, 7, 1, 0],
  [503, 1, 5, 11, 5, 2, 1, 0, 2, 2, 2],
  [504, 2, 8, 22, 8, 4, 2, 0, 6, 2, 0],
  [505, 3, 5, 21, 5, 1, 1, 1, 7, 1, 1],
  [506, 1, 3, 9, 3, 0, 2, 1, 0, 2, 1],
  [507, 2, 7, 17, 7, 4, 0, 0, 5, 1, 0],
  [508, 2, 3, 13, 3, 1, 2, 0, 2, 0, 1],
  [509, 3, 5, 16, 5, 3, 2, 1, 3, 0, 0],
  [510, 4, 5, 21, 5, 3, 1, 1, 5, 2, 2],
  [511, 2, 3, 12, 3, 1, 0, 0, 2, 1, 1],
  [512, 2, 5, 10, 5, 2, 2, 0, 1, 0, 1],
  [513, 2, 5, 24, 5, 3, 1, 1, 6, 1, 1],
  [514, 2, 4, 22, 4, 0, 1, 1, 5, 0, 0],
  [515, 1, 3, 16, 3, 2, 1, 1, 5, 1, 2],
  [516, 1, 5, 8, 5, 3, 0, 0, 0, 1, 1],
  [517, 1, 2, 19, 2, 0, 1, 1, 6, 2, 1],
  [518, 2, 5, 22, 5, 3, 0, 1, 7, 1, 1],
  [519, 1, 3, 16, 3, 1, 0, 1, 4, 2, 0],
  [520, 1, 3, 14, 3, 0, 0, 1, 3, 2, 2],
  [521, 1, 3, 18, 3, 1, 2, 1, 5, 2, 0],
  [522, 1, 4, 9, 4, 2, 2, 1, 0, 1, 0],
  [523, 1, 3, 19, 3, 1, 1, 1, 6, 1, 1],
  [524, 1, 7, 16, 7, 4, 2, 0, 3, 2, 1],
  [525, 3, 7, 16, 7, 4, 2, 1, 3, 2, 1],
  [526, 1, 7, 15, 7, 4, 0, 1, 4, 0, 2],
  [527, 2, 7, 10, 7, 4, 0, 0, 1, 0, 1],
  [528, 3, 4, 16, 4, 3, 2, 1, 3, 1, 1],
  [529, 1, 6, 17, 6, 4, 2, 0, 4, 2, 2],
  [530, 1, 6, 16, 6, 3, 1, 0, 2, 2, 0],
  [531, 0, 4, 17, 4, 0, 2, 1, 4, 0, 1],
  [532, 1, 6, 10, 6, 4, 0, 1, 1, 0, 1],
  [533, 4, 5, 24, 5, 3, 2, 1, 7, 1, 2],
  [534, 2, 4, 24, 4, 0, 1, 1, 6, 0, 0],
  [535, 1, 3, 14, 3, 0, 0, 1, 3, 1, 0],
  [536, 3, 4, 15, 4, 3, 2, 0, 3, 0, 0],
  [537, 1, 4, 20, 4, 3, 0, 0, 6, 0, 0],
  [538, 1, 3, 14, 3, 1, 0, 1, 3, 1, 2],
  [539, 3, 5, 22, 5, 2, 0, 0, 7, 2, 2],
  [540, 1, 7, 8, 7, 4, 0, 0, 0, 1, 2],
  [541, 1, 8, 8, 8, 4, 0, 1, 0, 0, 0],
  [542, 2, 6, 20, 6, 4, 1, 1, 4, 2, 0],
  [543, 2, 4, 19, 4, 1, 1, 0, 4, 1, 1],
  [544, 1, 6, 11, 6, 4, 2, 1, 1, 2, 0],
  [545, 1, 3, 9, 3, 1, 1, 0, 1, 0, 0],
  [546, 0, 4, 15, 4, 2, 0, 1, 4, 2, 1],
  [547, 2, 3, 14, 3, 1, 0, 1, 3, 2, 2],
  [548, 0, 4, 19, 4, 0, 1, 0, 4, 1, 2],
  [549, 2, 5, 11, 5, 2, 2, 0, 1, 0, 0],
  [550, 0, 3, 15, 3, 1, 1, 1, 4, 2, 0],
  [551, 1, 3, 10, 3, 1, 2, 0, 1, 0, 1],
  [552, 3, 5, 15, 5, 3, 1, 0, 4, 2, 1],
  [553, 3, 5, 17, 5, 4, 0, 1, 5, 1, 1],
  [554, 3, 4, 24, 4, 2, 2, 1, 7, 1, 2],
  [555, 3, 4, 19, 4, 0, 2, 1, 5, 2, 2],
  [556, 1, 3, 8, 3, 1, 0, 0, 0, 1, 2],
  [557, 2, 3, 14, 3, 2, 0, 0, 3, 0, 1],
  [558, 2, 8, 18, 8, 4, 1, 0, 3, 0, 2],
  [559, 1, 4, 16, 4, 2, 1, 0, 2, 2, 2],
  [560, 2, 4, 16, 4, 0, 2, 1, 3, 0, 1],
  [561, 1, 3, 9, 3, 1, 1, 0, 1, 0, 2],
  [562, 1, 8, 8, 8, 4, 0, 1, 0, 2, 1],
  [563, 1, 3, 16, 3, 2, 2, 1, 4, 0, 0],
  [564, 1, 4, 14, 4, 2, 2, 1, 2, 2, 1],
  [565, 2, 8, 13, 8, 4, 2, 1, 2, 2, 0],
  [566, 1, 4, 9, 4, 3, 2, 0, 0, 1, 2],
  [567, 1, 8, 7, 8, 4, 1, 0, 0, 2, 0],
  [568, 2, 8, 17, 8, 4, 0, 1, 5, 0, 2],
  [569, 1, 2, 8, 2, 1, 1, 1, 1, 1, 0],
  [570, 1, 3, 9, 3, 2, 2, 1, 0, 1, 2],
  [571, 1, 3, 12, 3, 0, 0, 0, 2, 1, 1],
  [572, 1, 6, 8, 6, 4, 1, 1, 1, 0, 1],
  [573, 2, 3, 12, 3, 0, 0, 1, 2, 2, 2],
  [574, 1, 6, 11, 6, 3, 2, 1, 1, 1, 2],
  [575, 1, 5, 9, 5, 3, 2, 0, 0, 0, 0],
  [576, 1, 4, 20, 4, 2, 1, 1, 4, 2, 2],
  [577, 2, 5, 11, 5, 3, 1, 1, 2, 0, 2],
  [578, 1, 7, 17, 7, 4, 0, 1, 5, 2, 2],
  [579, 1, 3, 17, 3, 0, 2, 0, 4, 1, 1],
  [580, 1, 8, 10, 8, 4, 2, 1, 1, 1, 1],
  [581, 1, 2, 14, 2, 1, 1, 1, 4, 2, 1],
  [582, 1, 7, 16, 7, 4, 1, 1, 2, 0, 1],
  [583, 2, 4, 16, 4, 3, 2, 1, 3, 1, 1],
  [584, 3, 3, 22, 3, 0, 0, 1, 7, 2, 0],
  [585, 3, 3, 15, 3, 0, 2, 1, 3, 2, 2],
  [586, 1, 5, 20, 5, 3, 0, 1, 6, 1, 1],
  [587, 4, 4, 21, 4, 2, 1, 1, 5, 1, 2],
  [588, 2, 3, 14, 3, 2, 0, 0, 3, 2, 1],
  [589, 1, 5, 12, 5, 4, 0, 0, 2, 0, 2],
  [590, 0, 6, 21, 6, 3, 0, 1, 7, 0, 2],
  [591, 2, 3, 14, 3, 1, 0, 0, 3, 2, 1],
  [592, 3, 4, 24, 4, 1, 1, 1, 6, 2, 0],
  [593, 2, 3, 11, 3, 1, 2, 0, 1, 2, 0],
  [594, 1, 3, 10, 3, 1, 0, 1, 1, 2, 0],
  [595, 2, 7, 22, 7, 4, 2, 0, 6, 1, 1],
  [596, 3, 5, 23, 5, 2, 2, 0, 7, 2, 1],
  [597, 3, 6, 18, 6, 3, 1, 1, 3, 1, 1],
  [598, 2, 3, 14, 3, 1, 0, 1, 3, 0, 2],
  [599, 2, 3, 17, 3, 2, 0, 0, 5, 0, 1],
  [600, 1, 3, 14, 3, 0, 0, 0, 3, 1, 2],
  [601, 2, 4, 19, 4, 1, 2, 1, 5, 1, 2],
  [602, 2, 4, 21, 4, 0, 1, 0, 5, 1, 2],
  [603, 2, 5, 17, 5, 3, 2, 1, 4, 0, 2],
  [604, 2, 5, 16, 5, 3, 2, 1, 3, 2, 1],
  [605, 4, 5, 25, 5, 4, 1, 0, 7, 1, 1],
  [606, 3, 3, 17, 3, 0, 0, 0, 5, 0, 1],
  [607, 1, 5, 8, 5, 4, 0, 1, 0, 2, 0],
  [608, 2, 8, 15, 8, 4, 0, 1, 4, 2, 1],
  [609, 1, 6, 10, 6, 3, 0, 1, 1, 1, 0],
  [610, 2, 4, 17, 4, 1, 2, 0, 4, 2, 1],
  [611, 3, 5, 21, 5, 0, 1, 0, 7, 2, 2],
  [612, 3, 3, 16, 3, 0, 1, 0, 5, 1, 0],
  [613, 0, 3, 14, 3, 0, 1, 1, 4, 1, 2],
  [614, 1, 3, 15, 3, 0, 0, 1, 4, 0, 0],
  [615, 1, 4, 11, 4, 2, 1, 1, 2, 1, 2],
  [616, 1, 7, 7, 7, 4, 1, 0, 0, 1, 0],
  [617, 2, 4, 18, 4, 2, 1, 0, 3, 0, 2],
  [618, 1, 3, 8, 3, 3, 1, 1, 1, 2, 2],
  [619, 2, 6, 13, 6, 4, 1, 1, 3, 1, 2],
  [620, 1, 4, 20, 4, 2, 1, 0, 4, 2, 0],
  [621, 1, 7, 21, 7, 4, 0, 0, 7, 0, 1],
  [622, 3, 3, 22, 3, 1, 0, 1, 7, 0, 0],
  [623, 1, 4, 23, 4, 0, 2, 1, 7, 0, 2],
  [624, 1, 5, 23, 5, 2, 2, 1, 7, 2, 2],
  [625, 1, 3, 14, 3, 2, 0, 1, 3, 0, 2],
  [626, 1, 3, 12, 3, 0, 0, 0, 2, 0, 1],
  [627, 1, 2, 8, 2, 0, 1, 1, 1, 2, 1],
  [628, 1, 5, 18, 5, 3, 1, 1, 6, 0, 0],
  [629, 2, 4, 22, 4, 1, 2, 0, 7, 0, 0],
  [630, 3, 6, 16, 6, 3, 0, 0, 4, 1, 1],
  [631, 3, 7, 22, 7, 4, 0, 1, 7, 1, 1],
  [632, 2, 4, 18, 4, 1, 1, 0, 3, 2, 1],
  [633, 2, 3, 11, 3, 0, 1, 0, 2, 0, 0],
  [634, 1, 3, 19, 3, 2, 1, 1, 6, 2, 1],
  [635, 3, 5, 24, 5, 3, 2, 1, 7, 2, 0],
  [636, 1, 3, 7, 3, 1, 1, 0, 0, 2, 0],
  [637, 1, 8, 9, 8, 4, 2, 0, 0, 2, 1],
  [638, 2, 3, 18, 3, 0, 0, 0, 5, 0, 2],
  [639, 1, 3, 9, 3, 1, 0, 1, 1, 2, 2],
  [640, 1, 3, 7, 3, 0, 1, 0, 0, 1, 0],
  [641, 2, 4, 19, 4, 2, 1, 1, 6, 2, 2],
  [642, 1, 5, 8, 5, 4, 0, 1, 0, 0, 1],
  [643, 1, 4, 19, 4, 0, 1, 1, 7, 0, 1],
  [644, 2, 4, 12, 4, 2, 0, 1, 2, 0, 1],
  [645, 2, 4, 21, 4, 1, 1, 1, 5, 0, 2],
  [646, 1, 6, 7, 6, 4, 1, 1, 0, 0, 2],
  [647, 4, 4, 26, 4, 0, 1, 1, 7, 0, 0],
  [648, 1, 4, 16, 4, 0, 1, 1, 2, 1, 0],
  [649, 2, 4, 21, 4, 3, 0, 0, 7, 1, 1],
  [650, 4, 4, 22, 4, 0, 2, 0, 6, 0, 1],
  [651, 0, 4, 20, 4, 1, 1, 0, 7, 0, 2],
  [652, 0, 3, 19, 3, 2, 0, 1, 6, 1, 2],
  [653, 1, 4, 20, 4, 3, 1, 0, 4, 2, 1],
  [654, 1, 2, 10, 2, 0, 0, 1, 1, 0, 0],
  [655, 2, 3, 10, 3, 0, 0, 0, 1, 2, 1],
  [656, 1, 6, 9, 6, 3, 2, 0, 0, 0, 2],
  [657, 1, 4, 26, 4, 0, 1, 0, 7, 0, 0],
  [658, 3, 4, 19, 4, 3, 1, 1, 6, 0, 1],
  [659, 1, 3, 17, 3, 0, 2, 0, 4, 0, 0],
  [660, 0, 7, 20, 7, 4, 2, 1, 6, 2, 0],
  [661, 1, 3, 15, 3, 0, 1, 1, 4, 0, 2],
  [662, 4, 7, 23, 7, 4, 2, 1, 7, 0, 2],
  [663, 1, 4, 14, 4, 3, 0, 1, 3, 2, 1],
  [664, 2, 6, 10, 6, 3, 0, 0, 1, 0, 2],
  [665, 1, 4, 21, 4, 0, 2, 0, 6, 1, 0],
  [666, 1, 5, 10, 5, 3, 0, 1, 1, 1, 1],
  [667, 3, 3, 16, 3, 1, 1, 1, 5, 1, 0],
  [668, 1, 5, 9, 5, 3, 1, 0, 1, 2, 1],
  [669, 3, 4, 19, 4, 0, 1, 1, 4, 1, 1],
  [670, 1, 5, 7, 5, 3, 1, 1, 0, 1, 2],
  [671, 2, 5, 20, 5, 3, 0, 1, 6, 2, 2],
  [672, 4, 3, 21, 3, 1, 2, 1, 6, 0, 0],
  [673, 1, 2, 8, 2, 1, 1, 1, 1, 0, 1],
  [674, 1, 2, 7, 2, 1, 1, 1, 0, 2, 1],
  [675, 2, 3, 18, 3, 1, 2, 1, 5, 1, 2],
  [676, 1, 3, 9, 3, 2, 1, 1, 1, 2, 1],
  [677, 3, 8, 21, 8, 4, 0, 1, 7, 2, 2],
  [678, 4, 4, 25, 4, 2, 1, 1, 7, 0, 2],
  [679, 1, 6, 9, 6, 3, 1, 0, 1, 2, 2],
  [680, 0, 7, 15, 7, 4, 0, 0, 4, 0, 1],
  [681, 1, 5, 17, 5, 2, 2, 0, 4, 0, 2],
  [682, 0, 3, 14, 3, 1, 1, 0, 4, 2, 0],
  [683, 1, 3, 11, 3, 3, 2, 1, 1, 2, 0],
  [684, 4, 5, 21, 5, 0, 1, 1, 7, 0, 2],
  [685, 2, 4, 11, 4, 2, 2, 0, 1, 1, 2],
  [686, 3, 4, 16, 4, 2, 2, 1, 3, 1, 2],
  [687, 2, 6, 14, 6, 4, 0, 1, 3, 2, 0],
  [688, 1, 4, 7, 4, 3, 1, 1, 0, 0, 0],
  [689, 1, 3, 9, 3, 1, 2, 1, 0, 0, 2],
  [690, 1, 4, 19, 4, 1, 2, 0, 5, 1, 2],
  [691, 1, 5, 9, 5, 2, 0, 0, 1, 2, 0],
  [692, 2, 7, 12, 7, 4, 0, 0, 2, 0, 1],
  [693, 3, 3, 17, 3, 0, 0, 1, 5, 2, 2],
  [694, 3, 4, 18, 4, 2, 2, 1, 4, 1, 0],
  [695, 1, 4, 13, 4, 0, 2, 0, 2, 2, 2],
  [696, 1, 4, 13, 4, 1, 2, 0, 2, 2, 0],
  [697, 2, 4, 23, 4, 1, 1, 1, 6, 0, 0],
  [698, 2, 5, 12, 5, 3, 0, 1, 2, 1, 2],
  [699, 2, 5, 14, 5, 4, 0, 0, 3, 1, 1],
  [700, 2, 7, 16, 7, 4, 1, 0, 2, 1, 2],
  [701, 2, 4, 21, 4, 3, 2, 0, 6, 0, 2],
  [702, 1, 6, 25, 6, 4, 1, 1, 7, 1, 2],
  [703, 1, 6, 22, 6, 4, 0, 0, 7, 2, 1],
  [704, 1, 6, 16, 6, 3, 1, 0, 2, 2, 0],
  [705, 2, 3, 18, 3, 2, 2, 1, 5, 2, 2],
  [706, 2, 4, 18, 4, 2, 2, 1, 5, 1, 1],
  [707, 1, 6, 16, 6, 3, 0, 0, 4, 1, 0],
  [708, 3, 4, 17, 4, 2, 0, 1, 5, 1, 0],
  [709, 1, 3, 9, 3, 2, 2, 1, 0, 1, 1],
  [710, 1, 6, 16, 6, 3, 1, 0, 5, 2, 2],
  [711, 1, 8, 14, 8, 4, 0, 1, 3, 0, 2],
  [712, 1, 6, 9, 6, 3, 2, 0, 0, 0, 0],
  [713, 2, 3, 15, 3, 1, 2, 1, 3, 2, 1],
  [714, 2, 5, 18, 5, 2, 1, 0, 3, 1, 0],
  [715, 3, 4, 20, 4, 3, 1, 0, 7, 0, 1],
  [716, 1, 6, 18, 6, 4, 1, 0, 3, 0, 0],
  [717, 2, 5, 19, 5, 3, 0, 0, 6, 1, 0],
  [718, 1, 6, 11, 6, 4, 2, 0, 1, 1, 0],
  [719, 1, 4, 19, 4, 2, 1, 0, 6, 1, 0],
  [720, 2, 8, 16, 8, 4, 2, 1, 3, 0, 0],
  [721, 1, 3, 9, 3, 0, 1, 0, 1, 0, 2],
  [722, 3, 4, 18, 4, 2, 2, 0, 5, 2, 0],
  [723, 1, 6, 9, 6, 4, 2, 0, 0, 2, 0],
  [724, 1, 1, 10, 1, 0, 0, 1, 1, 1, 1],
  [725, 1, 3, 9, 3, 1, 2, 0, 0, 1, 0],
  [726, 2, 6, 11, 6, 4, 1, 0, 2, 0, 1],
  [727, 2, 3, 14, 3, 0, 0, 0, 3, 1, 1],
  [728, 1, 7, 13, 7, 4, 1, 0, 3, 1, 1],
  [729, 2, 4, 24, 4, 0, 1, 1, 6, 1, 2],
  [730, 3, 4, 18, 4, 3, 2, 1, 5, 2, 1],
  [731, 1, 4, 12, 4, 0, 0, 1, 2, 1, 1],
  [732, 3, 5, 22, 5, 4, 0, 0, 7, 0, 0],
  [733, 3, 3, 20, 3, 3, 1, 0, 7, 1, 2],
  [734, 1, 3, 9, 3, 0, 1, 0, 1, 0, 1],
  [735, 1, 2, 12, 2, 0, 0, 1, 2, 1, 2],
  [736, 2, 5, 14, 5, 3, 2, 1, 2, 2, 1],
  [737, 2, 4, 21, 4, 2, 0, 1, 7, 0, 0],
  [738, 0, 6, 21, 6, 4, 2, 1, 6, 1, 2],
  [739, 2, 3, 11, 3, 1, 2, 1, 1, 1, 1],
  [740, 1, 3, 8, 3, 0, 0, 0, 0, 2, 1],
  [741, 2, 3, 17, 3, 0, 0, 1, 5, 0, 1],
  [742, 3, 6, 17, 6, 4, 1, 1, 5, 2, 1],
  [743, 2, 4, 19, 4, 2, 1, 1, 6, 2, 2],
  [744, 0, 4, 17, 4, 1, 2, 0, 4, 2, 0],
  [745, 1, 2, 13, 2, 0, 1, 1, 3, 2, 2],
  [746, 1, 5, 7, 5, 3, 1, 0, 0, 1, 2],
  [747, 1, 4, 14, 4, 3, 0, 0, 3, 2, 2],
  [748, 4, 4, 20, 4, 0, 2, 1, 5, 1, 1],
  [749, 1, 3, 20, 3, 0, 1, 1, 7, 2, 2],
  [750, 1, 7, 14, 7, 4, 2, 0, 2, 2, 2],
  [751, 1, 3, 10, 3, 1, 0, 0, 1, 1, 1],
  [752, 2, 3, 11, 3, 1, 2, 0, 1, 1, 0],
  [753, 2, 2, 19, 2, 0, 1, 1, 6, 0, 1],
  [754, 2, 4, 20, 4, 2, 0, 0, 6, 2, 0],
  [755, 2, 5, 14, 5, 3, 2, 1, 2, 2, 2],
  [756, 1, 7, 8, 7, 4, 0, 1, 0, 2, 1],
  [757, 2, 4, 15, 4, 2, 0, 1, 4, 1, 2],
  [758, 2, 3, 15, 3, 1, 0, 1, 4, 2, 2],
  [759, 2, 4, 18, 4, 0, 1, 0, 3, 0, 2],
  [760, 1, 3, 17, 3, 0, 1, 0, 5, 1, 2],
  [761, 2, 3, 21, 3, 1, 0, 0, 7, 0, 2],
  [762, 2, 4, 22, 4, 1, 2, 0, 6, 2, 0],
  [763, 1, 4, 17, 4, 1, 2, 1, 4, 1, 2],
  [764, 1, 3, 9, 3, 3, 2, 0, 0, 1, 2],
  [765, 2, 7, 17, 7, 4, 2, 0, 4, 2, 2],
  [766, 1, 4, 15, 4, 3, 2, 1, 3, 1, 1],
  [767, 0, 7, 21, 7, 4, 0, 1, 7, 1, 0],
  [768, 1, 7, 21, 7, 4, 2, 1, 6, 1, 0],
  [769, 2, 7, 18, 7, 4, 2, 1, 5, 1, 0],
  [770, 1, 3, 9, 3, 1, 2, 1, 0, 2, 0],
  [771, 1, 4, 13, 4, 2, 2, 1, 2, 0, 2],
  [772, 3, 6, 22, 6, 3, 1, 0, 5, 0, 1],
  [773, 3, 2, 17, 2, 0, 0, 1, 5, 1, 0],
  [774, 3, 7, 22, 7, 4, 2, 1, 7, 2, 1],
  [775, 4, 3, 20, 3, 0, 0, 1, 6, 2, 0],
  [776, 2, 5, 20, 5, 3, 0, 1, 6, 0, 1],
  [777, 1, 3, 16, 3, 1, 0, 0, 4, 1, 2],
  [778, 1, 4, 24, 4, 2, 2, 1, 7, 2, 2],
  [779, 2, 3, 20, 3, 0, 0, 0, 6, 0, 2],
  [780, 1, 3, 19, 3, 1, 1, 0, 6, 2, 1],
  [781, 3, 3, 16, 3, 0, 1, 1, 5, 1, 0],
  [782, 2, 5, 10, 5, 3, 0, 0, 1, 1, 0],
  [783, 3, 4, 26, 4, 1, 1, 1, 7, 1, 0],
  [784, 2, 6, 19, 6, 3, 1, 1, 4, 0, 1],
  [785, 1, 8, 22, 8, 4, 2, 1, 6, 0, 0],
  [786, 2, 3, 13, 3, 0, 2, 0, 2, 0, 0],
  [787, 1, 5, 9, 5, 3, 1, 0, 1, 0, 0],
  [788, 2, 5, 16, 5, 3, 1, 0, 5, 0, 2],
  [789, 3, 4, 21, 4, 0, 1, 0, 7, 0, 0],
  [790, 2, 7, 21, 7, 4, 2, 1, 6, 2, 1],
  [791, 1, 4, 7, 4, 2, 1, 0, 0, 1, 1],
  [792, 1, 6, 21, 6, 4, 0, 0, 7, 2, 1],
  [793, 2, 4, 11, 4, 2, 2, 0, 1, 2, 1],
  [794, 2, 4, 20, 4, 1, 1, 1, 4, 0, 0],
  [795, 2, 4, 14, 4, 0, 2, 0, 2, 1, 2],
  [796, 0, 4, 19, 4, 1, 1, 1, 4, 2, 2],
  [797, 1, 3, 22, 3, 0, 0, 0, 7, 1, 1],
  [798, 2, 3, 11, 3, 2, 2, 0, 1, 2, 1],
  [799, 3, 3, 17, 3, 0, 0, 0, 5, 2, 0],
  [800, 1, 4, 11, 4, 2, 2, 0, 1, 0, 2],
  [801, 1, 7, 7, 7, 4, 1, 0, 0, 1, 2],
  [802, 3, 4, 21, 4, 2, 2, 0, 6, 2, 1],
  [803, 2, 5, 15, 5, 4, 1, 1, 4, 1, 1],
  [804, 1, 3, 9, 3, 0, 2, 0, 0, 1, 0],
  [805, 2, 3, 18, 3, 3, 2, 1, 5, 2, 1],
  [806, 2, 3, 12, 3, 0, 0, 1, 2, 1, 1],
  [807, 3, 4, 24, 4, 1, 2, 1, 7, 1, 0],
  [808, 2, 6, 18, 6, 3, 2, 1, 5, 0, 0],
  [809, 2, 8, 17, 8, 4, 2, 0, 4, 1, 2],
  [810, 4, 8, 21, 8, 4, 2, 1, 6, 1, 2],
  [811, 1, 5, 11, 5, 3, 1, 0, 2, 1, 2],
  [812, 2, 6, 12, 6, 4, 0, 0, 2, 1, 0],
  [813, 1, 6, 23, 6, 3, 2, 1, 7, 1, 0],
  [814, 3, 4, 26, 4, 1, 1, 1, 7, 1, 1],
  [815, 2, 6, 16, 6, 4, 2, 1, 3, 2, 2],
  [816, 3, 4, 23, 4, 2, 2, 0, 7, 2, 2],
  [817, 2, 8, 19, 8, 4, 1, 1, 4, 1, 1],
  [818, 2, 3, 15, 3, 3, 0, 0, 4, 0, 2],
  [819, 2, 4, 18, 4, 2, 1, 1, 3, 0, 2],
  [820, 1, 3, 18, 3, 0, 0, 1, 5, 1, 1],
  [821, 4, 3, 22, 3, 0, 0, 0, 7, 0, 0],
  [822, 3, 5, 19, 5, 3, 2, 1, 5, 0, 2],
  [823, 2, 4, 13, 4, 1, 2, 1, 2, 2, 0],
  [824, 2, 4, 18, 4, 2, 1, 1, 3, 1, 1],
  [825, 1, 8, 8, 8, 4, 0, 0, 0, 2, 1],
  [826, 2, 4, 25, 4, 1, 1, 0, 7, 1, 2],
  [827, 4, 4, 26, 4, 1, 1, 1, 7, 2, 2],
  [828, 1, 5, 8, 5, 3, 1, 0, 1, 2, 1],
  [829, 2, 8, 14, 8, 4, 0, 0, 3, 0, 1],
  [830, 2, 5, 12, 5, 3, 0, 1, 2, 0, 1],
  [831, 2, 3, 20, 3, 0, 0, 0, 6, 1, 1],
  [832, 1, 5, 21, 5, 3, 0, 0, 7, 0, 0],
  [833, 3, 4, 23, 4, 1, 2, 0, 7, 1, 0],
  [834, 3, 6, 18, 6, 4, 2, 1, 5, 0, 0],
  [835, 2, 4, 13, 4, 0, 2, 1, 2, 2, 1],
  [836, 3, 3, 17, 3, 0, 2, 0, 4, 1, 1],
  [837, 1, 5, 15, 5, 3, 2, 0, 3, 0, 0],
  [838, 2, 2, 15, 2, 0, 0, 1, 4, 1, 1],
  [839, 1, 3, 14, 3, 2, 1, 1, 4, 0, 0],
  [840, 1, 8, 9, 8, 4, 2, 1, 0, 0, 1],
  [841, 1, 3, 16, 3, 0, 1, 0, 5, 1, 0],
  [842, 0, 4, 22, 4, 0, 2, 1, 7, 0, 0],
  [843, 1, 3, 14, 3, 2, 0, 1, 3, 1, 0],
  [844, 2, 3, 13, 3, 1, 2, 0, 2, 2, 0],
  [845, 1, 6, 13, 6, 4, 1, 1, 3, 0, 0],
  [846, 3, 3, 21, 3, 0, 0, 1, 7, 1, 1],
  [847, 1, 2, 8, 2, 0, 0, 1, 0, 1, 1],
  [848, 1, 3, 9, 3, 1, 0, 0, 1, 2, 2],
  [849, 1, 5, 17, 5, 4, 0, 1, 5, 1, 1],
  [850, 2, 8, 18, 8, 4, 1, 0, 3, 1, 2],
  [851, 1, 5, 17, 5, 4, 0, 1, 5, 2, 2],
  [852, 3, 2, 16, 2, 0, 1, 1, 5, 2, 2],
  [853, 3, 3, 16, 3, 1, 1, 0, 5, 2, 1],
  [854, 1, 3, 9, 3, 2, 2, 0, 0, 0, 0],
  [855, 2, 3, 10, 3, 1, 0, 1, 1, 1, 2],
  [856, 1, 5, 22, 5, 1, 0, 1, 7, 2, 2],
  [857, 1, 4, 9, 4, 2, 1, 0, 1, 0, 1],
  [858, 2, 7, 24, 7, 4, 1, 1, 6, 0, 2],
  [859, 1, 3, 9, 3, 0, 2, 0, 0, 0, 2],
  [860, 0, 7, 15, 7, 4, 0, 0, 4, 0, 0],
  [861, 3, 4, 21, 4, 2, 1, 0, 5, 1, 2],
  [862, 1, 4, 22, 4, 0, 2, 1, 6, 0, 0],
  [863, 1, 3, 8, 3, 1, 0, 0, 0, 2, 2],
  [864, 0, 6, 17, 6, 3, 2, 1, 4, 2, 1],
  [865, 1, 5, 14, 5, 3, 0, 0, 3, 2, 1],
  [866, 3, 5, 23, 5, 2, 1, 0, 6, 1, 2],
  [867, 2, 3, 20, 3, 0, 0, 0, 6, 0, 0],
  [868, 2, 7, 16, 7, 4, 1, 1, 2, 2, 0],
  [869, 4, 4, 26, 4, 2, 1, 1, 7, 0, 2],
  [870, 1, 7, 9, 7, 4, 0, 0, 1, 2, 0],
  [871, 2, 3, 12, 3, 2, 0, 1, 2, 2, 0],
  [872, 1, 4, 21, 4, 0, 1, 1, 5, 0, 2],
  [873, 1, 7, 9, 7, 4, 1, 0, 1, 1, 1],
  [874, 3, 7, 20, 7, 4, 1, 0, 4, 0, 0],
  [875, 2, 3, 22, 3, 2, 0, 1, 7, 0, 1],
  [876, 1, 3, 13, 3, 0, 1, 0, 3, 2, 1],
  [877, 1, 3, 9, 3, 1, 2, 0, 0, 2, 1],
  [878, 1, 4, 21, 4, 2, 2, 1, 6, 2, 2],
  [879, 2, 7, 17, 7, 4, 2, 0, 4, 0, 2],
  [880, 1, 4, 20, 4, 2, 0, 1, 7, 0, 1],
  [881, 1, 4, 18, 4, 3, 0, 1, 5, 0, 0],
  [882, 2, 3, 16, 3, 0, 2, 0, 4, 1, 0],
  [883, 1, 4, 16, 4, 2, 0, 0, 4, 0, 0],
  [884, 2, 8, 14, 8, 4, 2, 0, 2, 1, 0],
  [885, 2, 3, 21, 3, 1, 0, 1, 7, 0, 0],
  [886, 2, 4, 23, 4, 3, 2, 1, 7, 0, 1],
  [887, 2, 4, 18, 4, 3, 2, 1, 5, 0, 2],
  [888, 0, 4, 21, 4, 2, 2, 1, 6, 1, 1],
  [889, 1, 6, 16, 6, 3, 1, 1, 2, 0, 1],
  [890, 1, 5, 7, 5, 2, 1, 1, 0, 2, 0],
  [891, 1, 4, 16, 4, 3, 2, 1, 3, 2, 0],
  [892, 1, 5, 8, 5, 2, 1, 1, 1, 2, 1],
  [893, 1, 3, 14, 3, 1, 1, 0, 4, 2, 1],
  [894, 1, 8, 11, 8, 4, 2, 0, 1, 0, 0],
  [895, 1, 3, 7, 3, 2, 1, 1, 0, 1, 1],
  [896, 3, 5, 21, 5, 3, 2, 0, 6, 2, 2],
  [897, 2, 4, 22, 4, 1, 2, 0, 6, 1, 2],
  [898, 2, 2, 10, 2, 1, 0, 1, 1, 1, 1],
  [899, 2, 4, 13, 4, 0, 2, 1, 2, 2, 0],
  [900, 2, 7, 20, 7, 4, 1, 0, 7, 0, 2],
  [901, 3, 5, 21, 5, 3, 0, 1, 7, 2, 2],
  [902, 2, 4, 11, 4, 0, 1, 1, 2, 1, 2],
  [903, 2, 5, 18, 5, 3, 1, 0, 6, 0, 1],
  [904, 0, 6, 15, 6, 4, 0, 0, 4, 0, 2],
  [905, 1, 8, 24, 8, 4, 1, 0, 6, 0, 1],
  [906, 1, 6, 18, 6, 4, 2, 1, 5, 1, 0],
  [907, 1, 4, 9, 4, 2, 2, 1, 0, 1, 2],
  [908, 1, 5, 20, 5, 2, 2, 1, 6, 0, 2],
  [909, 2, 4, 15, 4, 2, 0, 1, 4, 0, 2],
  [910, 2, 5, 17, 5, 2, 0, 1, 5, 2, 0],
  [911, 3, 3, 17, 3, 1, 0, 1, 5, 1, 2],
  [912, 1, 6, 21, 6, 4, 1, 1, 5, 2, 0],
  [913, 2, 4, 11, 4, 2, 1, 0, 2, 0, 2],
  [914, 3, 4, 16, 4, 1, 2, 1, 3, 2, 0],
  [915, 2, 4, 16, 4, 2, 2, 1, 3, 0, 1],
  [916, 0, 3, 16, 3, 2, 0, 0, 4, 2, 1],
  [917, 1, 2, 12, 2, 0, 0, 1, 2, 1, 1],
  [918, 2, 4, 22, 4, 3, 2, 1, 6, 1, 2],
  [919, 1, 5, 7, 5, 3, 1, 0, 0, 0, 1],
  [920, 2, 6, 17, 6, 3, 0, 0, 5, 1, 0],
  [921, 1, 4, 14, 4, 2, 1, 0, 4, 0, 0],
  [922, 2, 5, 11, 5, 2, 2, 0, 1, 2, 2],
  [923, 1, 3, 9, 3, 0, 1, 0, 1, 0, 1],
  [924, 2, 4, 17, 4, 0, 2, 1, 4, 2, 2],
  [925, 1, 5, 18, 5, 3, 2, 1, 5, 1, 0],
  [926, 2, 8, 18, 8, 4, 1, 1, 3, 2, 1],
  [927, 2, 3, 11, 3, 3, 2, 1, 1, 2, 2],
  [928, 1, 4, 20, 4, 0, 0, 1, 7, 1, 1],
  [929, 0, 3, 19, 3, 0, 0, 1, 6, 0, 2],
  [930, 1, 3, 16, 3, 2, 0, 0, 4, 2, 0],
  [931, 1, 2, 7, 2, 0, 1, 1, 0, 1, 2],
  [932, 1, 7, 12, 7, 4, 0, 1, 2, 2, 1],
  [933, 2, 4, 19, 4, 1, 2, 1, 5, 1, 2],
  [934, 2, 3, 13, 3, 0, 2, 0, 2, 1, 0],
  [935, 1, 3, 9, 3, 2, 2, 0, 0, 1, 2],
  [936, 3, 3, 17, 3, 0, 1, 0, 5, 1, 1],
  [937, 1, 3, 11, 3, 1, 2, 0, 1, 2, 0],
  [938, 1, 4, 17, 4, 3, 2, 1, 4, 0, 0],
  [939, 0, 3, 17, 3, 0, 2, 1, 4, 2, 2],
  [940, 2, 3, 15, 3, 1, 0, 1, 4, 1, 2],
  [941, 3, 7, 16, 7, 4, 0, 1, 4, 1, 1],
  [942, 2, 4, 14, 4, 2, 2, 0, 2, 2, 2],
  [943, 3, 5, 19, 5, 3, 2, 1, 5, 0, 1],
  [944, 1, 6, 16, 6, 4, 0, 1, 4, 0, 0],
  [945, 2, 3, 16, 3, 2, 1, 1, 5, 2, 0],
  [946, 0, 6, 15, 6, 4, 0, 1, 4, 1, 2],
  [947, 3, 4, 20, 4, 2, 0, 0, 7, 2, 2],
  [948, 1, 5, 11, 5, 3, 1, 1, 2, 0, 0],
  [949, 0, 3, 14, 3, 1, 1, 1, 4, 2, 2],
  [950, 2, 5, 16, 5, 3, 2, 0, 4, 0, 1],
  [951, 1, 4, 11, 4, 0, 1, 0, 2, 1, 2],
  [952, 1, 7, 17, 7, 4, 1, 1, 5, 1, 1],
  [953, 1, 5, 12, 5, 3, 0, 1, 2, 1, 1],
  [954, 3, 3, 19, 3, 1, 2, 1, 5, 1, 1],
  [955, 2, 6, 18, 6, 4, 1, 1, 3, 2, 1],
  [956, 1, 7, 14, 7, 4, 0, 0, 3, 1, 2],
  [957, 3, 4, 18, 4, 1, 1, 0, 3, 1, 0],
  [958, 2, 3, 10, 3, 1, 0, 1, 1, 0, 2],
  [959, 4, 4, 24, 4, 2, 2, 1, 7, 1, 0],
  [960, 1, 4, 18, 4, 1, 2, 0, 4, 2, 1],
  [961, 2, 6, 13, 6, 4, 1, 1, 3, 2, 1],
  [962, 1, 3, 10, 3, 1, 2, 0, 1, 1, 2],
  [963, 3, 4, 22, 4, 1, 2, 0, 7, 1, 1],
  [964, 1, 6, 7, 6, 3, 1, 0, 0, 2, 1],
  [965, 3, 2, 19, 2, 0, 1, 1, 6, 0, 1],
  [966, 1, 8, 8, 8, 4, 0, 1, 0, 2, 1],
  [967, 2, 6, 21, 6, 4, 1, 0, 5, 2, 2],
  [968, 2, 4, 14, 4, 1, 2, 0, 2, 1, 2],
  [969, 1, 3, 15, 3, 1, 2, 1, 3, 0, 2],
  [970, 2, 7, 11, 7, 4, 2, 1, 1, 1, 0],
  [971, 1, 8, 22, 8, 4, 0, 1, 7, 2, 2],
  [972, 1, 4, 11, 4, 3, 1, 0, 2, 1, 0],
  [973, 2, 4, 13, 4, 2, 1, 0, 3, 0, 1],
  [974, 3, 8, 19, 8, 4, 0, 1, 6, 0, 2],
  [975, 2, 8, 19, 8, 4, 1, 1, 7, 1, 1],
  [976, 2, 6, 13, 6, 4, 1, 0, 3, 2, 0],
  [977, 2, 4, 17, 4, 2, 2, 0, 4, 2, 0],
  [978, 1, 3, 9, 3, 2, 2, 0, 0, 1, 1],
  [979, 1, 5, 11, 5, 3, 2, 0, 1, 1, 0],
  [980, 1, 6, 23, 6, 3, 2, 1, 7, 1, 0],
  [981, 2, 3, 15, 3, 1, 2, 0, 3, 2, 1],
  [982, 0, 4, 17, 4, 1, 2, 1, 4, 0, 1],
  [983, 0, 5, 16, 5, 2, 0, 1, 4, 0, 2],
  [984, 0, 6, 18, 6, 3, 1, 0, 6, 1, 1],
  [985, 1, 3, 17, 3, 3, 0, 1, 5, 2, 0],
  [986, 2, 3, 15, 3, 2, 0, 0, 4, 1, 2],
  [987, 3, 4, 20, 4, 0, 2, 1, 5, 0, 1],
  [988, 1, 7, 9, 7, 4, 2, 0, 0, 1, 1],
  [989, 1, 4, 14, 4, 0, 2, 0, 2, 2, 1],
  [990, 1, 6, 13, 6, 3, 2, 0, 2, 1, 0],
  [991, 1, 3, 9, 3, 0, 2, 1, 0, 0, 1],
  [992, 2, 3, 17, 3, 1, 2, 1, 4, 2, 1],
  [993, 3, 4, 15, 4, 3, 2, 1, 3, 2, 1],
  [994, 1, 8, 16, 8, 4, 1, 1, 2, 0, 1],
  [995, 3, 3, 20, 3, 1, 1, 1, 7, 2, 2],
  [996, 2, 6, 15, 6, 4, 2, 0, 3, 1, 0],
  [997, 1, 3, 15, 3, 0, 0, 1, 4, 0, 2],
  [998, 1, 7, 18, 7, 4, 2, 1, 5, 2, 2],
  [999, 2, 5, 14, 5, 4, 1, 0, 4, 1, 1]
  // 1000 exists but only as a prebuilt wand
];

// vendor/noita-telescope-main/js/spell_generator.js
function GetRandomActionWithType(x, y, level, type, worldSeed, offset = 0) {
  if (level > 10) level = 10;
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(worldSeed + offset, x, y);
  let sum = 0;
  for (let i = 0; i < ALL_SPELLS.length; i++) {
    if (!unlockedSpells[i]) continue;
    const spell = ALL_SPELLS[i];
    if (spell.type === type) {
      sum += spell.spawn_probabilities[level];
    }
  }
  const multiplier = prng2.Next();
  let accumulated = sum * multiplier;
  for (let i = 0; i < ALL_SPELLS.length; i++) {
    if (!unlockedSpells[i]) continue;
    const spell = ALL_SPELLS[i];
    if (spell.type !== type) continue;
    const probability = spell.spawn_probabilities[level];
    if (probability > 0 && probability >= accumulated) {
      return spell;
    }
    accumulated -= probability;
  }
  return "";
}
function GetRandomAction(ws, ng, x, y, level, offset = 0) {
  if (!level) {
    const depthScale = Math.floor(y / 512);
    if (depthScale <= 3) level = 0;
    else if (depthScale <= 6) level = 1;
    else if (depthScale <= 12) level = 2;
    else if (depthScale <= 16) level = 3;
    else if (depthScale <= 20) level = 4;
    else if (depthScale <= 24) level = 5;
    else if (depthScale <= 33) level = 6;
    else if (depthScale > 35) level = 7;
    else level = 0;
  }
  if (level > 10) level = 10;
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + offset, x, y);
  let sum = 0;
  for (let i = 0; i < ALL_SPELLS.length; i++) {
    if (!unlockedSpells[i]) continue;
    const spell = ALL_SPELLS[i];
    sum += spell.spawn_probabilities[level];
  }
  const multiplier = prng2.Next();
  let accumulated = sum * multiplier;
  for (let i = 0; i < ALL_SPELLS.length; i++) {
    if (!unlockedSpells[i]) continue;
    const spell = ALL_SPELLS[i];
    const probability = spell.spawn_probabilities[level];
    if (probability == 0) continue;
    if (probability >= accumulated) {
      return spell.name;
    }
    accumulated -= probability;
  }
  return "";
}
function MakeRandomSpell(prng2) {
  let spell = "";
  let valid = false;
  while (!valid) {
    let itemno = prng2.Random(1, ALL_SPELLS.length);
    if (!unlockedSpells[itemno - 1]) continue;
    if (!ALL_SPELLS[itemno - 1].can_spawn) continue;
    spell = ALL_SPELLS[itemno - 1].name;
    valid = true;
  }
  return spell;
}
function MakeRandomUtilitySpell(prng2) {
  let spell = "";
  let valid = false;
  while (!valid) {
    let itemno = prng2.Random(1, ALL_SPELLS.length);
    if (!unlockedSpells[itemno - 1]) continue;
    if (!ALL_SPELLS[itemno - 1].can_spawn_in_boxes) continue;
    spell = ALL_SPELLS[itemno - 1].name;
    valid = true;
  }
  return { type: "item", item: "spell", spell };
}
function generateShopItem(ws, ng, x, y, tier, offset = 0) {
  return { type: "item", item: "spell", spell: GetRandomAction(ws, ng, x, y, tier, offset), x, y };
}

// vendor/noita-telescope-main/js/utility_box_generation.js
function generateUtilityBox(ws, ng, x, y, perks = {}, gameMode = "normal") {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, roundRNGPos(x) + 509.7, roundRNGPos(y) + 683.1);
  let items = [];
  let count = 1;
  while (count > 0) {
    count--;
    let rnd = prng2.Random(1, 100);
    if (rnd <= 2) {
      items.push({ type: "item", item: "bomb", x, y });
    } else if (rnd <= 5) {
      rnd = prng2.Random(0, 100);
      if (rnd > 98) {
        items.push({ type: "item", item: "refresh_mimic", x, y });
      } else {
        items.push({ type: "item", item: "spell_refresh", x, y });
      }
    } else if (rnd <= 11) {
      const opts = ["kammi", "kuu", "ukkoskivi", "paha_silma", "kiuaskivi", "???", "chaos_die", "shiny_orb"];
      let selected = prng2.Random(0, opts.length - 1);
      if (opts[selected] == "???") {
        const runestoneOpts = ["runestone_light", "runestone_fire", "runestone_magma", "runestone_weight", "runestone_emptiness", "runestone_edges", "runestone_metal"];
        selected = prng2.Random(0, runestoneOpts.length - 1);
        items.push({ type: "item", item: runestoneOpts[selected], x, y });
      } else {
        if (opts[selected] == "chaos_die") {
          let unlocked = unlockedSpells[363];
          if (unlocked) {
            if (perks["greedCurse"]) {
              items.push({ type: "item", item: "greed_die", x, y });
            } else {
              items.push({ type: "item", item: "chaos_die", x, y });
            }
          } else {
            items.push(createPotion(ws, ng, x, y - 10, "normal", gameMode));
          }
        } else if (opts[selected] == "shiny_orb") {
          if (perks["greedCurse"]) {
            items.push({ type: "item", item: "greed_orb", x, y });
          } else {
            items.push({ type: "item", item: "shiny_orb", x, y });
          }
        } else {
          items.push({ type: "item", item: opts[selected], x, y });
        }
      }
    } else if (rnd <= 97) {
      let amount = 2;
      let rnd2 = prng2.Random(0, 100);
      if (rnd2 <= 40) {
        amount = 2;
      } else if (rnd2 <= 60) {
        amount += 1;
      } else if (rnd2 <= 77) {
        amount += 2;
      } else if (rnd2 <= 90) {
        amount += 3;
      } else {
        amount += 4;
      }
      for (let i = 1; i <= amount; i++) {
        const yJitter = prng2.Random(-5, 5);
        items.push({ ...MakeRandomUtilitySpell(prng2), x: x + (i - amount / 2) * 8, y: y - 4 + yJitter });
      }
    } else if (rnd <= 99) {
      count += 2;
    } else {
      count += 3;
    }
  }
  return { type: "utility_box", items, x, y };
}

// vendor/noita-telescope-main/js/gun_generation.js
function generateGun(worldSeed, ngPlusCount, wandType, cost, level, force_unshuffle, x, y, noMoreShuffle = false) {
  let gun = {};
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(worldSeed + ngPlusCount, x, y);
  gun["x"] = x;
  gun["y"] = y;
  gun["cards"] = [];
  gun["level"] = level;
  gun["cost"] = cost;
  if (level == 1) {
    if (prng2.Random(0, 100) < 50) {
      gun["cost"] += 5;
    }
  }
  gun["cost"] += prng2.Random(-3, 3);
  gun["deck_capacity"] = 0;
  gun["actions_per_round"] = 0;
  gun["reload_time"] = 0;
  gun["shuffle_deck_when_empty"] = 1;
  gun["fire_rate_wait"] = 0;
  gun["spread_degrees"] = 0;
  gun["speed_multiplier"] = 0;
  gun["prob_unshuffle"] = 0.1;
  gun["prob_draw_many"] = 0.15;
  gun["mana_charge_speed"] = 50 * level + prng2.Random(-5, 5 * level);
  gun["mana_max"] = 50 + 150 * level + prng2.Random(-5, 5) * 10;
  gun["force_unshuffle"] = 0;
  gun["is_rare"] = 0;
  gun["wand_type"] = wandType;
  let p = prng2.Random(0, 100);
  if (p < 20) {
    gun["mana_charge_speed"] = (50 * level + prng2.Random(-5, 5 * level)) / 5;
    gun["mana_max"] = (50 + 150 * level + prng2.Random(-5, 5) * 10) * 3;
    if (wandType == "better" && gun["mana_charge_speed"] < 10) gun["mana_charge_speed"] = 10;
  }
  p = prng2.Random(0, 100);
  if (wandType == "better") {
    if (p < 15 + level * 6) {
      gun["force_unshuffle"] = 1;
    }
  } else {
    if (p < 15) {
      gun["mana_charge_speed"] = (50 * level + prng2.Random(-5, 5 * level)) * 5;
      gun["mana_max"] = (50 + 150 * level + prng2.Random(-5, 5) * 10) / 3;
    }
    if (gun["mana_max"] < 50) gun["mana_max"] = 50;
    if (gun["mana_charge_speed"] < 10) gun["mana_charge_speed"] = 10;
    p = prng2.Random(0, 100);
    if (p < 15 + level * 6) {
      gun["force_unshuffle"] = 1;
    }
  }
  let is_rare = 0;
  p = prng2.Random(0, 100);
  if (p < 5) {
    is_rare = 1;
    gun["is_rare"] = 1;
    gun["cost"] += 65;
  }
  let vars1 = ["reload_time", "fire_rate_wait", "spread_degrees", "speed_multiplier"];
  let vars2 = ["deck_capacity"];
  let vars3 = ["shuffle_deck_when_empty", "actions_per_round"];
  shuffleTable(vars1, prng2);
  if (gun["force_unshuffle"] != 1) shuffleTable(vars3, prng2);
  for (let v of vars1) {
    applyRandomVariable(gun, v, prng2);
  }
  for (let v of vars2) {
    applyRandomVariable(gun, v, prng2);
  }
  for (let v of vars3) {
    applyRandomVariable(gun, v, prng2);
  }
  if (gun["cost"] > 5) {
    let rareNonincreaseRoll = prng2.Random(0, 1e3);
    if (rareNonincreaseRoll < 995) {
      if (gun["shuffle_deck_when_empty"] == 1) {
        gun["deck_capacity"] += gun["cost"] / 5;
        gun["cost"] = 0;
      } else {
        gun["deck_capacity"] += gun["cost"] / 10;
        gun["cost"] = 0;
      }
    }
  }
  if (wandType == "better") {
    let name = GUN_NAMES[prng2.Random(0, GUN_NAMES.length - 1)];
    gun["name"] = name + " Wand";
  } else {
    gun["name"] = "Wand";
  }
  if (force_unshuffle || noMoreShuffle) gun["shuffle_deck_when_empty"] = 0;
  gun["original_force_unshuffle"] = force_unshuffle ? 1 : 0;
  let rareCapacityRoll = prng2.Random(0, 1e4);
  if (rareCapacityRoll <= 9999) {
    gun["deck_capacity"] = clamp(gun["deck_capacity"], 2, 26);
  }
  if (gun["deck_capacity"] <= 1) gun["deck_capacity"] = 2;
  if (gun["reload_time"] >= 60) {
    let random_add_actions_per_round = function(prng3) {
      gun["actions_per_round"] += 1;
      if (prng3.Random(0, 100) < 70) {
        random_add_actions_per_round(prng3);
      }
    };
    random_add_actions_per_round(prng2);
    if (prng2.Random(0, 100) < 50) {
      let new_actions_per_round = +gun["deck_capacity"];
      for (let i = 1; i <= 6; i++) {
        let temp_actions_per_round = prng2.Random(roundHalfOfEven(gun["actions_per_round"]), roundHalfOfEven(gun["deck_capacity"]));
        if (temp_actions_per_round < new_actions_per_round) {
          new_actions_per_round = temp_actions_per_round;
        }
      }
      gun["actions_per_round"] = new_actions_per_round;
    }
  }
  gun["actions_per_round"] = clamp(gun["actions_per_round"], 1, gun["deck_capacity"]);
  if (wandType == "better") {
    betterAddRandomCards(worldSeed, ngPlusCount, gun, x, y, level, prng2);
    getWandSprite(gun, prng2);
  } else {
    getWandSprite(gun, prng2);
    addRandomCards(worldSeed, ngPlusCount, gun, x, y, level, prng2);
  }
  return gun;
}
function initTotalProb(gunProb) {
  let totalProb = 0;
  for (let i = 0; i < gunProb.probs.length; i++) {
    totalProb += gunProb.probs[i].prob;
  }
  gunProb.totalProb = totalProb;
}
function getGunProbs(wandType, variable, prng2) {
  if (!GUN_PROBS[wandType]) {
    console.log("Warning: no gun probs for wand type ", wandType);
    return null;
  }
  if (!GUN_PROBS[wandType][variable]) return null;
  if (GUN_PROBS[wandType][variable].totalProb == 0) initTotalProb(GUN_PROBS[wandType][variable]);
  let r = prng2.Next() * GUN_PROBS[wandType][variable].totalProb;
  for (let i = 0; i < GUN_PROBS[wandType][variable].probs.length; i++) {
    if (r < GUN_PROBS[wandType][variable].probs[i].prob) {
      return GUN_PROBS[wandType][variable].probs[i];
    }
    r -= GUN_PROBS[wandType][variable].probs[i].prob;
  }
  return GUN_PROBS[wandType][variable].probs[GUN_PROBS[wandType][variable].probs.length - 1];
}
function applyRandomVariable(gun, variable, prng2) {
  let probs = getGunProbs(gun["wand_type"], variable, prng2);
  if (variable == "reload_time") {
    let min = clamp(60 - gun["cost"] * 5, 1, 240);
    let max = 1024;
    gun[variable] = clamp(prng2.RandomDistribution(probs.min, probs.max, probs.mean, probs.sharpness), min, max);
    gun["cost"] -= (60 - gun[variable]) / 5;
  } else if (variable == "fire_rate_wait") {
    let min = clamp(16 - gun["cost"], -50, 50);
    let max = 50;
    gun[variable] = clamp(prng2.RandomDistribution(probs.min, probs.max, probs.mean, probs.sharpness), min, max);
    gun["cost"] -= 16 - gun[variable];
  } else if (variable == "spread_degrees") {
    let min = clamp(gun["cost"] / -1.5, -35, 35);
    let max = 35;
    gun[variable] = clamp(prng2.RandomDistribution(probs.min, probs.max, probs.mean, probs.sharpness), min, max);
    gun["cost"] -= 16 - gun[variable];
  } else if (variable == "speed_multiplier") {
    gun[variable] = prng2.RandomDistributionF(probs.min, probs.max, probs.mean, probs.sharpness);
  } else if (variable == "deck_capacity") {
    let min = 1;
    let max = clamp(gun["cost"] / 5 + 6, 1, 20);
    if (gun["force_unshuffle"] == 1) {
      min = 1;
      max = (gun["cost"] - 15) / 5;
      if (max > 6) {
        max = 6 + (gun["cost"] - (15 + 6 * 5)) / 10;
      }
    }
    max = clamp(max, 1, 20);
    gun[variable] = clamp(prng2.RandomDistribution(probs.min, probs.max, probs.mean, probs.sharpness), min, max);
    gun["cost"] -= (gun[variable] - 6) * 5;
  } else if (variable == "shuffle_deck_when_empty") {
    let r = prng2.Random(0, 1);
    if (gun["force_unshuffle"] == 1) {
      r = 1;
      if (gun["cost"] < 15 + gun["deck_capacity"] * 5) {
      }
    }
    if (r == 1 && gun["cost"] >= 15 + gun["deck_capacity"] * 5 && gun["deck_capacity"] <= 9) {
      gun[variable] = 0;
      gun["cost"] -= 15 + gun["deck_capacity"] * 5;
    }
  } else if (variable == "actions_per_round") {
    let action_costs = [0, 5 + gun["deck_capacity"] * 2, 15 + gun["deck_capacity"] * 3.5, 35 + gun["deck_capacity"] * 5, 45 + gun["deck_capacity"] * gun["deck_capacity"]];
    let min = 1;
    let max = 1;
    for (let i = 0; i < 5; i++) {
      if (action_costs[i] <= gun["cost"]) {
        max = i + 1;
      }
    }
    max = clamp(max, 1, gun["deck_capacity"]);
    gun[variable] = Math.floor(clamp(prng2.RandomDistribution(probs.min, probs.max, probs.mean, probs.sharpness), min, max));
    gun["cost"] -= action_costs[clamp(gun[variable], 1, 5) - 1];
  }
}
function wandDiff(gun, wand) {
  let score = 0;
  score += Math.abs(gun["fire_rate_wait"] - wand[5]) * 2;
  score += Math.abs(gun["actions_per_round"] - wand[6]) * 20;
  score += Math.abs(gun["shuffle_deck_when_empty"] - wand[7]) * 30;
  score += Math.abs(gun["deck_capacity"] - wand[8]) * 5;
  score += Math.abs(gun["spread_degrees"] - wand[9]);
  score += Math.abs(gun["reload_time"] - wand[10]);
  return score;
}
function getWandSprite(gun, prng2) {
  let bestWand = null;
  let bestScore = 1e3;
  let gunInWandSpace = {
    "fire_rate_wait": clamp((gun["fire_rate_wait"] + 5) / 7 - 1, 0, 4),
    "actions_per_round": clamp(gun["actions_per_round"] - 1, 0, 2),
    "shuffle_deck_when_empty": clamp(gun["shuffle_deck_when_empty"], 0, 1),
    "deck_capacity": clamp((gun["deck_capacity"] - 3) / 3, 0, 7),
    "spread_degrees": clamp((gun["spread_degrees"] + 5) / 5 - 1, 0, 2),
    "reload_time": clamp((gun["reload_time"] + 5) / 25 - 1, 0, 2)
  };
  for (let i = 0; i < WAND_SHAPES.length; i++) {
    let score = wandDiff(gunInWandSpace, WAND_SHAPES[i]);
    if (score <= bestScore) {
      bestWand = WAND_SHAPES[i];
      bestScore = score;
      if (score == 0) {
        if (prng2.Random(0, 100) < 33) break;
      }
    }
  }
  gun["grip"] = { x: bestWand[1], y: bestWand[2] };
  gun["tip"] = { x: bestWand[3], y: bestWand[4] };
  gun["sprite"] = `wand_${bestWand[0].toString().padStart(4, "0")}`;
}
function betterAddRandomCards(worldSeed, ngPlusCount, gun, x, y, level, prng2) {
  let good_cards = 5;
  if (prng2.Random(0, 100) < 7) good_cards = prng2.Random(20, 50);
  let is_rare = gun["is_rare"];
  if (is_rare) good_cards *= 2;
  let orig_level = level;
  level -= 1;
  let deck_capacity = gun["deck_capacity"];
  let actions_per_round = gun["actions_per_round"];
  let card_count = prng2.Random(1, 3);
  let bullet_card = GetRandomActionWithType(x, y, level, PROJECTILE, worldSeed, 0);
  let card = "";
  let random_bullets = 0;
  let good_card_count = 0;
  if (prng2.Random(0, 100) < 50 && card_count < 3) card_count += 1;
  if (prng2.Random(0, 100) < 10 || is_rare == 1) card_count += prng2.Random(1, 2);
  good_cards = prng2.Random(5, 45);
  card_count = prng2.Random(roundHalfOfEven(0.51 * deck_capacity), roundHalfOfEven(deck_capacity));
  card_count = clamp(card_count, 1, deck_capacity - 1);
  gun["card_count"] = card_count;
  if (prng2.Random(0, 100) < orig_level * 10 - 5) random_bullets = 1;
  if (prng2.Random(0, 100) < 4 || is_rare == 1) {
    let p = prng2.Random(0, 100);
    if (p < 77) {
      card = GetRandomActionWithType(x, y, level + 1, MODIFIER, worldSeed, 666);
    } else if (p < 85) {
      card = GetRandomActionWithType(x, y, level + 1, MODIFIER, worldSeed, 666);
      good_card_count += 1;
    } else if (p < 93) {
      card = GetRandomActionWithType(x, y, level + 1, STATIC_PROJECTILE, worldSeed, 666);
    } else {
      card = GetRandomActionWithType(x, y, level + 1, PROJECTILE, worldSeed, 666);
    }
    gun["always_casts"] = [card.name];
  } else {
    gun["always_casts"] = [];
  }
  if (card_count < 3) {
    if (card_count > 1 && prng2.Random(0, 100) < 20) {
      card = GetRandomActionWithType(x, y, level, MODIFIER, worldSeed, 2);
      gun["cards"].push(card.name);
      card_count -= 1;
    }
    for (let i = 0; i < Math.floor(card_count); i++) {
      gun["cards"].push(bullet_card.name);
    }
  } else {
    if (prng2.Random(0, 100) < 40) {
      card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, 1);
      gun["cards"].push(card.name);
      card_count -= 1;
    }
    if (card_count > 3 && prng2.Random(0, 100) < 40) {
      card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, 1);
      gun["cards"].push(card.name);
      card_count -= 1;
    }
    if (prng2.Random(0, 100) < 80) {
      card = GetRandomActionWithType(x, y, level, MODIFIER, worldSeed, 2);
      gun["cards"].push(card.name);
      card_count -= 1;
    }
    for (let i = 0; i < Math.floor(card_count); i++) {
      gun["cards"].push(bullet_card.name);
    }
  }
}
function addRandomCards(worldSeed, ngPlusCount, gun, x, y, level, prng2) {
  let good_cards = 5;
  let firstRandomCall = prng2.Random(0, 100);
  if (firstRandomCall < 7) {
    good_cards = prng2.Random(20, 50);
  }
  let is_rare = gun["is_rare"];
  if (is_rare) good_cards *= 2;
  let orig_level = level;
  level -= 1;
  let deck_capacity = gun["deck_capacity"];
  let actions_per_round = gun["actions_per_round"];
  let card_count = prng2.Random(1, 3);
  let bullet_card = GetRandomActionWithType(x, y, level, PROJECTILE, worldSeed, 0);
  let card = "";
  let random_bullets = 0;
  let good_card_count = 0;
  if (prng2.Random(0, 100) < 50 && card_count < 3) card_count += 1;
  if (prng2.Random(0, 100) < 10 || is_rare == 1) card_count += prng2.Random(1, 2);
  good_cards = prng2.Random(5, 45);
  card_count = prng2.Random(roundHalfOfEven(0.51 * deck_capacity), roundHalfOfEven(deck_capacity));
  card_count = clamp(card_count, 1, deck_capacity - 1);
  gun["card_count"] = card_count;
  if (prng2.Random(0, 100) < orig_level * 10 - 5) random_bullets = 1;
  if (prng2.Random(0, 100) < 4 || is_rare == 1) {
    let p = prng2.Random(0, 100);
    if (p < 77) {
      card = GetRandomActionWithType(x, y, level + 1, MODIFIER, worldSeed, 666);
    } else if (p < 85) {
      card = GetRandomActionWithType(x, y, level + 1, MODIFIER, worldSeed, 666);
      good_card_count += 1;
    } else if (p < 93) {
      card = GetRandomActionWithType(x, y, level + 1, STATIC_PROJECTILE, worldSeed, 666);
    } else {
      card = GetRandomActionWithType(x, y, level + 1, PROJECTILE, worldSeed, 666);
    }
    gun["always_casts"] = [card.name];
  } else {
    gun["always_casts"] = [];
  }
  if (prng2.Random(0, 100) < 50) {
    let extra_level = level;
    while (prng2.Random(1, 10) == 10) {
      extra_level += 1;
      bullet_card = GetRandomActionWithType(x, y, extra_level, PROJECTILE, worldSeed, 0);
    }
    if (card_count < 3) {
      if (card_count > 1 && prng2.Random(0, 100) < 20) {
        card = GetRandomActionWithType(x, y, level, MODIFIER, worldSeed, 2);
        gun["cards"].push(card.name);
        card_count -= 1;
      }
      for (let i = 0; i < Math.floor(card_count); i++) {
        gun["cards"].push(bullet_card.name);
      }
    } else {
      if (prng2.Random(0, 100) < 40) {
        card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, 1);
        gun["cards"].push(card.name);
        card_count -= 1;
      }
      if (card_count > 3 && prng2.Random(0, 100) < 40) {
        card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, 1);
        gun["cards"].push(card.name);
        card_count -= 1;
      }
      if (prng2.Random(0, 100) < 80) {
        card = GetRandomActionWithType(x, y, level, MODIFIER, worldSeed, 2);
        gun["cards"].push(card.name);
        card_count -= 1;
      }
      for (let i = 0; i < Math.floor(card_count); i++) {
        gun["cards"].push(bullet_card.name);
      }
    }
  } else {
    for (let i = 0; i < Math.floor(card_count); i++) {
      let r = prng2.Random(0, 100);
      if (r < good_cards && card_count > 2) {
        if (good_card_count == 0 && actions_per_round == 1) {
          card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, i + 1);
          good_card_count += 1;
        } else {
          if (prng2.Random(0, 100) < 83) {
            card = GetRandomActionWithType(x, y, level, MODIFIER, worldSeed, i + 1);
          } else {
            card = GetRandomActionWithType(x, y, level, DRAW_MANY, worldSeed, i + 1);
          }
        }
        gun["cards"].push(card.name);
      } else {
        gun["cards"].push(bullet_card.name);
        if (random_bullets == 1) {
          bullet_card = GetRandomActionWithType(x, y, level, PROJECTILE, worldSeed, i + 1);
        }
      }
    }
  }
}

// vendor/noita-telescope-main/js/wand_generation.js
function createWand(ws, ng, x, y, wandType, addOffset, noMoreShuffle = false) {
  let wandX = Math.floor(x);
  let wandY = Math.floor(y);
  if (addOffset) {
    wandX += 510;
    wandY += 683;
  }
  let wand = generateGun(ws, ng, wandType["type"], wandType["cost"], wandType["level"], wandType["force_unshuffle"], wandX, wandY, noMoreShuffle);
  wand["x"] = wandX;
  wand["y"] = wandY;
  wand["type"] = "wand";
  wand["item"] = "wand";
  return wand;
}
function getWandType(ws, ng, x, y, biome) {
  if (!WAND_SPAWN_DATA[biome]) {
    return null;
  }
  const prng2 = new NollaPrng(0);
  let totalProb = 0;
  for (let w of WAND_SPAWN_DATA[biome].weights) {
    totalProb += w;
  }
  let r = prng2.ProceduralRandom(ws + ng, x - 5, y) * totalProb;
  for (let i = 0; i < WAND_SPAWN_DATA[biome].weights.length; i++) {
    if (r <= WAND_SPAWN_DATA[biome].weights[i]) {
      return WAND_SPAWN_DATA[biome].types[i];
    }
    r -= WAND_SPAWN_DATA[biome].weights[i];
  }
  console.log("Warning: could not find wand type for ", x, y, ws, biome);
  return null;
}
function generateWand(ws, ng, x, y, wandTypeName, perks = {}) {
  const noMoreShuffle = perks["noMoreShuffle"] || false;
  let wand;
  const wandType = WAND_TYPES[wandTypeName];
  if (wandTypeName.includes("premade")) {
    wand = generateLevel1Wand(ws, ng, x, y, wandTypeName, noMoreShuffle);
  } else {
    wand = generateGun(ws, ng, wandType["type"], wandType["cost"], wandType["level"], wandType["force_unshuffle"], x, y, noMoreShuffle);
  }
  wand["x"] = x;
  wand["y"] = y;
  wand["type"] = "wand";
  wand["item"] = "wand";
  return wand;
}
function checkWandAltar(ws, ng, x, y, biome) {
  if (!ALTAR_SPAWN_DATA[biome]) {
    return null;
  }
  const prng2 = new NollaPrng(0);
  if (ALTAR_SPAWN_DATA[biome].gx !== void 0 && ALTAR_SPAWN_DATA[biome].gy !== void 0) {
    x += ALTAR_SPAWN_DATA[biome].gx;
    y += ALTAR_SPAWN_DATA[biome].gy;
  }
  if (ALTAR_SPAWN_DATA[biome].r0 !== void 0) {
    let r0 = prng2.ProceduralRandom(ws + ng, x, y);
    if (r0 < ALTAR_SPAWN_DATA[biome].r0) {
      return null;
    }
  }
  let tx = x + ALTAR_SPAWN_DATA[biome].xoff;
  let ty = y + ALTAR_SPAWN_DATA[biome].yoff;
  if (ALTAR_SPAWN_DATA[biome].tx !== void 0 && ALTAR_SPAWN_DATA[biome].ty !== void 0) {
    tx = x + ALTAR_SPAWN_DATA[biome].tx;
    ty = y + ALTAR_SPAWN_DATA[biome].ty;
  }
  let r = prng2.ProceduralRandom(ws + ng, tx, ty);
  if (ALTAR_SPAWN_DATA[biome].rl !== void 0 && r < ALTAR_SPAWN_DATA[biome].rl) {
    return null;
  }
  if (ALTAR_SPAWN_DATA[biome].rg !== void 0 && r >= ALTAR_SPAWN_DATA[biome].rg) {
    if (ALTAR_SPAWN_DATA[biome].ru !== void 0 && r < ALTAR_SPAWN_DATA[biome].ru) {
      return "utility_box";
    }
    return null;
  }
  return true;
}
function spawnWandAltar(ws, ng, x, y, biome, perks = {}, gameMode = "normal") {
  if (!ALTAR_SPAWN_DATA[biome]) {
    return null;
  }
  if (ALTAR_SPAWN_DATA[biome].gx !== void 0 && ALTAR_SPAWN_DATA[biome].gy !== void 0) {
    x += ALTAR_SPAWN_DATA[biome].gx;
    y += ALTAR_SPAWN_DATA[biome].gy;
  }
  const prng2 = new NollaPrng(0);
  let r0 = 1;
  if (ALTAR_SPAWN_DATA[biome].r0 !== void 0) {
    r0 = prng2.ProceduralRandom(ws + ng, x, y);
    if (r0 < ALTAR_SPAWN_DATA[biome].r0) {
      return null;
    }
  }
  let tx = x + ALTAR_SPAWN_DATA[biome].xoff;
  let ty = y + ALTAR_SPAWN_DATA[biome].yoff;
  if (ALTAR_SPAWN_DATA[biome].tx !== void 0 && ALTAR_SPAWN_DATA[biome].ty !== void 0) {
    tx = x + ALTAR_SPAWN_DATA[biome].tx;
    ty = y + ALTAR_SPAWN_DATA[biome].ty;
  }
  let r = prng2.ProceduralRandom(ws + ng, tx, ty);
  if (ALTAR_SPAWN_DATA[biome].rl !== void 0 && r < ALTAR_SPAWN_DATA[biome].rl) {
    return null;
  }
  if (ALTAR_SPAWN_DATA[biome].rg !== void 0 && r >= ALTAR_SPAWN_DATA[biome].rg) {
    if (ALTAR_SPAWN_DATA[biome].ru !== void 0 && r < ALTAR_SPAWN_DATA[biome].ru) {
      return generateUtilityBox(ws, ng, x, y, perks, gameMode);
    }
    return null;
  }
  let wandTypeName = getWandType(ws, ng, Math.floor(x + ALTAR_SPAWN_DATA[biome].x), Math.floor(y + ALTAR_SPAWN_DATA[biome].y), biome);
  if (!wandTypeName) {
    console.log(`Failed to get wand type for spawn at (${x}, ${y}) in biome ${biome}`);
    return null;
  }
  let wandX = Math.floor(x + ALTAR_SPAWN_DATA[biome].x);
  let wandY = Math.floor(y + ALTAR_SPAWN_DATA[biome].y) + 5;
  let wand = generateWand(ws, ng, wandX, wandY, wandTypeName, perks);
  if (appSettings.debugRngInfo) {
    wand["r"] = r;
    wand["r0"] = r0;
  }
  return wand;
}
function spawnWand(ws, ng, x, y, biome, perks = {}) {
  let offsetX = 0;
  let offsetY = 0;
  let wandTypeName = getWandType(ws, ng, Math.floor(x + offsetX), Math.floor(y + offsetY), biome);
  if (!wandTypeName) {
    console.log(`Failed to get wand type for spawn at (${x}, ${y}) in biome ${biome}`);
    return null;
  }
  let wandX = Math.floor(x + offsetX);
  let wandY = Math.floor(y + offsetY) + 5;
  let wand = generateWand(ws, ng, wandX, wandY, wandTypeName, perks);
  return wand;
}
var WAND_DEBUG = false;
if (WAND_DEBUG) {
  console.log("--- Initial Test ---");
  let temp_seed = 8;
  let base_x = -1465;
  let base_y = 509;
  let max_search = 10;
  for (let i = -max_search; i < max_search; i++) {
    for (let j = -max_search; j < max_search; j++) {
      let x = base_x + i;
      let y = base_y + j;
      let wand = spawnWandAltar(temp_seed, 0, x, y, "coalmine_alt", {}, "normal");
      let wandText = JSON.stringify(wand);
      if (wandText.includes('["AIR_BULLET"]')) {
        console.log(i, j, x, y, JSON.stringify(wand));
      }
    }
  }
}
function generateLevel1Wand(ws, ng, x, y, type) {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  let index = parseInt(type.split("_")[1]) - 1;
  let gun_reference = PREMADE_WANDS[index % PREMADE_WANDS.length];
  let gun = JSON.parse(JSON.stringify(gun_reference));
  gun["cards"] = [];
  gun["is_rare"] = 0;
  gun["wand_type"] = type;
  gun["force_unshuffle"] = 0;
  let reload_time = gun["reload_time"];
  let fire_rate_wait = gun["fire_rate_wait"];
  let spread_degrees = gun["spread_degrees"];
  let deck_capacity = gun["deck_capacity"];
  let total = reload_time + fire_rate_wait + spread_degrees;
  total += prng2.Random(-10, 20);
  let level_1_cards = [
    "LIGHT_BULLET",
    "RUBBER_BALL",
    "ARROW",
    "DISC_BULLET",
    "BOUNCY_ORB",
    "BULLET",
    "AIR_BULLET",
    "SLIMEBALL"
  ];
  let card_count = prng2.Random(1, 5);
  if (prng2.Random(1, 100) <= 85) {
    level_1_cards.push("BUBBLESHOT");
    if (prng2.Random(1, 100) <= 70) {
      level_1_cards.push("SPITTER");
      if (prng2.Random(1, 100) <= 40) {
        level_1_cards.push("LIGHT_BULLET_TRIGGER");
        card_count = 1;
        if (prng2.Random(1, 100) <= 20) {
          level_1_cards.push("DISC_BULLET_BIG");
          if (prng2.Random(1, 100) <= 10) {
            level_1_cards.push("TENTACLE_PORTAL");
            if (prng2.Random(1, 100) <= 10) {
              level_1_cards.push("BLACK_HOLE_BIG");
            }
          }
        }
      }
    }
  }
  if (total > 50) {
    level_1_cards = ["GRENADE", "BOMB", "ROCKET"];
    if (prng2.Random(1, 100) <= 75) {
      level_1_cards.push("DYNAMITE");
      if (prng2.Random(1, 100) <= 50) {
        level_1_cards.push("FIREBALL");
        if (prng2.Random(1, 100) <= 40) {
          level_1_cards.push("ACIDSHOT");
          if (prng2.Random(1, 100) <= 30) {
            level_1_cards.push("GLITTER_BOMB");
            if (prng2.Random(1, 100) <= 30) {
              level_1_cards.push("MINE");
            }
          }
        }
      }
    }
    card_count = 1;
  }
  let do_util = prng2.Random(0, 100);
  if (do_util < 30) {
    level_1_cards = [
      "CLOUD_WATER",
      "X_RAY",
      "FREEZE_FIELD",
      "BLACK_HOLE",
      "TORCH",
      "SHIELD_FIELD"
    ];
    if (prng2.Random(1, 100) <= 75) {
      level_1_cards.push("ELECTROCUTION_FIELD");
      if (prng2.Random(1, 100) <= 50) {
        level_1_cards.push("DIGGER");
        if (prng2.Random(1, 100) <= 50) {
          level_1_cards.push("TORCH_ELECTRIC");
          if (prng2.Random(1, 100) <= 50) {
            level_1_cards.push("POWERDIGGER");
            if (prng2.Random(1, 100) <= 50) {
              level_1_cards.push("SOILBALL");
              if (prng2.Random(1, 100) <= 50) {
                level_1_cards.push("LUMINOUS_DRILL");
                if (prng2.Random(1, 100) <= 50) {
                  level_1_cards.push("CHAINSAW");
                }
              }
            }
          }
        }
      }
    }
    card_count = 1;
  }
  if (card_count > deck_capacity) card_count = deck_capacity;
  let cardIndex = prng2.Random(0, level_1_cards.length - 1);
  let card = level_1_cards[cardIndex];
  for (let i = 0; i < card_count; i++) {
    gun["cards"].push(card);
  }
  return gun;
}
function spawnSpecialWand(ws, ng, x, y, type) {
  let wandX = Math.floor(x);
  let wandY = Math.floor(y);
  let wandType = "wand_level_01";
  if (type === "ruusu") {
    wandType = "wand_level_02";
  }
  if (type === "kiekurakeppi") {
    wandType = "wand_unshuffle_02";
  }
  if (type === "valtikka") {
    wandType = "wand_level_03";
  }
  if (type === "vasta") {
    wandType = "wand_level_03_better";
  }
  if (type === "vihta") {
    wandType = "wand_level_03_better";
  }
  if (type === "arpaluu") {
    wandType = "wand_unshuffle_05";
  }
  if (type === "varpuluuta") {
    wandType = "wand_level_05_better";
  }
  let wand = generateWand(ws, ng, wandX, wandY, wandType);
  if (type === "ruusu") {
    wand["name"] = "Ruusu";
    wand["sprite"] = "custom/plant_01";
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 16, y: 0 };
  }
  if (type === "kiekurakeppi") {
    wand["name"] = "Kiekurakeppi";
    wand["sprite"] = "custom/wood_01";
    wand["always_casts"].push("KNOCKBACK");
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 14, y: 0 };
  }
  if (type === "valtikka") {
    wand["name"] = "Valtikka";
    wand["sprite"] = "custom/scepter_01";
    wand["always_casts"].push("PIERCING_SHOT");
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 16, y: 0 };
  }
  if (type === "vasta") {
    wand["name"] = wand["name"].substring(0, wand["name"].length - 5) + " Vasta";
    wand["sprite"] = "custom/vasta";
    wand["always_casts"].push("HITFX_CRITICAL_WATER");
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 18, y: 0 };
  }
  if (type === "vihta") {
    wand["name"] = wand["name"].substring(0, wand["name"].length - 5) + " Vihta";
    wand["sprite"] = "custom/vihta";
    wand["always_casts"].push("HITFX_EXPLOSION_ALCOHOL");
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 17, y: 0 };
  }
  if (type === "arpaluu") {
    wand["name"] = "Arpaluu";
    wand["sprite"] = "custom/skull_01";
    wand["always_casts"].push("EXPLOSION_REMOVE");
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 21, y: 0 };
  }
  if (type === "varpuluuta") {
    wand["name"] = wand["name"].substring(0, wand["name"].length - 5) + " Varpuluuta";
    wand["sprite"] = "custom/plant_02";
    wand["grip"] = { x: 0, y: 0 };
    wand["tip"] = { x: 22, y: 0 };
  }
  wand["x"] = wandX;
  wand["y"] = wandY;
  wand["r"] = 0;
  wand["type"] = "wand";
  wand["item"] = "wand";
  return wand;
}
var nightmareExceptions = [
  "data/entities/animals/eel.xml",
  "data/entities/animals/meatmaggot.xml",
  "data/entities/animals/worm.xml",
  "data/entities/animals/worm_big.xml",
  "data/entities/animals/worm_tiny.xml",
  "data/entities/animals/worm_end.xml",
  "data/entities/animals/worm_skull.xml",
  "data/entities/animals/boss_dragon.xml",
  "data/entities/animals/maggot_tiny/maggot_tiny.xml",
  "data/entities/animals/darkghost.xml",
  "data/entities/animals/ghost.xml",
  "data/entities/animals/chest_leggy.xml",
  "data/entities/animals/boss_centipede/boss_centipede.xml",
  "data/entities/animals/boss_limbs/boss_limbs.xml",
  "data/entities/animals/boss_limbs/boss_limbs_physics.xml",
  "data/entities/animals/boss_meat/boss_meat.xml",
  "data/entities/animals/boss_pit/boss_pit.xml",
  "data/entities/animals/boss_robot/boss_robot.xml",
  "data/entities/animals/lukki/lukki.xml",
  "data/entities/animals/lukki/lukki_creepy.xml",
  "data/entities/animals/lukki/lukki_creepy_long.xml",
  "data/entities/animals/lukki/lukki_dark.xml",
  "data/entities/animals/lukki/lukki_longleg.xml",
  "data/entities/animals/lukki/lukki_tiny.xml",
  "data/entities/animals/parallel/tentacles/parallel_tentacles.xml"
];
function generateNightmareWand(ws, ng, x, y, entity, perks = {}) {
  if (!entity.includes("data/entities/animals/")) return null;
  if (nightmareExceptions.includes(entity)) return null;
  const prng2 = new NollaPrng(0);
  x = roundHalfOfEven(x);
  y = roundHalfOfEven(y);
  prng2.SetRandomSeed(ws + ng, x, y);
  let wandLevel = Math.floor(y / (512 * 4));
  if (wandLevel < 2) wandLevel = 2;
  if (wandLevel > 6 && wandLevel < 8) wandLevel = 6;
  if (wandLevel > 6) wandLevel = 10;
  if (prng2.Random(1, 100) < 50) {
    return generateWand(ws, ng, x, y, `wand_level_${wandLevel.toString().padStart(2, "0")}`, perks);
  } else {
    return generateWand(ws, ng, x, y, `wand_unshuffle_${wandLevel.toString().padStart(2, "0")}`, perks);
  }
}

// vendor/noita-telescope-main/js/chest_generation.js
function spawnChest(ws, ng, x, y, isTower = false, perks = {}, gameMode = "normal") {
  let prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  let greedCurse = perks["greedCurse"] ? perks["greedCurse"] : false;
  let great_chest_rate = 2e3;
  if (greedCurse) great_chest_rate = 100;
  if (isTower) great_chest_rate = 100;
  let rnd = prng2.Random(1, great_chest_rate);
  if (rnd >= great_chest_rate - 1) {
    return generateGreatChest(ws, ng, x, y, perks, gameMode);
  } else {
    return generateChest(ws, ng, x, y, perks, gameMode);
  }
}
function generateGreatChest(ws, ng, x, y, perks = {}, gameMode = "normal") {
  const prng2 = new NollaPrng(0);
  const noMoreShuffle = perks["noMoreShuffle"] || false;
  prng2.SetRandomSeed(ws + ng, roundRNGPos(x), roundRNGPos(y));
  let items = [];
  let count = 1;
  if (prng2.Random(0, 1e5) >= 1e5) {
    count = 0;
    if (prng2.Random(0, 1e3) === 999) {
      items.push({ type: "item", item: "true_orb", x, y });
    } else {
      items.push({ type: "item", item: "sampo", x, y });
    }
  }
  while (count > 0) {
    count--;
    let rnd = prng2.Random(1, 100);
    if (rnd <= 10) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 30) {
        let dupPotion = createPotion(ws, ng, x, y, "normal", gameMode);
        items.push(dupPotion);
        items.push(dupPotion);
        items.push(createPotion(ws, ng, x, y, "secret", gameMode));
      } else {
        let dupPotion = createPotion(ws, ng, x, y, "secret", gameMode);
        items.push(dupPotion);
        items.push(dupPotion);
        items.push(createPotion(ws, ng, x, y, "random", gameMode));
      }
    } else if (rnd <= 15) {
      items.push({ type: "item", item: "gold", amount: 1e3, x, y });
    } else if (rnd <= 18) {
      rnd = prng2.Random(1, 30);
      if (rnd === 30) {
        items.push({ type: "item", item: "kakkakikkare", x, y });
      } else {
        items.push({ type: "item", item: "vuoksikivi", x, y });
      }
    } else if (rnd <= 39) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 25) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_04"], false, noMoreShuffle));
      } else if (rnd <= 50) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_04"], false, noMoreShuffle));
      } else if (rnd <= 75) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_05"], false, noMoreShuffle));
      } else if (rnd <= 90) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_05"], false, noMoreShuffle));
      } else if (rnd <= 96) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_06"], false, noMoreShuffle));
      } else if (rnd <= 98) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_06"], false, noMoreShuffle));
      } else if (rnd <= 99) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_06"], false, noMoreShuffle));
      } else {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_10"], false, noMoreShuffle));
      }
    } else if (rnd <= 60) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 89) {
        items.push({ type: "item", item: "heart", x, y });
      } else if (rnd <= 99) {
        items.push({ type: "item", item: "heart_bigger", x, y });
      } else {
        items.push({ type: "item", item: "full_heal", x, y });
      }
    } else if (rnd <= 98) {
      count += 2;
    } else {
      count += 3;
    }
  }
  let dedupedItems = [];
  for (let item of items) {
    let found = false;
    for (let deduped of dedupedItems) {
      if (isDuplicateObject(deduped, item)) {
        deduped.count = (deduped.count || 1) + 1;
        found = true;
        break;
      }
    }
    if (!found) {
      dedupedItems.push(item);
    }
  }
  return { type: "great_chest", items: dedupedItems, x, y };
}
function generateChest(ws, ng, x, y, perks = {}, gameMode = "normal") {
  const noMoreShuffle = perks["noMoreShuffle"] || false;
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, roundRNGPos(x) + 509.7, roundRNGPos(y) + 683.1);
  let items = [];
  let count = 1;
  while (count > 0) {
    count--;
    let rnd = prng2.Random(1, 100);
    if (rnd <= 7) {
      items.push({ type: "item", item: "bomb", x, y });
    } else if (rnd <= 40) {
      let totalGold = 0;
      let amount;
      rnd = prng2.Random(0, 100);
      if (rnd <= 80) {
        amount = 7;
      } else if (rnd <= 95) {
        amount = 10;
      } else {
        amount = 20;
      }
      rnd = prng2.Random(0, 100);
      if (rnd > 30 && rnd <= 80) {
        prng2.Next();
        prng2.Next();
        totalGold += 50;
      } else if (rnd <= 95) {
        prng2.Next();
        prng2.Next();
        totalGold += 200;
      } else if (rnd <= 99) {
        prng2.Next();
        prng2.Next();
        totalGold += 1e3;
      } else {
        let tamount = prng2.Random(1, 3);
        for (let i = 0; i < tamount; i++) {
          prng2.Next();
          prng2.Next();
          totalGold += 50;
        }
        if (prng2.Random(0, 100) > 50) {
          tamount = prng2.Random(1, 3);
          for (let i = 0; i < tamount; i++) {
            prng2.Next();
            prng2.Next();
            totalGold += 200;
          }
        }
        if (prng2.Random(0, 100) > 80) {
          tamount = prng2.Random(1, 3);
          for (let i = 0; i < tamount; i++) {
            prng2.Next();
            prng2.Next();
            totalGold += 1e3;
          }
        }
      }
      for (let i = 0; i < amount; i++) {
        prng2.Next();
        prng2.Next();
        totalGold += 10;
      }
      items.push({ type: "item", item: "gold", amount: totalGold, x, y });
    } else if (rnd <= 50) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 94) {
        items.push(createPotion(ws, ng, x + 510, y + 683, "normal", gameMode));
      } else if (rnd <= 98) {
        items.push(createPowderPouch(ws, ng, x + 510, y + 683));
      } else {
        rnd = prng2.Random(0, 100);
        if (rnd <= 98) {
          items.push(createPotion(ws, ng, x + 510, y + 683, "secret", gameMode));
        } else {
          items.push(createPotion(ws, ng, x + 510, y + 683, "random", gameMode));
        }
      }
    } else if (rnd <= 54) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 98) {
        items.push({ type: "item", item: "spell_refresh", x, y });
      } else {
        items.push({ type: "item", item: "refresh_mimic", x, y });
      }
    } else if (rnd <= 60) {
      const opts = ["kammi", "kuu", "ukkoskivi", "paha_silma", "kiuaskivi", "???", "chaos_die", "shiny_orb"];
      let selected = prng2.Random(0, opts.length - 1);
      if (opts[selected] == "???") {
        const runestoneOpts = ["runestone_light", "runestone_fire", "runestone_magma", "runestone_weight", "runestone_emptiness", "runestone_edges", "runestone_metal"];
        selected = prng2.Random(0, runestoneOpts.length - 1);
        items.push({ type: "item", item: runestoneOpts[selected], x, y });
      } else {
        if (opts[selected] == "chaos_die") {
          let unlocked = unlockedSpells[363];
          if (unlocked) {
            if (perks["greedCurse"]) {
              items.push({ type: "item", item: "greed_die", x, y });
            } else {
              items.push({ type: "item", item: "chaos_die", x, y });
            }
          } else {
            items.push({ type: "item", item: "blocked_by_unlock", x, y });
            items.push(createPotion(ws, ng, x, y - 12, "normal", gameMode));
          }
        } else if (opts[selected] == "shiny_orb") {
          if (perks["greedCurse"]) {
            items.push({ type: "item", item: "greed_orb", x, y });
          } else {
            items.push({ type: "item", item: "shiny_orb", x, y });
          }
        } else {
          items.push({ type: "item", item: opts[selected], x, y });
        }
      }
    } else if (rnd <= 65) {
      let amount = 1;
      let rnd2 = prng2.Random(0, 100);
      if (rnd2 <= 50) {
        amount = 1;
      } else if (rnd2 <= 70) {
        amount += 1;
      } else if (rnd2 <= 80) {
        amount += 2;
      } else if (rnd2 <= 90) {
        amount += 3;
      } else {
        amount += 4;
      }
      for (let i = 0; i < amount; i++) {
        prng2.Next();
        items.push({ type: "item", item: "spell", spell: MakeRandomSpell(prng2), x, y });
      }
    } else if (rnd <= 84) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 25) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_01"], true, noMoreShuffle));
      } else if (rnd <= 50) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_01"], true, noMoreShuffle));
      } else if (rnd <= 75) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_02"], true, noMoreShuffle));
      } else if (rnd <= 90) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_02"], true, noMoreShuffle));
      } else if (rnd <= 96) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_03"], true, noMoreShuffle));
      } else if (rnd <= 98) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_03"], true, noMoreShuffle));
      } else if (rnd <= 99) {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_level_04"], true, noMoreShuffle));
      } else {
        items.push(createWand(ws, ng, x, y, WAND_TYPES["wand_unshuffle_04"], true, noMoreShuffle));
      }
    } else if (rnd <= 95) {
      rnd = prng2.Random(0, 100);
      if (rnd <= 88) {
        items.push({ type: "item", item: "heart", x, y });
      } else if (rnd <= 89) {
        items.push({ type: "item", item: "heart_mimic", x, y });
      } else if (rnd <= 99) {
        items.push({ type: "item", item: "heart_bigger", x, y });
      } else {
        items.push({ type: "item", item: "full_heal", x, y });
      }
    } else if (rnd <= 98) {
      items.push({ type: "item", item: "gold", amount: 200, x, y });
    } else if (rnd <= 99) {
      count += 2;
    } else {
      count += 3;
    }
  }
  let dedupedItems = [];
  for (let item of items) {
    let found = false;
    for (let deduped of dedupedItems) {
      if (isDuplicateObject(deduped, item)) {
        if (deduped.amount && item.amount) deduped.amount += item.amount;
        deduped.count = (deduped.count || 1) + 1;
        found = true;
        break;
      }
    }
    if (!found) {
      dedupedItems.push(item);
    }
  }
  return { type: "chest", items: dedupedItems, x, y };
}

// vendor/noita-telescope-main/js/heart_generation.js
function spawnHeart(ws, ng, x, y, biome, perks = {}, gameMode = "normal") {
  let prng2 = new NollaPrng(0);
  let r = prng2.ProceduralRandom(ws + ng, x, y);
  let heart_spawn_rate = 0.7;
  if (appSettings.date.month === 2 && appSettings.date.day === 14) {
    heart_spawn_rate = 0.35;
  }
  if (r > heart_spawn_rate) {
    return { type: "item", item: "heart", x, y };
  } else if (r > 0.3) {
    prng2.SetRandomSeed(ws + ng, x + 45, y - 2123);
    let rnd = prng2.Random(1, 100);
    if (rnd <= 90 || y < 512 * 3) {
      rnd = prng2.Random(1, 1e3);
      if (prng2.Random(1, 300) == 1) {
      }
      if (rnd >= 1e3) {
        return generateGreatChest(ws, ng, x, y, perks, gameMode);
      } else {
        return generateChest(ws, ng, x, y, perks, gameMode);
      }
    } else {
      rnd = prng2.Random(1, 100);
      if (prng2.Random(1, 30) == 1) {
      }
      if (rnd <= 95) {
        return { type: "item", item: "mimic", x, y };
      } else {
        return { type: "item", item: "chest_leggy", x, y };
      }
    }
  } else {
    return null;
  }
}

// vendor/noita-telescope-main/js/misc_generation.js
var eyeRoomPos = { x: -3850, y: 5400 };
var eyeRoomSpellPositions = [
  { x: -3992, y: 5380 },
  { x: -3971, y: 5397 },
  { x: -3949, y: 5414 },
  { x: -3926, y: 5428 },
  { x: -3758, y: 5424 },
  { x: -3735, y: 5410 },
  { x: -3713, y: 5393 },
  { x: -3692, y: 5376 }
];
function generateEyeRoom(ws, ng, pwIndex, gameMode = "normal") {
  let prng2 = new NollaPrng(0);
  let spells = [];
  const worldSize = getWorldSize(ng > 0, gameMode);
  for (let i = 0; i < eyeRoomSpellPositions.length; i++) {
    let pos = eyeRoomSpellPositions[i];
    let x = pos.x + pwIndex * 512 * worldSize;
    let y = pos.y;
    prng2.SetRandomSeed(ws + ng, x, y);
    spells.push({ type: "item", item: "spell", spell: MakeRandomSpell(prng2), x, y });
  }
  let roomX = eyeRoomPos.x + pwIndex * 512 * worldSize;
  let roomY = eyeRoomPos.y;
  return { type: "eye_room", items: spells, x: roomX, y: roomY, biome: "snowcastle_hourglass_chamber" };
}
var hourglassBasePosition = {
  "left": { x: -5 * 512 + 50, y: 10 * 512 },
  "right": { x: 3 * 512 - 50, y: 10 * 512 }
};
var hourglassSpellPositions = {
  "left": [
    { x: 134, y: 361 },
    { x: 158, y: 361 },
    { x: 182, y: 361 },
    { x: 206, y: 361 }
  ],
  "right": [
    { x: 305, y: 361 },
    { x: 329, y: 361 },
    { x: 353, y: 361 },
    { x: 377, y: 361 }
  ]
};
function generateHourglassShop(ws) {
  const prng2 = new NollaPrng(0);
  const is_right = prng2.ProceduralRandom(ws, 0, 0) > 0.5;
  const baseX = is_right ? hourglassBasePosition.right.x : hourglassBasePosition.left.x;
  const baseY = is_right ? hourglassBasePosition.right.y : hourglassBasePosition.left.y;
  const spellPositions = is_right ? hourglassSpellPositions.right : hourglassSpellPositions.left;
  let spells = [];
  for (let i = 0; i < spellPositions.length; i++) {
    let pos = spellPositions[i];
    let x = baseX + pos.x;
    let y = baseY + pos.y;
    prng2.SetRandomSeed(ws, x, y);
    spells.push({ type: "item", item: "spell", spell: GetRandomAction(ws, 0, x, y, 2, 0), x, y });
  }
  return { type: "shop", items: spells, x: baseX + 256, y: baseY + 256, side: is_right ? "right" : "left", biome: "snowcastle_cavern" };
}
var meditationCubePosition = { x: -9 * 512 + 350, y: 4 * 512 + 303 };
function generateMeditationCube(ws, ng, pwIndex, perks = {}, gameMode = "normal") {
  const worldSize = getWorldSize(ng > 0, gameMode);
  const x = meditationCubePosition.x + pwIndex * 512 * worldSize;
  const y = meditationCubePosition.y;
  const wand = spawnWandAltar(ws, ng, x, y, "excavationsite_cube_chamber", perks, gameMode);
  wand["biome"] = "excavationsite_cube_chamber";
  return wand;
}
var snowyRoomPositions = [
  { x: 7 * 512 + 333, y: 8 * 512 + 297 },
  { x: 7 * 512 + 439, y: 8 * 512 + 324 }
];
function generateSnowyRoom(ws, pwIndex, perks = {}, gameMode = "normal") {
  let wands = [];
  for (let i = 0; i < snowyRoomPositions.length; i++) {
    const pos = snowyRoomPositions[i];
    const x = pos.x + pwIndex * 512 * 70;
    const y = pos.y;
    const wand = spawnWandAltar(ws, 0, x, y, "snowcave_secret_chamber", perks, gameMode);
    wand["biome"] = "snowcave_secret_chamber";
    wands.push(wand);
  }
  return wands;
}
var robotEggPosition = { x: -10 * 512 + 390, y: 29 * 512 + 313 };
function generateRobotEgg(ws, ng, pwIndex, perks = {}, gameMode = "normal") {
  const worldSize = getWorldSize(ng > 0, gameMode);
  const x = robotEggPosition.x + pwIndex * 512 * worldSize;
  const y = robotEggPosition.y;
  const wandType = getWandType(ws, ng, x + 5, y, "robot_egg");
  const prng2 = new NollaPrng(0);
  let px = x + 5 - 4 + prng2.ProceduralRandom(ws + ng, x + 1 + 5, y + 5) * 8;
  let py = y + 5 - 4 + prng2.ProceduralRandom(ws + ng, x + 1 + 5, y + 5) * 8;
  const wand = generateWand(ws, ng, roundHalfOfEven(px), roundHalfOfEven(py), wandType, perks);
  wand["biome"] = "robot_egg";
  return wand;
}
function generatePortal(ws) {
  const biomeXMin = -2450;
  const biomeXMax = 1900;
  const biomeYMin = 6700;
  const biomeYMax = 8e3;
  const prng2 = new NollaPrng(0);
  const px = biomeXMin + prng2.ProceduralRandom(ws, 209, 13) * (biomeXMax - biomeXMin);
  const py = biomeYMin + prng2.ProceduralRandom(ws, 211, 1.9) * (biomeYMax - biomeYMin);
  return { type: "item", item: "portal", x: px, y: py, biome: "rainforest" };
}
var triangleBossBasePosition = { x: 5 * 512 + 271, y: 22 * 512 + 242 + 55 };
var triangleBossOffsets = [
  { x: 0, y: 0 },
  { x: -52, y: -8 },
  { x: 52, y: -8 },
  { x: -8, y: -60 }
];
function generateTriangleBossDrops(ws, pwIndex) {
  const prng2 = new NollaPrng(0);
  let spells = [];
  for (let i = 0; i < triangleBossOffsets.length; i++) {
    prng2.SetRandomSeed(ws, i, 10 + pwIndex);
    const spell = MakeRandomSpell(prng2);
    spells.push({ type: "item", item: "spell", spell, x: triangleBossBasePosition.x + pwIndex * 512 * 70, y: triangleBossBasePosition.y });
  }
  return { type: "triangle_boss", items: spells, x: triangleBossBasePosition.x + pwIndex * 512 * 70, y: triangleBossBasePosition.y, biome: "wizardcave_entrance" };
}
var alchemistBossPosition = { x: -10 * 512 + 256, y: 1 * 512 + 256 };
function generateAlchemistBossDrops(ws, pwIndex) {
  let opts = ["ALPHA", "OMEGA", "GAMMA", "MU", "ZETA", "PHI", "TAU", "SIGMA"];
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws, pwIndex, 60);
  let spells = [];
  prng2.Next();
  for (let i = 1; i <= 4; i++) {
    let rnd = prng2.Random(1, opts.length);
    let opt = opts[rnd - 1];
    opts.splice(rnd - 1, 1);
    spells.push({ type: "item", item: "spell", spell: opt, x: alchemistBossPosition.x + pwIndex * 512 * 70, y: alchemistBossPosition.y });
  }
  return { type: "alchemist_boss", items: spells, x: alchemistBossPosition.x + pwIndex * 512 * 70, y: alchemistBossPosition.y, biome: "secret_lab" };
}
var pyramidBossPosition = { x: 19 * 512 + 256, y: -2 * 512 + 256 };
function generatePyramidBossDrops(ws, pwIndex) {
  let opts = ["NOLLA", "DAMAGE_RANDOM", "RANDOM_SPELL", "RANDOM_PROJECTILE", "RANDOM_MODIFIER", "RANDOM_STATIC_PROJECTILE", "DRAW_RANDOM", "DRAW_RANDOM_X3", "DRAW_3_RANDOM"];
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws, pwIndex, 44);
  let spells = [];
  prng2.Next();
  for (let i = 1; i <= 4; i++) {
    let rnd = prng2.Random(1, opts.length);
    let opt = opts[rnd - 1];
    opts.splice(rnd - 1, 1);
    spells.push({ type: "item", item: "spell", spell: opt, x: pyramidBossPosition.x + pwIndex * 512 * 70, y: pyramidBossPosition.y });
  }
  return { type: "pyramid_boss", items: spells, x: pyramidBossPosition.x + pwIndex * 512 * 70, y: pyramidBossPosition.y, biome: "pyramid_top" };
}
var dragonBossPosition = { x: 4 * 512 + 296, y: 14 * 512 + 305 };
function generateDragonBossDrops(ws, pwIndex) {
  const x = dragonBossPosition.x + pwIndex * 512 * 70;
  return getDragonDrops(ws, 0, "dragoncave", x, dragonBossPosition.y);
}
function getDragonDrops(worldSeed, ngPlusCount, biomeName, x, y, perks = {}, gameMode = "normal") {
  let drops = [];
  drops.push({ type: "item", item: "heart", x: x - 16, y });
  let wand = generateWand(worldSeed, ngPlusCount, x + 16, y, "wand_unshuffle_06", perks);
  drops.push(wand);
  let opts = ["ORBIT_DISCS", "ORBIT_FIREBALLS", "ORBIT_LASERS", "ORBIT_LARPA"];
  const count = 1;
  const prng2 = new NollaPrng(0);
  const pwIndex = Math.floor((x + getWorldCenter(ngPlusCount > 0, gameMode) * 512) / (getWorldSize(ngPlusCount > 0, gameMode) * 512));
  prng2.SetRandomSeed(worldSeed + ngPlusCount, pwIndex, 540);
  for (let i = 0; i < count; i++) {
    let rnd = prng2.Random(1, opts.length);
    let opt = opts[rnd - 1];
    drops.push({ type: "item", item: "spell", spell: opt, x: x - 8 * count + (i - 0.5) * 16, y });
    opts.splice(rnd - 1, 1);
  }
  return { type: "dragon", items: drops, x, y, biome: biomeName };
}
function getTinyDrops(worldSeed, ngPlusCount, biomeName, x, y, perks = {}) {
  return { type: "tiny", items: [
    // TODO: Add hearts I guess, who cares
    generateWand(worldSeed, ngPlusCount, x - 16, y, "wand_unshuffle_06", perks),
    generateWand(worldSeed, ngPlusCount, x + 16, y, "wand_unshuffle_10", perks)
  ], x, y, biome: biomeName };
}
var baseEndShopPositionHeaven = { x: 0, y: -13954 };
var baseEndShopPositionHell = { x: 0, y: 24576 };
var endShopSpellPositions = [
  { x: 41, y: 148 },
  { x: 78, y: 148 },
  { x: 114, y: 148 },
  { x: 149, y: 148 },
  { x: 184, y: 148 },
  { x: 215, y: 148 }
];
function generateEndShop(ws, ng, direction) {
  if (direction != 1 && direction != -1) return null;
  const basePosition = direction == 1 ? baseEndShopPositionHell : baseEndShopPositionHeaven;
  const prng2 = new NollaPrng(0);
  let spells = [];
  for (let i = 0; i < endShopSpellPositions.length; i++) {
    let pos = endShopSpellPositions[i];
    let x = basePosition.x + pos.x;
    let y = basePosition.y + pos.y;
    prng2.SetRandomSeed(ws, ng, x, y);
    spells.push({ type: "item", item: "spell", spell: GetRandomAction(ws, ng, x, y, 10, 0), x, y });
  }
  return { type: "shop", items: spells, x: basePosition.x + 128, y: basePosition.y + 128, biome: direction == 1 ? "the_end" : "the_sky" };
}
var snowfallChance = 1 / 12;
var rainfallChance = 1 / 15;
var rain_duration_on_run_start = 4 * 60 * 60;
var rainTypes = [
  {
    type: "rain",
    chance: 1,
    // light rain
    rain_material: "water",
    rain_particles_min: 4,
    rain_particles_max: 7,
    rain_duration: rain_duration_on_run_start
  },
  {
    type: "rain_heavy",
    chance: 0.05,
    // heavy rain
    rain_material: "water",
    rain_particles_min: 10,
    rain_particles_max: 15,
    rain_duration: rain_duration_on_run_start / 2
  },
  {
    type: "blood",
    chance: 1e-3,
    rain_material: "blood",
    rain_particles_min: 10,
    rain_particles_max: 15,
    rain_duration: rain_duration_on_run_start / 2
  },
  {
    type: "acid",
    chance: 2e-4,
    rain_material: "acid",
    rain_particles_min: 10,
    rain_particles_max: 15,
    rain_duration: rain_duration_on_run_start / 2
  },
  {
    type: "slime",
    chance: 1e-4,
    rain_material: "slime",
    rain_particles_min: 1,
    rain_particles_max: 4,
    rain_duration: rain_duration_on_run_start / 2
  }
];
function getStartingLoadout(ws, isDaily = false, gameMode = "normal") {
  const x = 227;
  const y = -81;
  const prng2 = new NollaPrng(0);
  if (!isDaily) {
    prng2.SetRandomSeed(ws, 0, -11);
  } else {
    prng2.SetRandomSeed(ws, 0, 0);
  }
  const wand = {
    type: "wand",
    item: "wand",
    mana_max: prng2.Random(80, 130),
    deck_capacity: prng2.Random(2, 3),
    name: ["Bolt staff"][prng2.Random(0, 0)],
    reload_time: prng2.Random(20, 28),
    fire_rate_wait: prng2.Random(9, 15),
    mana_charge_speed: prng2.Random(25, 40),
    actions_per_round: 1,
    shuffle_deck_when_empty: 0,
    spread_degrees: 0,
    speed_multiplier: 1,
    sprite: "custom/handgun",
    always_casts: [],
    x,
    y,
    grip: { x: 3, y: 3 },
    tip: { x: 12, y: 3 }
  };
  let cards = [];
  const spellCount = Math.min(prng2.Random(1, 3), wand.deck_capacity);
  let spell = "LIGHT_BULLET";
  if (!isDaily) {
    if (prng2.Random(1, 100) < 50) {
      spell = ["SPITTER", "RUBBER_BALL", "BOUNCY_ORB"][prng2.Random(0, 2)];
    }
  } else {
    spell = ["LIGHT_BULLET", "SPITTER", "RUBBER_BALL", "BOUNCY_ORB"][prng2.Random(0, 3)];
  }
  for (let i = 0; i < spellCount; i++) {
    cards.push(spell);
  }
  wand["cards"] = cards;
  if (!isDaily) {
    prng2.SetRandomSeed(ws, -1, 0);
  } else {
    prng2.SetRandomSeed(ws, 0, 0);
  }
  const bomb_wand = {
    type: "wand",
    item: "wand",
    mana_max: prng2.Random(80, 110),
    deck_capacity: prng2.Random(1, 1),
    name: "Bomb wand",
    reload_time: prng2.Random(1, 10),
    fire_rate_wait: prng2.Random(3, 8),
    mana_charge_speed: prng2.Random(5, 20),
    actions_per_round: 1,
    shuffle_deck_when_empty: 1,
    spread_degrees: 0,
    speed_multiplier: 1,
    sprite: "custom/bomb_wand",
    always_casts: [],
    x,
    y,
    grip: { x: 3, y: 3 },
    tip: { x: 13, y: 3 }
  };
  let bombSpell = "BOMB";
  if (!isDaily) {
    let r = prng2.Random(1, 100);
    if (r < 50) {
      bombSpell = ["BOMB", "DYNAMITE", "MINE", "ROCKET", "GRENADE"][prng2.Random(0, 4)];
    }
  } else {
    bombSpell = ["BOMB", "DYNAMITE", "MINE", "ROCKET", "GRENADE"][prng2.Random(0, 4)];
  }
  bomb_wand["cards"] = [bombSpell];
  let potion = null;
  if (!isDaily) {
    prng2.SetRandomSeed(ws, -4.5, -4);
    let r = prng2.Random(1, 100);
    let material = "unknown";
    if (r <= 65) {
      r = prng2.Random(1, 100);
      if (r <= 10) material = "mud";
      else if (r <= 20) material = "water_swamp";
      else if (r <= 30) material = "water_salt";
      else if (r <= 40) material = "swamp";
      else if (r <= 50) material = "snow";
      else material = "water";
    } else if (r <= 70) material = "blood";
    else if (r <= 99) {
      r = prng2.Random(0, 100);
      material = ["acid", "magic_liquid_polymorph", "magic_liquid_random_polymorph", "magic_liquid_berserk", "magic_liquid_charm", "magic_liquid_movement_faster"][prng2.Random(0, 5)];
    } else {
      r = prng2.Random(0, 1e5);
      if (r === 666) material = "urine";
      else if (r === 79) material = "gold";
      else material = ["slime", "gunpowder_unstable"][prng2.Random(0, 1)];
    }
    const datetime = getDateAndTime();
    if (datetime.month === 5 && datetime.day === 1 || datetime.month === 4 && datetime.day === 30) {
      if (prng2.Random(0, 100) <= 20) material = "sima";
    }
    potion = {
      type: "item",
      item: "potion",
      material,
      x,
      y
    };
  } else {
    potion = createPotion(ws, 0, 0, 0, "normal", gameMode);
  }
  return { type: "starting_loadout", items: [wand, bomb_wand, potion], x, y, biome: null };
}

// vendor/noita-telescope-main/js/enemy_config.js
var COALMINE_ENEMIES = {
  small: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/zombie_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimeshooter_weak.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/longleg.xml"
    },
    {
      prob: 0.25,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_weak.xml"
    }
  ],
  big: [
    {
      prob: 0.7,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/firemage_weak.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm.xml"
    },
    {
      prob: 0.2,
      min_count: 5,
      max_count: 10,
      entity: "data/entities/animals/longleg.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/miner_weak.xml",
        "data/entities/animals/miner_weak.xml",
        "data/entities/animals/shotgunner_weak.xml"
      ]
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/acidshooter_weak.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter_weak.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fireskull.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shaman.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 2
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/slimeshooter_weak.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter_weak.xml"
    }
  ],
  unique2: [
    {
      prob: 1.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.85,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_weak.xml"
    },
    {
      prob: 0.5,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/miner_weak.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimeshooter_weak.xml"
    }
  ],
  unique3: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.7,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/firemage_weak.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage.xml"
    }
  ],
  fungi: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus_big.xml"
    }
  ],
  nest: [
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/flynest.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ]
};
var COALMINE_ALT_ENEMIES = {
  small: [
    {
      prob: 1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/zombie.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/frog.xml"
    },
    {
      prob: 0.3,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/miner_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/miner_fire.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml",
      ngpluslevel: 1
    }
  ],
  big: [
    {
      prob: 1.7,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/firemage_weak.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/miner.xml",
        "data/entities/animals/miner.xml",
        "data/entities/animals/shotgunner.xml"
      ]
    },
    {
      prob: 0.12,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fireskull.xml"
    },
    {
      prob: 0.2,
      min_count: 3,
      max_count: 5,
      entity: "data/entities/animals/frog.xml"
    },
    {
      prob: 0.13,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/frog_big.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/frog.xml",
        "data/entities/animals/frog.xml",
        "data/entities/animals/frog_big.xml"
      ]
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shaman.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_clusterbomb.xml",
      ngpluslevel: 1
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter.xml"
    }
  ],
  unique2: [
    {
      prob: 1.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.5,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/miner.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimeshooter.xml"
    }
  ],
  unique3: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/firemage_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage.xml"
    }
  ],
  fungi: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus.xml"
    }
  ],
  nest: [
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/flynest.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ]
};
var EXCAVATIONSITE_ENEMIES = {
  small: [
    {
      prob: 0.55,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/firebug.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 4,
      entity: "data/entities/animals/rat.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 5,
      entity: "data/entities/animals/bat.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/bigfirebug.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/goblin_bomb.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimespirit.xml"
    }
  ],
  big: [
    {
      prob: 0.98,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/miner.xml",
        "data/entities/animals/shotgunner.xml"
      ]
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/miner_fire.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fireskull.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/bigbat.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_mine.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/firebug.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/bigfirebug.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml",
      ngpluslevel: 1
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter.xml"
    }
  ],
  unique2: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/miner_santa.xml",
      spawn_check: "christmas"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner.xml"
    }
  ],
  unique3: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/firemage.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage.xml"
    }
  ],
  nest: [
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/firebugnest.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ]
};
var FUNGICAVE_ENEMIES = {
  small: [
    {
      prob: 0.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/zombie.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/rat.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/fungus.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/ant.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/blob.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tentacler.xml"
    },
    {
      prob: 0.11,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tentacler_small.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/tentacler_small.xml",
        "data/entities/animals/tentacler.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_invis.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/frog.xml",
        "data/entities/animals/frog.xml",
        "data/entities/animals/frog_big.xml"
      ]
    }
  ],
  big: [
    {
      prob: 0.7,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/fungus.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 3,
      max_count: 5,
      entity: "data/entities/animals/blob.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/bigzombie.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_poly.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/maggot.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/alchemist.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus_big.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.06,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/fungus.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/fungus_big.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimespirit.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/confusespirit.xml"
    }
  ],
  robots: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/roboguard.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drone_physics.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/assassin.xml"
    }
  ],
  nest: [
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/flynest.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/spidernest.xml"
    }
  ]
};
var SNOWCAVE_ENEMIES = {
  small: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 4,
      entity: "data/entities/animals/rat.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/iceskull.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_smg.xml",
        "data/entities/animals/scavenger_grenade.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 2,
      entity: "data/entities/animals/thundermage_big.xml"
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.15,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm_big.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/worm_tiny.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/iceskull.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giant.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/icemage.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/sniper.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/shotgunner.xml"
        }
      ]
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        }
      ]
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/coward.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        "data/entities/animals/scavenger_leader.xml"
      ]
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/monk.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thunderskull.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/scavenger_glue.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/easter/sniper.xml",
      spawn_check: "august24"
    }
  ],
  scavenger_party: [
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/coward.xml"
        },
        "data/entities/animals/scavenger_leader.xml"
      ]
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 1e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necromancer.xml"
    }
  ],
  unique2: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    }
  ],
  fish: [
    {
      prob: 1,
      min_count: 3,
      max_count: 4,
      entity: "data/entities/animals/fish_large.xml"
    },
    {
      prob: 5,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ]
};
var WANDCAVE_ENEMIES = {
  small: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wand_ghost.xml"
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/statue_physics.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_a.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_b.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necromancer.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_returner.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_glowing.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/enlightened_alchemist.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/weakspirit.xml",
      ngpluslevel: 1
    }
  ]
};
var SNOWCASTLE_ENEMIES = {
  small: [
    {
      prob: 0.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/scavenger_grenade.xml",
        "data/entities/animals/scavenger_smg.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 2e-3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_heal.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_lasership.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/coward.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_hell.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper_hell.xml",
      ngpluslevel: 2
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/drunk/scavenger_grenade.xml",
        "data/entities/animals/drunk/scavenger_smg.xml"
      ],
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/sniper.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/miner.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/shotgunner.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.002,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        "data/entities/animals/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/coward.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_heal.xml"
    },
    {
      prob: 5e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_clusterbomb.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/scavenger_heal.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/drone_lasership.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/coward.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.075,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml",
      ngpluslevel: 3
    },
    {
      prob: 2.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 2.1,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 2.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml",
      spawn_check: "jussi"
    },
    {
      prob: 2.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_clusterbomb.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/drunk/scavenger_heal.xml"
        }
      ],
      spawn_check: "jussi"
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 2e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/healerdrone_physics.xml"
    }
  ],
  unique2: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_heal.xml"
    },
    {
      prob: 2.6,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/drunk/scavenger_grenade.xml",
      spawn_check: "jussi"
    },
    {
      prob: 2.6,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/drunk/scavenger_smg.xml",
      spawn_check: "jussi"
    },
    {
      prob: 2.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/sniper.xml",
      spawn_check: "jussi"
    },
    {
      prob: 2.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml",
      spawn_check: "jussi"
    }
  ],
  turret: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/turret_right.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/turret_left.xml"
    }
  ]
};
var RAINFOREST_ENEMIES = {
  small: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/rainforest/fly.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_longleg.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/rainforest/shooterflower.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/scavenger_poison.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/scavenger_clusterbomb.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/projectiles/mine.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/bloom.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/shaman.xml"
    },
    {
      prob: 0.06,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/rainforest/scavenger_smg.xml",
        "data/entities/animals/rainforest/scavenger_grenade.xml",
        "data/entities/animals/rainforest/coward.xml"
      ]
    }
  ],
  big: [
    {
      prob: 0.6,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/rainforest/fungus.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_longleg.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/bloom.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/scavenger_mine.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/rainforest/scavenger_poison.xml",
        "data/entities/animals/rainforest/scavenger_clusterbomb.xml"
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/rainforest/scavenger_poison.xml",
        "data/entities/animals/rainforest/scavenger_clusterbomb.xml",
        "data/entities/animals/rainforest/scavenger_heal.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/projectiles/mine.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/shooterflower.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/spearbot.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        "data/entities/animals/rainforest/scavenger_poison.xml",
        "data/entities/animals/rainforest/scavenger_clusterbomb.xml",
        "data/entities/animals/rainforest/scavenger_leader.xml",
        "data/entities/animals/rainforest/coward.xml"
      ]
    }
  ],
  unique: [
    {
      prob: 1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/physics_cocoon.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/projectiles/mine.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/shooterflower.xml"
    }
  ],
  unique2: [
    {
      prob: 1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/lukki_eggs.xml"
    }
  ],
  large: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/shooterflower.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/rainforest/fungus.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/rainforest/bloom.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_longleg.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/rainforest/scavenger_clusterbomb.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/rainforest/scavenger_poison.xml"
        },
        "data/entities/animals/rainforest/scavenger_leader.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/projectiles/mine.xml"
    }
  ],
  scavengers: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/rainforest/scavenger_smg.xml",
        "data/entities/animals/rainforest/scavenger_grenade.xml"
      ]
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/flamer.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/sniper.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/scavenger_leader.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/projectiles/mine.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/rainforest/scavenger_mine.xml"
    }
  ],
  nest: [
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/flynest.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/spidernest.xml"
    }
  ]
};
var VAULT_ENEMIES = {
  small: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/drone_physics.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/lasershooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/roboguard.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/assassin.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tentacler.xml"
    },
    {
      prob: 0.12,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/tentacler_small.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/tentacler_small.xml",
        "data/entities/animals/vault/tentacler.xml"
      ]
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/acidshooter.xml"
    },
    {
      prob: 0.18,
      min_count: 3,
      max_count: 5,
      entity: "data/entities/animals/vault/blob.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/bigzombie.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/scavenger_mine.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/vault/sniper.xml",
        "data/entities/animals/vault/flamer.xml"
      ]
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/drone_lasership.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/monk.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/thunderskull.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/sniper.xml",
        "data/entities/animals/vault/coward.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/vault/scavenger_glue.xml"
    }
  ],
  big: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/firemage.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/thundermage.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_invis.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_shield.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/roboguard.xml",
        "data/entities/animals/vault/healerdrone_physics.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/wizard_dark.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/maggot.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/vault/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/vault/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 3,
          entity: "data/entities/animals/vault/scavenger_glue.xml"
        },
        "data/entities/animals/vault/scavenger_leader.xml",
        "data/entities/animals/vault/scavenger_heal.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tank.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tank_rocket.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tank_super.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/missilecrab.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/spearbot.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/flamer.xml",
        "data/entities/animals/vault/icer.xml",
        "data/entities/animals/vault/healerdrone_physics.xml"
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/roboguard.xml",
        "data/entities/animals/vault/healerdrone_physics.xml",
        "data/entities/animals/vault/coward.xml"
      ]
    },
    {
      prob: 0.075,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml",
      ngpluslevel: 2
    }
  ],
  turret: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_right.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_left.xml"
    }
  ]
};
var CRYPT_ENEMIES = {
  small: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/phantom_a.xml"
    },
    {
      prob: 0.3,
      min_count: 3,
      max_count: 4,
      entity: "data/entities/animals/crypt/skullrat.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/phantom_b.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/skullfly.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/crypt/tentacler.xml"
    },
    {
      prob: 0.15,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/crypt/tentacler_small.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/crypt/tentacler_small.xml",
        "data/entities/animals/crypt/tentacler.xml"
      ]
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/necromancer.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/crystal_physics.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/maggot.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/failed_alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_homing.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_weaken.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/weakspirit.xml",
      ngpluslevel: 1
    }
  ],
  big: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/thundermage.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/worm.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/phantom_a.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/worm_skull.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/skullfly.xml"
    },
    {
      prob: 0.3,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/crypt/skullrat.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/phantom_b.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/crypt/phantom_b.xml",
        "data/entities/animals/crypt/phantom_a.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/crystal_physics.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/crypt/wizard_tele.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/wizard_dark.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/wizard_poly.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/wizard_returner.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/wizard_neutral.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/barfer.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_glowing.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/enlightened_alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist_b.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necromancer_shop.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/ghoul.xml",
      ngpluslevel: 1
    }
  ],
  scorpions: [
    {
      prob: 0.7,
      min_count: 1,
      max_count: 1,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scorpion.xml"
    }
  ],
  unique: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1.5,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/arrowtrap_right.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/firetrap_right.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/thundertrap_right.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/spittrap_right.xml"
    }
  ],
  large: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1.5,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/arrowtrap_left.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/firetrap_left.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/thundertrap_left.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/spittrap_left.xml"
    }
  ],
  ghost_crystal: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/ghost.xml"
        },
        "data/entities/buildings/ghost_crystal.xml"
      ]
    }
  ],
  scavengers: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entities: [
        "data/entities/animals/scavenger_smg.xml",
        "data/entities/animals/scavenger_grenade.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_clusterbomb.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_poison.xml"
    }
  ]
};
var RAINFOREST_DARK_ENEMIES = {
  small: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_creepy_long.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/lurker.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_dark.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/wizard_weaken.xml"
    },
    {
      prob: 0.06,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.06,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/wizard_homing.xml"
    }
  ],
  big: [
    {
      prob: 0.6,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/rainforest/fungus.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/fungus_big.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_dark.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lurker.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml",
      ngpluslevel: 2
    }
  ],
  unique: [
    {
      prob: 1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lurker.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_dark.xml"
    }
  ],
  unique2: [
    {
      prob: 1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/lukki_eggs.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_dark.xml"
    }
  ],
  large: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lurker.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/rainforest/fungus.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/fungus_big.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/lukki/lukki_dark.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/crypt/skullfly.xml"
    }
  ]
};
var PYRAMID_ENEMIES = {
  small: [
    {
      prob: 2.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/skullrat.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/skullfly.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scorpion.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/alchemist.xml"
    },
    {
      prob: 5e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/thunderskull.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_weaken.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/ethereal_being.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/confusespirit.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/berserkspirit.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/weakspirit.xml"
    }
  ],
  big: [
    {
      prob: 2.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_a.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/skullfly.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/skullrat.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_b.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scorpion.xml"
    }
  ],
  scorpions: [
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scorpion.xml"
    }
  ],
  unique: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/arrowtrap_right.xml"
    }
  ],
  large: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/arrowtrap_left.xml"
    }
  ],
  scavengers: [
    {
      prob: 0.9,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entities: [
        "data/entities/animals/scavenger_smg.xml",
        "data/entities/animals/scavenger_grenade.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_clusterbomb.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_poison.xml"
    }
  ]
};
var LIQUIDCAVE_ENEMIES = {
  small: [
    {
      prob: 0.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/enlightened_alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_returner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_tele.xml",
        "data/entities/animals/wizard_dark.xml"
      ],
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_hearty.xml",
        "data/entities/animals/wizard_swapper.xml"
      ],
      ngpluslevel: 1
    }
  ],
  big: [
    {
      prob: 0.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/enlightened_alchemist.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shaman.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist_b.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_twitchy.xml",
        "data/entities/animals/wizard_poly.xml"
      ],
      ngpluslevel: 2
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml",
      ngpluslevel: 2
    }
  ],
  statues: [
    {
      prob: 0.4,
      min_count: 1,
      max_count: 1,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_01.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_02.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_03.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_04.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_05.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_06.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_07.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_08.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_09.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_10.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_11.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/props/statues/statue_rock_12.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/statue_trap_right.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/statue_trap_left.xml"
    }
  ]
};
var MEAT_ENEMIES = {
  small: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/shotgunner_hell.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner_hell.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 4,
      entity: "data/entities/animals/rat.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper_hell.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/meatmaggot.xml"
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm_big.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/worm.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/meatmaggot.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/slimespirit.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/easter/sniper.xml",
      spawn_check: "august24"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/bloodcrystal_physics.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml"
    },
    {
      prob: 0.06,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entity: "data/entities/animals/necrobot_super.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist.xml"
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necromancer.xml"
    }
  ],
  unique2: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 3,
      max_count: 4,
      entity: "data/entities/animals/sniper_hell.xml"
    }
  ],
  mouth: [
    {
      prob: 0.4,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/wallmouth.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/walleye.xml"
    },
    {
      prob: 1.5,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ]
};
var WIZARDCAVE_ENEMIES = {
  small: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/firemage.xml"
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/icemage.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_poly.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/wizard_returner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_weaken.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_homing.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/barfer.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/failed_alchemist.xml"
    }
  ],
  big: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 3,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_tele.xml",
        "data/entities/animals/wizard_dark.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_dark.xml",
        "data/entities/animals/wizard_poly.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_poly.xml",
        "data/entities/animals/wizard_swapper.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_swapper.xml",
        "data/entities/animals/wizard_hearty.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_hearty.xml",
        "data/entities/animals/wizard_twitchy.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_twitchy.xml",
        "data/entities/animals/wizard_neutral.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_neutral.xml",
        "data/entities/animals/wizard_returner.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_returner.xml",
        "data/entities/animals/wizard_weaken.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_weaken.xml",
        "data/entities/animals/wizard_homing.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_homing.xml",
        "data/entities/animals/wizard_tele.xml"
      ]
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/wizard_tele.xml",
        "data/entities/animals/wizard_dark.xml",
        "data/entities/animals/wizard_poly.xml",
        "data/entities/animals/wizard_swapper.xml",
        "data/entities/animals/wizard_neutral.xml",
        "data/entities/animals/wizard_twitchy.xml",
        "data/entities/animals/wizard_returner.xml",
        "data/entities/animals/wizard_hearty.xml",
        "data/entities/animals/wizard_weaken.xml",
        "data/entities/animals/wizard_homing.xml"
      ]
    }
  ],
  scorpions: [
    {
      prob: 0.7,
      min_count: 1,
      max_count: 1,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scorpion.xml"
    }
  ],
  unique: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1.5,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/arrowtrap_right.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/firetrap_right.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/thundertrap_right.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/spittrap_right.xml"
    }
  ],
  large: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1.5,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/arrowtrap_left.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/firetrap_left.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/thundertrap_left.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/spittrap_left.xml"
    }
  ],
  ghost_crystal: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/ghost.xml"
        },
        "data/entities/buildings/ghost_crystal.xml"
      ]
    }
  ],
  scavengers: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entities: [
        "data/entities/animals/scavenger_smg.xml",
        "data/entities/animals/scavenger_grenade.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_clusterbomb.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_poison.xml"
    }
  ]
};
var VAULT_FROZEN_ENEMIES = {
  small: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/drone_physics.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/lasershooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/roboguard.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/assassin.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/acidshooter.xml"
    },
    {
      prob: 0.18,
      min_count: 3,
      max_count: 5,
      entity: "data/entities/animals/vault/blob.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/bigzombie.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/scavenger_mine.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_invis.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/icer.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/icemage.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/thunderskull.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_shield.xml"
    },
    {
      prob: 2e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/ultimate_killer.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_twitchy.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/vault/scavenger_glue.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/scavenger_leader.xml",
        "data/entities/animals/vault/scavenger_smg.xml",
        "data/entities/animals/vault/scavenger_grenade.xml",
        "data/entities/animals/vault/scavenger_glue.xml",
        "data/entities/animals/vault/coward.xml"
      ]
    }
  ],
  big: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/firemage.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/thundermage.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/roboguard.xml",
        "data/entities/animals/vault/healerdrone_physics.xml",
        "data/entities/animals/scavenger_invis.xml"
      ]
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/vault/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/vault/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/vault/coward.xml"
        },
        "data/entities/animals/vault/scavenger_leader.xml",
        "data/entities/animals/vault/scavenger_heal.xml",
        "data/entities/animals/scavenger_invis.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tank_rocket.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/tank_super.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_shield.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/missilecrab.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/spearbot.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_weaken.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/icer.xml",
        "data/entities/animals/vault/healerdrone_physics.xml"
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/vault/missilecrab.xml",
        "data/entities/animals/drone_shield.xml"
      ]
    }
  ],
  turret: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_right.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_left.xml"
    }
  ]
};
var FUNGIFOREST_ENEMIES = {
  small: [
    {
      prob: 2.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/fungus.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/fungus_big.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/ant.xml"
    },
    {
      prob: 0.2,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/blob.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 4,
      entity: "data/entities/animals/frog_big.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus_giga.xml"
    }
  ],
  big: [
    {
      prob: 2.7,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/fungus.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fungus_giga.xml"
    },
    {
      prob: 0.1,
      min_count: 3,
      max_count: 5,
      entity: "data/entities/animals/blob.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/alchemist.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/fungus_big.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/fungus.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/fungus_big.xml"
        }
      ]
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/fungus.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/fungus_big.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/fungus_giga.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_shield.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/confusespirit.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/berserkspirit.xml",
      ngpluslevel: 1
    }
  ]
};
var SANDCAVE_ENEMIES = {
  small: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/scavenger_grenade.xml",
        "data/entities/animals/scavenger_smg.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/scavenger_heal.xml"
        }
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_clusterbomb.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_mine.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_poison.xml"
    },
    {
      prob: 0.09,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_invis.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_hell.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper_hell.xml",
      ngpluslevel: 2
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/scavenger_heal.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/flamer.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_dark.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_clusterbomb.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/scavenger_heal.xml"
        }
      ]
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/tank.xml",
        "data/entities/animals/healerdrone_physics.xml"
      ]
    }
  ],
  unique2: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.6,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    }
  ]
};
var ROBOBASE_ENEMIES = {
  small: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/roboguard_big.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_sentry.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_hidden.xml"
    },
    {
      prob: 0.12,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_neutralizer.xml"
    },
    {
      prob: 0.12,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_soldier.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/vault/scavenger_glue.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/robobase/healerdrone_physics.xml"
    }
  ],
  big: [
    {
      prob: 0.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/robobase/drone_shield.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_hidden.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_neutralizer.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_sentry.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/basebot_soldier.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/robobase/tank_super.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml"
    },
    {
      prob: 0.08,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml"
    }
  ],
  turret: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_right.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/vault/turret_left.xml"
    }
  ]
};
var CLOUDS_ENEMIES = {
  small: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 4,
      entity: "data/entities/animals/wraith_glowing.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_storm.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.4,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_swapper.xml"
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/skycrystal_physics.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/spearbot.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_neutral.xml"
    },
    {
      prob: 0.07,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_weaken.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_homing.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wizard_hearty.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/ethereal_being.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/weakspirit.xml",
      ngpluslevel: 2
    }
  ]
};
var LAKE_ENEMIES = {
  small: [
    {
      prob: 1.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 5,
      entity: "data/entities/animals/fish.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/fish_large.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/eel.xml"
    }
  ]
};
var HELL_ENEMIES = {
  small: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/gazer.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/spitmonster.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/bloodcrystal_physics.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/worm_end.xml"
    },
    {
      prob: 4e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith.xml"
    },
    {
      prob: 1e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_glowing.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/thunderskull.xml"
    }
  ],
  unique: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/arrowtrap_right.xml"
    }
  ],
  large: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/arrowtrap_left.xml"
    }
  ]
};
var HEAVEN_ENEMIES = {
  small: [
    {
      prob: 0.4,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/skygazer.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/spearbot.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/skycrystal_physics.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/the_end/worm_skull.xml"
    },
    {
      prob: 4e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_storm.xml"
    },
    {
      prob: 1e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_glowing.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/thunderskull.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/wizard_tele.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    }
  ],
  big: [
    {
      prob: 1.8,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wraith_glowing.xml"
    }
  ],
  unique: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 2,
      entity: "data/entities/buildings/arrowtrap_right.xml"
    }
  ],
  large: [
    {
      prob: 0.1,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      offset_x: 1,
      entity: "data/entities/buildings/arrowtrap_left.xml"
    }
  ]
};
var SNOWCHASM_ENEMIES = {
  small: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/iceskull.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_smg.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_grenade.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thunderskull.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/ethereal_being.xml"
    }
  ],
  big: [
    {
      prob: 0.5,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/icemage.xml"
    },
    {
      prob: 0.15,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_a.xml"
    },
    {
      prob: 0.15,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/phantom_b.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/thundermage_big.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/snowcrystal.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/ethereal_being.xml"
    },
    {
      prob: 0.2,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/ghost_crystal.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/weakspirit.xml",
      ngpluslevel: 2
    }
  ],
  unique: [
    {
      prob: 0,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.5,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/slimeshooter.xml"
    },
    {
      prob: 0.3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/acidshooter.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/giantshooter.xml"
    }
  ]
};
var WATCHTOWER_ENEMIES = {
  small: [
    {
      prob: 0.2,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/scavenger_grenade.xml",
        "data/entities/animals/scavenger_smg.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/miner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/shotgunner.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 2e-3,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_heal.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_leader.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/coward.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/shotgunner_hell.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/sniper_hell.xml",
      ngpluslevel: 2
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/drunk/scavenger_grenade.xml",
        "data/entities/animals/drunk/scavenger_smg.xml"
      ],
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/sniper.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/miner.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/shotgunner.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.05,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.01,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.002,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/items/easter/beer_bottle.xml",
      spawn_check: "jussi"
    },
    {
      prob: 1.1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    }
  ],
  big: [
    {
      prob: 0.3,
      min_count: 0,
      max_count: 0,
      entity: ""
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        "data/entities/animals/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/coward.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank.xml"
    },
    {
      prob: 0.03,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_rocket.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/scavenger_heal.xml"
    },
    {
      prob: 5e-3,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/tank_super.xml"
    },
    {
      prob: 0.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/scavenger_clusterbomb.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/scavenger_heal.xml"
        }
      ]
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/coward.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/buildings/hpcrystal.xml",
      ngpluslevel: 1
    },
    {
      prob: 0.075,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/necrobot_super.xml",
      ngpluslevel: 3
    },
    {
      prob: 2.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 2.1,
      min_count: 1,
      max_count: 1,
      ngpluslevel: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_leader.xml",
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ],
      spawn_check: "jussi"
    },
    {
      prob: 2.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml",
      spawn_check: "jussi"
    },
    {
      prob: 2.02,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/drunk/scavenger_clusterbomb.xml",
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 3,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        },
        {
          min_count: 1,
          max_count: 1,
          entity: "data/entities/animals/drunk/scavenger_heal.xml"
        }
      ],
      spawn_check: "jussi"
    }
  ]
};
var LAKE_STATUE_ENEMIES = {
  fish: [
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/fish.xml"
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: ""
    }
  ],
  small: [
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: ""
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/deer.xml"
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 3,
      entity: "data/entities/animals/duck.xml"
    },
    {
      prob: 1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/elk.xml"
    },
    {
      prob: 1,
      min_count: 2,
      max_count: 5,
      entity: "data/entities/animals/sheep.xml"
    },
    {
      prob: 0.05,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/wolf.xml"
    }
  ],
  hiisi: [
    {
      prob: 0.3,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/drunk/miner_weak.xml"
    },
    {
      prob: 0.1,
      min_count: 2,
      max_count: 2,
      entity: "data/entities/animals/drunk/miner_fire.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/shotgunner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        "data/entities/animals/drunk/miner.xml",
        "data/entities/animals/drunk/miner.xml",
        "data/entities/animals/drunk/shotgunner.xml"
      ]
    },
    {
      prob: 0.12,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/shotgunner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        "data/entities/animals/drunk/scavenger_grenade.xml",
        "data/entities/animals/drunk/scavenger_smg.xml"
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entities: [
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 0,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ]
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/sniper.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/miner.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 2,
      entity: "data/entities/animals/drunk/shotgunner.xml"
    },
    {
      prob: 0.04,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_heal.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drone_lasership.xml"
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entity: "data/entities/animals/drunk/scavenger_leader.xml",
      ngpluslevel: 2
    },
    {
      prob: 0.1,
      min_count: 1,
      max_count: 1,
      entities: [
        {
          min_count: 0,
          max_count: 1,
          entity: "data/entities/animals/drunk/scavenger_grenade.xml"
        },
        {
          min_count: 1,
          max_count: 2,
          entity: "data/entities/animals/drunk/scavenger_smg.xml"
        }
      ]
    }
  ]
};
var TOWER_ENEMIES = [
  "acidshooter",
  "alchemist",
  "ant",
  "assassin",
  "barfer",
  "bat",
  "bigbat",
  "bigfirebug",
  "bigzombie",
  "blob",
  "bloodcrystal_physics",
  "bloom",
  "chest_mimic",
  "coward",
  "crystal_physics",
  "drone_physics",
  "drone_shield",
  "enlightened_alchemist",
  "failed_alchemist",
  "failed_alchemist_b",
  "firebug",
  "firemage",
  "fireskull",
  "flamer",
  "fly",
  "frog",
  "frog_big",
  "fungus",
  "fungus_big",
  "fungus_giga",
  "gazer",
  "ghoul",
  "giant",
  "giantshooter",
  "healerdrone_physics",
  "icemage",
  "icer",
  "iceskull",
  "lasershooter",
  "longleg",
  "maggot",
  "miner",
  "miner_fire",
  "missilecrab",
  "monk",
  "necromancer",
  "necromancer_shop",
  "phantom_a",
  "phantom_b",
  "rat",
  "roboguard",
  "scavenger_clusterbomb",
  "scavenger_heal",
  "scavenger_grenade",
  "scavenger_leader",
  "scavenger_mine",
  "scavenger_poison",
  "scavenger_smg",
  "shooterflower",
  "shotgunner",
  "skullfly",
  "skullrat",
  "slimeshooter",
  "sniper",
  "spitmonster",
  "statue_physics",
  "tank",
  "tank_rocket",
  "tank_super",
  "tentacler",
  "tentacler_small",
  "thundermage",
  "thundermage_big",
  "thunderskull",
  "turret_left",
  "turret_right",
  "wizard_dark",
  "wizard_hearty",
  "wizard_neutral",
  "wizard_poly",
  "wizard_returner",
  "wizard_swapper",
  "wizard_tele",
  "wizard_twitchy",
  "wizard_weaken",
  "wizard_homing",
  "wolf",
  "wraith",
  "wraith_glowing",
  "wraith_storm",
  "zombie",
  "skycrystal_physics",
  "scavenger_shield",
  "spearbot",
  "statue",
  "goblin_bomb",
  "snowcrystal",
  "hpcrystal"
];
var BIOME_ENEMY_MAP = {
  coalmine: COALMINE_ENEMIES,
  coalmine_alt: COALMINE_ALT_ENEMIES,
  excavationsite: EXCAVATIONSITE_ENEMIES,
  fungicave: FUNGICAVE_ENEMIES,
  snowcave: SNOWCAVE_ENEMIES,
  wandcave: WANDCAVE_ENEMIES,
  snowcastle: SNOWCASTLE_ENEMIES,
  rainforest: RAINFOREST_ENEMIES,
  rainforest_open: RAINFOREST_ENEMIES,
  rainforest_dark: RAINFOREST_DARK_ENEMIES,
  vault: VAULT_ENEMIES,
  crypt: CRYPT_ENEMIES,
  vault_frozen: VAULT_FROZEN_ENEMIES,
  clouds: CLOUDS_ENEMIES,
  lake_deep: LAKE_ENEMIES,
  the_end: HELL_ENEMIES,
  the_sky: HEAVEN_ENEMIES,
  winter_caves: SNOWCHASM_ENEMIES,
  biome_watchtower: WATCHTOWER_ENEMIES,
  fungiforest: FUNGIFOREST_ENEMIES,
  sandcave: SANDCAVE_ENEMIES,
  liquidcave: LIQUIDCAVE_ENEMIES,
  robobase: ROBOBASE_ENEMIES,
  wizardcave: WIZARDCAVE_ENEMIES,
  meat: MEAT_ENEMIES,
  lake_statue: LAKE_STATUE_ENEMIES,
  pyramid: PYRAMID_ENEMIES
};

// vendor/noita-telescope-main/js/spawn_functions.js
var WOBBLE_REMAP_FUNCS = /* @__PURE__ */ new Set([]);
var BIOME_TIERS = {
  "coalmine": 1,
  "coalmine_alt": 1,
  "excavationsite": 2,
  "snowcave": 3,
  "meat": 3,
  // probably not likely to be used
  //'snowcastle': 3, // No shop here
  //'rainforest': 4, // No shop here
  //'rainforest_open': 4, // No shop here
  //'vault': 4, // Uses y coordinate for this one
  //'crypt': 5, // Uses y coordinate here too
  "the_end": 10,
  "the_sky": 10,
  // Unclear what the shop level for the tower is, seems like it can just spawn any spell, I thought it was tier 10 but maybe it's just depth-dependent (null)
  // File seems to indicate 6?
  "solid_wall_tower_1": 6,
  // Mines
  "solid_wall_tower_2": 6,
  // Coal Pits
  "solid_wall_tower_3": 6,
  // Snowy Depths
  "solid_wall_tower_4": 6,
  // Hiisi Base
  "solid_wall_tower_5": 6,
  // Fungal Caverns
  "solid_wall_tower_6": 6,
  // Underground Jungle
  "solid_wall_tower_7": 6,
  // The Vault
  "solid_wall_tower_8": 6,
  // Temple of the Art
  "solid_wall_tower_9": 6
  // Hell, not actually reachable in overlaps because it doesn't exist in NG+, but probably worth including for completeness
};
function getSpawnFunctionIndex(biomeName, color) {
  if (!BIOME_SPAWN_FUNCTION_MAP[biomeName]) return null;
  const spawnFunctions = BIOME_SPAWN_FUNCTION_MAP[biomeName];
  for (let i = 0; i < spawnFunctions.length; i++) {
    if (spawnFunctions[i].color === color) {
      return i;
    }
  }
  return null;
}
function hiisi_safe(x, y) {
  if (x >= 125 && x <= 249 && y >= 5118 && y <= 5259) return false;
  if (y > 6100) return false;
  return true;
}
function spawnFromTable(ws, ng, x, y, table) {
  let total = 0;
  for (const entry of table) {
    if (entry.ngpluslevel !== void 0 && ng < entry.ngpluslevel) continue;
    if (entry.spawn_check !== void 0) {
      if (entry.spawn_check === "christmas" && (appSettings.date.month !== 12 || appSettings.date.day < 24 || appSettings.date.day > 26)) continue;
      if (entry.spawn_check === "august24" && (appSettings.date.month !== 8 || appSettings.date.day !== 24)) continue;
      if (entry.spawn_check === "jussi" && (appSettings.date.month !== 6 || appSettings.date.day < 19 || appSettings.date.day > 25)) continue;
    }
    total += entry.prob;
  }
  const prng2 = new NollaPrng(0);
  let r = prng2.ProceduralRandom(ws + ng, x, y) * total;
  for (const entry of table) {
    if (entry.ngpluslevel !== void 0 && ng < entry.ngpluslevel) continue;
    if (entry.spawn_check !== void 0) {
      if (entry.spawn_check === "christmas" && (appSettings.date.month !== 12 || appSettings.date.day < 24 || appSettings.date.day > 26)) continue;
      if (entry.spawn_check === "august24" && (appSettings.date.month !== 8 || appSettings.date.day !== 24)) continue;
      if (entry.spawn_check === "jussi" && (appSettings.date.month !== 6 || appSettings.date.day < 19 || appSettings.date.day > 25)) continue;
    }
    if (r <= entry.prob) {
      return entry;
    }
    r -= entry.prob;
  }
  return null;
}
function spawnTowerEnemies(ws, ng, x, y) {
  if (x >= 9676 && x <= 9804 && y >= 9806 && y <= 9214) return null;
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  let rnd = prng2.Random(1, TOWER_ENEMIES.length);
  let target = TOWER_ENEMIES[rnd - 1];
  return { type: "enemies", items: [{ type: "entity", entity: target, x, y }], x, y };
}
function spawnWithRandomOffset(ws, ng, x, y, spawnChoice, offsetX = 5, offsetY = 5, gameMode = "normal", perks = {}) {
  let spawns = [];
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x + offsetX, y + offsetY);
  const givePerk = gameMode === "nightmare" ? prng2.Random(1, 15) === 1 : false;
  let giveWand = gameMode === "nightmare" ? prng2.Random(1, 20) === 1 : false;
  const minCount = spawnChoice.min_count !== void 0 ? spawnChoice.min_count : 1;
  const maxCount = spawnChoice.max_count !== void 0 ? spawnChoice.max_count : 1;
  if (spawnChoice.entities !== void 0) {
    for (let j = 0; j < spawnChoice.entities.length; j++) {
      const entity = spawnChoice.entities[j];
      if (typeof entity === "object") {
        const entityMinCount = entity.min_count !== void 0 ? entity.min_count : 1;
        const entityMaxCount = entity.max_count !== void 0 ? entity.max_count : entityMinCount;
        let count = entityMinCount + prng2.ProceduralRandom(ws + ng, x + j + offsetX, y + offsetY) * (entityMaxCount - entityMinCount);
        for (let i = 1; i <= count; i++) {
          let px = x + offsetX - 4 + prng2.ProceduralRandom(ws + ng, x + j + offsetX, y + i + offsetY) * 8;
          let py = y + offsetY - 4 + prng2.ProceduralRandom(ws + ng, x + j + offsetX, y + i + offsetY) * 8;
          if (!appSettings.showEnemies) continue;
          const cleanEntity = entity.entity.split("/").pop().replace(".xml", "");
          spawns.push({ type: "entity", entity: cleanEntity, x: px, y: py });
        }
      } else {
        let px = x + offsetX - 4 + prng2.ProceduralRandom(ws + ng, x + j + offsetX, y + offsetY) * 8;
        let py = y + offsetY - 4 + prng2.ProceduralRandom(ws + ng, x + j + offsetX, y + offsetY) * 8;
        if (!appSettings.showEnemies) continue;
        const cleanEntity = entity.split("/").pop().replace(".xml", "");
        spawns.push({ type: "entity", entity: cleanEntity, x: px, y: py });
      }
    }
  }
  if (spawnChoice.entity !== void 0) {
    let count = minCount + prng2.ProceduralRandom(ws + ng, x + offsetX, y + offsetY) * (maxCount - minCount);
    for (let i = 1; i <= count; i++) {
      let px = x + offsetX - 4 + prng2.ProceduralRandom(ws + ng, x + i + offsetX, y + offsetY) * 8;
      let py = y + offsetY - 4 + prng2.ProceduralRandom(ws + ng, x + i + offsetX, y + offsetY) * 8;
      if (givePerk) {
      }
      if (giveWand) {
        const wand = generateNightmareWand(ws, ng, px, py, spawnChoice.entity, perks);
        if (wand) {
          spawns.push(wand);
        } else {
          giveWand = false;
        }
      }
      if (spawnChoice.entity.includes("wand_ghost")) giveWand = true;
      if (!appSettings.showEnemies && !giveWand) continue;
      const cleanEntity = spawnChoice.entity.split("/").pop().replace(".xml", "");
      spawns.push({ type: "entity", entity: cleanEntity, x: px, y: py });
    }
  }
  return spawns;
}
function spawnEntities(ws, ng, x, y, spawnList, gameMode = "normal", perks = {}, offsetX = 5, offsetY = 5) {
  let spawnChoice = spawnFromTable(ws, ng, x, y, spawnList);
  if (spawnChoice && (spawnChoice.entity !== void 0 && spawnChoice.entity !== "" || spawnChoice.entities !== void 0 && spawnChoice.entities.length > 0)) {
    let result = spawnWithRandomOffset(ws, ng, x, y, spawnChoice, offsetX, offsetY, gameMode, perks);
    return result;
  }
  return null;
}
function spawnSwitch(biomeData, biomeName, functionIndex, ws, ng, x, y, skipCosmeticScenes = true, perks = {}, gameMode = "normal", trustBiome = false) {
  if (!trustBiome) {
    if (appSettings.blockEdgeSpawns) {
      const offsetX = (x % 512 + 512) % 512;
      const offsetY = (y % 512 + 512) % 512;
      if (offsetX >= 507 || offsetY >= 507) return null;
    }
    const adjustedBiomeResults = getBiomeAtWorldCoordinates(biomeData, x, y, ng > 0, gameMode);
    if (appSettings.excludeEdgeCases && adjustedBiomeResults.biome !== adjustedBiomeResults.origBiome) {
      return null;
    }
    biomeName = adjustedBiomeResults.biome;
  }
  const spawns = BIOME_SPAWN_FUNCTION_MAP[biomeName];
  if (!spawns) {
    return;
  }
  let func;
  if (functionIndex >= spawns.length) {
    return;
  }
  const spawn = spawns[functionIndex];
  if (spawn) {
    func = spawn.funcName;
    if (spawn.active === false) {
      return;
    }
  } else {
    console.warn(`No spawn function at index ${functionIndex} for biome ${biomeName}, trying to spawn at (${x}, ${y})`);
    return;
  }
  if (!func) {
    console.warn(`No spawn function at index ${functionIndex} for biome ${biomeName}, trying to spawn at (${x}, ${y})`);
    return;
  }
  if (WOBBLE_REMAP_FUNCS.has(func)) {
    const wob = getBiomeAtWorldCoordinates(biomeData, x, y, ng > 0, gameMode, true);
    if (wob && wob.biome && wob.biome !== biomeName) {
      const color = spawns[functionIndex] && spawns[functionIndex].color;
      const wobIdx = color != null ? getSpawnFunctionIndex(wob.biome, color) : null;
      if (wobIdx === null) return null;
      const wobSpawns = BIOME_SPAWN_FUNCTION_MAP[wob.biome];
      const wobSpawn = wobSpawns && wobSpawns[wobIdx];
      if (!wobSpawn || wobSpawn.active === false || !wobSpawn.funcName) return null;
      biomeName = wob.biome;
      functionIndex = wobIdx;
      func = wobSpawn.funcName;
    }
  }
  const scenes = PIXEL_SCENE_BIOME_MAP[biomeName];
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  if (biomeName === "coalmine") {
    if (func === "load_pixel_scene") {
      if (prng2.Random(1, 100) > 50)
        return loadRandomPixelScene(biomeData, biomeName, PIXEL_SCENE_BIOME_MAP[biomeName]["g_oiltank"], ws, ng, x, y, skipCosmeticScenes, gameMode);
      else
        return loadRandomPixelScene(biomeData, biomeName, PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_01"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_oiltank") {
      if (prng2.Random(1, 100) <= 50) {
        return loadRandomPixelScene(biomeData, biomeName, scenes["g_oiltank"], ws, ng, x, y, skipCosmeticScenes, gameMode);
      } else {
        return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_01"], ws, ng, x, y, skipCosmeticScenes, gameMode);
      }
    } else if (func === "load_oiltank_alt") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_oiltank_alt"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_trapwand") {
      const options = ["premade_1", "premade_2", "premade_3", "premade_4", "premade_5", "premade_6", "premade_7", "premade_8", "premade_9", "wand_level_01"];
      let rnd = prng2.Random(1, options.length);
      let wandType = options[rnd - 1];
      return generateWand(ws, ng, x, y, wandType, perks);
    } else if (func === "spawn_bbqbox") {
      if (prng2.Random(1, 100) <= 99) {
        return spawnHeart(ws, ng, x + 10, y + 10, biomeName, perks);
      } else {
        return spawnJar(x, y);
      }
    } else if (func === "spawn_swing_puzzle_target") {
      const chest = spawnChest(ws, ng, x - 75, y - 70, false, perks, gameMode);
      return { type: "puzzle", materials: "electricity", items: chest.items, x: x - 75, y: y - 70 };
    } else if (func === "spawn_oiltank_puzzle") {
      const materials = ["water", "blood", "alcohol", "radioactive_liquid", "water_salt", "slime", "water", "blood", "alcohol", "radioactive_liquid", "water_salt", "slime", "magic_liquid_berserk", "magic_liquid_charm", "oil"];
      const choice = prng2.ProceduralRandomi(ws + ng, x, y, 1, materials.length);
      console.log(`Oiltank puzzle material choice: ${materials[choice - 1]}`);
      const chest = spawnChest(ws, ng, x, y - 25, false, perks, gameMode);
      return { type: "puzzle", materials: materials[choice - 1], items: chest.items, x, y: y - 25 };
    } else if (func === "spawn_receptacle_oil") {
      const wand = spawnSpecialWand(ws, ng, x + 72, y - 22, "ruusu");
      const potion = { type: "item", item: "potion_empty", x: x + 72, y: y - 17 };
      return { type: "puzzle", materials: "oil", items: [wand, potion, { type: "item", item: "oil_receptacle_puzzle", x, y, ignore: true }], x: x + 72, y: y - 22 };
    } else if (func === "spawn_potion" || func === "spawn_props3") {
      let r = prng2.Next() * 0.4;
      if (r > 0.1) {
        return createPotion(ws, ng, x + 5, y, "normal", gameMode);
      } else {
        return null;
      }
    }
  } else if (biomeName === "excavationsite") {
    if (func === "load_puzzleroom") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_puzzleroom"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_gunpowderpool_01") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_gunpowderpool_01"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_gunpowderpool_02") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_gunpowderpool_02"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_gunpowderpool_03") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_gunpowderpool_03"], ws, ng, x - 3, y + 3, skipCosmeticScenes, gameMode);
    } else if (func === "load_gunpowderpool_04") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_gunpowderpool_04"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_meditation_cube") {
      let rnd = prng2.Random(1, 100);
      if (rnd > 96 && gameMode !== "nightmare") {
        return loadPixelScene(biomeData, biomeName, "meditation_cube_visual", ws, ng, x - 20, y - 29, skipCosmeticScenes, false, gameMode);
      }
    } else if (func === "spawn_receptacle") {
      const wand = spawnSpecialWand(ws, ng, x, y - 25, "kiekurakeppi");
      return { type: "puzzle", materials: "steam", items: [wand, { type: "item", item: "steam_receptacle_puzzle", x, y, ignore: true }], x, y: y - 25 };
    }
  } else if (biomeName === "snowcave") {
    if (func === "load_puzzle_capsule") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_puzzle_capsule"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_puzzle_capsule_b") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_puzzle_capsule_b"], ws, ng, x - 50, y - 230, skipCosmeticScenes, gameMode);
    } else if (func === "load_acidtank_right") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_acidtank_right"], ws, ng, x - 12, y - 12, skipCosmeticScenes, gameMode);
    } else if (func === "load_acidtank_left") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_acidtank_left"], ws, ng, x - 252, y - 12, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_buried_eye_teleporter") {
      return { type: "item", item: "buried_eye_teleporter", x, y };
    } else if (func === "spawn_receptacle") {
      const wand = spawnSpecialWand(ws, ng, x, y - 85, "valtikka");
      return { type: "puzzle", materials: "water", items: [wand, { type: "item", item: "water_receptacle_puzzle", x, y, ignore: true }], x, y: y - 85 };
    }
  } else if (biomeName === "snowcastle") {
    if (func === "load_pixel_scene" || func === "load_pixel_scene2") {
      if (!hiisi_safe(x, y)) return null;
    }
    if (func === "spawn_brimstone") {
      return { type: "item", item: "kiuaskivi", x, y };
    } else if (func === "spawn_vasta_or_vihta") {
      if (x > 190) {
        return spawnSpecialWand(ws, ng, x, y, "vasta");
      } else {
        return spawnSpecialWand(ws, ng, x, y, "vihta");
      }
    } else if (func === "load_chamfer_top_r") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_top_r", ws, ng, x - 10, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_top_l") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_top_l", ws, ng, x - 1, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_bottom_r") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_bottom_r", ws, ng, x - 10, y - 20, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_bottom_l") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_bottom_l", ws, ng, x - 1, y - 20, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_inner_top_r") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_inner_top_r", ws, ng, x - 10, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_inner_top_l") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_inner_top_l", ws, ng, x, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_inner_bottom_r") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_inner_bottom_r", ws, ng, x - 10, y - 20, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_chamfer_inner_bottom_l") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "chamfer_inner_bottom_l", ws, ng, x, y - 20, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_pillar_filler") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "pillar_filler_01", ws, ng, x, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_pillar_filler_tall") {
      if (!hiisi_safe(x, y)) return null;
      return loadPixelScene(biomeData, biomeName, "pillar_filler_tall_01", ws, ng, x, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "load_pod_large") {
      if (!hiisi_safe(x, y)) return null;
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pods_large"], ws, ng, x, y - 50, skipCosmeticScenes, gameMode);
    } else if (func === "load_pod_small_l") {
      if (!hiisi_safe(x, y)) return null;
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pods_small_l"], ws, ng, x - 30, y - 40, skipCosmeticScenes, gameMode);
    } else if (func === "load_pod_small_r") {
      if (!hiisi_safe(x, y)) return null;
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pods_small_r"], ws, ng, x - 10, y - 40, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_potion" || func === "spawn_props3") {
      let r = prng2.Next() * 1.325;
      if (r > 1.3) {
        return createPotion(ws, ng, x + 5, y, "normal", gameMode);
      } else if (r > 1.2) {
        return { type: "item", item: "potion", material: "alcohol", x: x + 5, y };
      } else {
        return null;
      }
    } else if (func === "spawn_chef") {
      return { type: "enemies", items: [{ type: "entity", entity: "chef", x, y }], x, y };
    }
  } else if (biomeName === "rainforest" || biomeName === "rainforest_open") {
    if (func === "spawn_dragonspot") {
      return getDragonDrops(ws, ng, biomeName, x, y, perks);
    }
  } else if (biomeName === "vault" || biomeName === "vault_frozen") {
    if (func === "load_pixel_scene_wide") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_wide"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_pixel_scene_tall") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_tall"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_stains") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_stains"], ws, ng, x - 10, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_stains_ceiling") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_stains_ceiling"], ws, ng, x - 20, y - 10, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_laser_trap") {
      return loadPixelScene(biomeData, biomeName, "hole", ws, ng, x, y, skipCosmeticScenes, true, gameMode);
    } else if (func === "spawn_lab_puzzle") {
      const type_a = ["poly", "tele", "charm", "berserk"];
      const type_b = ["protect", "worm", "invis", "speed"];
      const firstMaterial = prng2.Random(1, type_a.length);
      const secondMaterial = prng2.Random(1, type_b.length);
      const material_conversions = {
        "poly": "polymorphine, chaotic polymorphine",
        "tele": "teleportatium, unstable teleportatium",
        "charm": "pheromone, healthium, lively concoction",
        "berserk": "berserkium",
        "protect": "ambrosia",
        "worm": "worm blood, worm pheromone",
        "invis": "invisiblium",
        "speed": "acceleratium, levitatium, hastium"
      };
      const materialL = material_conversions[type_a[firstMaterial - 1]];
      const materialR = material_conversions[type_b[secondMaterial - 1]];
      const rL = prng2.ProceduralRandom(ws + ng, x - 10, y);
      let wandL;
      let searchItemL;
      if (rL > 0.3) {
        wandL = spawnSpecialWand(ws, ng, x - 10 + 70, y + 10, "arpaluu");
        searchItemL = { type: "item", item: "vault_puzzle_arpaluu", x: x - 10 + 70, y: y + 10, ignore: true };
      } else {
        wandL = spawnSpecialWand(ws, ng, x - 10 + 70, y + 10, "varpuluuta");
        searchItemL = { type: "item", item: "vault_puzzle_varpuluuta", x: x - 10 + 70, y: y + 10, ignore: true };
      }
      const rR = prng2.ProceduralRandom(ws + ng, x + 11, y);
      let wandR;
      let searchItemR;
      if (rR > 0.3) {
        wandR = spawnSpecialWand(ws, ng, x + 11 + 70, y + 10, "arpaluu");
        searchItemR = { type: "item", item: "vault_puzzle_arpaluu", x: x + 11 + 70, y: y + 10, ignore: true };
      } else {
        wandR = spawnSpecialWand(ws, ng, x + 11 + 70, y + 10, "varpuluuta");
        searchItemR = { type: "item", item: "vault_puzzle_varpuluuta", x: x + 11 + 70, y: y + 10, ignore: true };
      }
      return {
        type: "vault_puzzle",
        materials: [materialL, materialR],
        items: [wandL, searchItemL, wandR, searchItemR],
        // Include dummy items for searching
        x: x + 70,
        y: y + 10
      };
    } else if (func === "spawn_pipes_hor") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_hor"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_ver") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_ver"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_turn_right") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_turn_right"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_turn_left") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_turn_left"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_cross") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_cross"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_big_hor") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_big_hor"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_big_ver") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_big_ver"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_big_turn_right") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_big_turn_right"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_pipes_big_turn_left") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pipes_big_turn_left"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (func === "load_catwalk") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_catwalks"], ws, ng, x, y - 20, skipCosmeticScenes, gameMode);
    }
  } else if (biomeName === "crypt" || biomeName === "wizardcave") {
    if (func === "load_beam") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_beam"], ws, ng, x, y - 65, skipCosmeticScenes, gameMode);
    } else if (func === "load_cavein") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_cavein"], ws, ng, x - 60, y - 10, skipCosmeticScenes, gameMode);
    }
  } else if (biomeName === "liquidcave") {
    if (func === "load_pixel_scene") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_01"], ws, ng, x - 5, y - 3, skipCosmeticScenes, gameMode);
    } else if (func === "spawn_lasergun") {
      return { type: "enemies", items: [{ type: "entity", entity: "lasergun", x, y }], x, y };
    }
  } else if (biomeName === "the_end" || biomeName === "the_sky") {
    if (func === "spawn_heart" || func === "spawn_potions" || func === "spawn_wands" || func === "spawn_potion_altar") {
      return null;
    } else if (func === "spawn_shopitem") {
      if (prng2.Random(1, 50) === 1) {
        return generateShopItem(ws, ng, x, y, BIOME_TIERS[biomeName], 0);
      } else {
        return null;
      }
    } else if (func === "spawn_specialshop") {
      return generateShopItem(ws, ng, x, y, BIOME_TIERS[biomeName], 0);
    }
  } else if (biomeName === "wandcave") {
    if (func === "spawn_potions" || func === "spawn_wands") {
      return null;
    }
  } else if (biomeName === "biome_watchtower" || biomeName === "biome_barren" || biomeName === "biome_potion_mimics" || biomeName === "biome_darkness" || biomeName === "biome_boss_sky") {
    if (func === "spawn_potion_mimic") {
      if (x < 16e3 && x > -16e3) {
        return { type: "item", item: "mimic_potion", x, y };
      } else {
        return null;
      }
    } else if (func === "spawn_potion_beer") {
      return { type: "item", item: "potion", material: "beer", x, y: y - 5 };
    } else if (func === "spawn_potion_milk") {
      return { type: "item", item: "potion", material: "milk", x, y: y - 5 };
    } else if (func === "spawn_potions" || func === "spawn_wands") {
      return null;
    }
  } else if (biomeName === "meat") {
    if (func === "spawn_mouth") {
      if (!appSettings.showEnemies) return null;
      if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].mouth) {
        let spawnList = BIOME_ENEMY_MAP[biomeName].mouth;
        let offsetX = 5 + prng2.Random(-10, 10);
        let offsetY = 5 + prng2.Random(-10, 10);
        let entities = spawnEntities(ws, ng, x + offsetX, y + offsetY, spawnList, gameMode, perks);
        if (entities && entities.length > 0) {
          return { type: "enemies", items: entities, x: x + offsetX, y: y + offsetY, biome: biomeName };
        }
      }
      return null;
    }
  }
  if (func === "spawn_shopitem") {
    return generateShopItem(ws, ng, x, y, BIOME_TIERS[biomeName], 0);
  } else if (func === "spawn_small_enemies" || func === "spawn_small_enemies2") {
    if (!appSettings.showEnemies && biomeName !== "wandcave" && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].small) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].small;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        if (biomeName === "wandcave") {
          let px = roundHalfOfEven(entities[entities.length - 1].x);
          let py = roundHalfOfEven(entities[entities.length - 1].y);
          const wand = generateWand(ws, ng, px, py, "wand_level_03", perks);
          if (wand) {
            wand["name"] = "Taikasauva";
          }
          return wand;
        }
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  }
  if (func === "spawn_big_enemies" || func === "spawn_big_enemies2") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].big) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].big;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_unique_enemy") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].unique) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].unique;
      let offsetX = biomeName === "crypt" || biomeName === "pyramid" || biomeName === "wizardcave" ? -1 : 0;
      let offsetY = biomeName === "rainforest" || biomeName === "rainforest_open" || biomeName === "rainforest_dark" ? 12 : 0;
      let entities = spawnEntities(ws, ng, x + offsetX, y + offsetY, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x: x + offsetX, y: y + offsetY, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_unique_enemy2") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].unique2) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].unique2;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_unique_enemy3") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].unique3) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].unique3;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_large_enemies") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].large) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].large;
      let offsetX = biomeName === "crypt" || biomeName === "pyramid" || biomeName === "wizardcave" ? -1 : 0;
      let entities = spawnEntities(ws, ng, x + offsetX, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x: x + offsetX, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_turret") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].turret) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].turret;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_ghost_crystal") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].ghost_crystal) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].ghost_crystal;
      let offsetX = biomeName === "crypt" || biomeName === "pyramid" || biomeName === "wizardcave" ? -1 : 0;
      let entities = spawnEntities(ws, ng, x + offsetX, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x: x + offsetX, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_nest") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].nest) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].nest;
      let offsetX = biomeName === "excavationsite" || biomeName === "coalmine" || biomeName === "coalmine_alt" ? 4 : 0;
      let offsetY = biomeName === "excavationsite" ? 8 : 0;
      let entities = spawnEntities(ws, ng, x + offsetX, y + offsetY, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x: x + offsetX, y: y + offsetY, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_fungi") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (biomeName.includes("tower")) return spawnTowerEnemies(ws, ng, x, y);
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].fungi) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].fungi;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_robots") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].robots) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].robots;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_scavengers") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].scavengers) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].scavengers;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_scavenger_party") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].scavenger_party) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].scavenger_party;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_fish") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].fish) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].fish;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_scorpions" || func === "spawn_scorpion") {
    if (!appSettings.showEnemies && gameMode !== "nightmare") return null;
    if (BIOME_ENEMY_MAP[biomeName] && BIOME_ENEMY_MAP[biomeName].scorpions) {
      let spawnList = BIOME_ENEMY_MAP[biomeName].scorpions;
      let entities = spawnEntities(ws, ng, x, y, spawnList, gameMode, perks);
      if (entities && entities.length > 0) {
        return { type: "enemies", items: entities, x, y, biome: biomeName };
      }
    }
    return null;
  } else if (func === "spawn_wand_altar" || func === "spawn_items") {
    const checkResult = checkWandAltar(ws, ng, x, y, biomeName);
    if (checkResult === "utility_box") {
      return generateUtilityBox(ws, ng, x, y, perks, gameMode);
    } else if (checkResult) {
      let offsetX = -10;
      let offsetY = -17;
      if (BIOME_WAND_ALTAR_OFFSET_MAP[biomeName]) {
        offsetX = BIOME_WAND_ALTAR_OFFSET_MAP[biomeName].x;
        offsetY = BIOME_WAND_ALTAR_OFFSET_MAP[biomeName].y;
      }
      if (BIOMES_WITH_SMALL_ALTARS.includes(biomeName)) {
        return loadPixelScene(biomeData, biomeName, "wand_altar_vault", ws, ng, x + offsetX, y + offsetY, skipCosmeticScenes, false, gameMode);
      } else {
        return loadPixelScene(biomeData, biomeName, "wand_altar", ws, ng, x + offsetX, y + offsetY, skipCosmeticScenes, false, gameMode);
      }
    } else {
      return null;
    }
  } else if (func === "spawn_wand" || func === "spawn_wands") {
    return spawnWand(ws, ng, x, y, biomeName, perks);
  } else if (func === "spawn_potion_altar") {
    const checkResult = checkPotionAltar(ws, ng, x, y, biomeName);
    if (checkResult) {
      let offsetX = -5;
      let offsetY = -15;
      if (BIOME_POTION_ALTAR_OFFSET_MAP[biomeName]) {
        offsetX = BIOME_POTION_ALTAR_OFFSET_MAP[biomeName].x;
        offsetY = BIOME_POTION_ALTAR_OFFSET_MAP[biomeName].y;
      }
      if (BIOMES_WITH_SMALL_ALTARS.includes(biomeName)) {
        return loadPixelScene(biomeData, biomeName, "potion_altar_vault", ws, ng, x + offsetX, y + offsetY, skipCosmeticScenes, false, gameMode);
      } else {
        return loadPixelScene(biomeData, biomeName, "potion_altar", ws, ng, x + offsetX, y + offsetY, skipCosmeticScenes, false, gameMode);
      }
    } else {
      return null;
    }
  } else if (func === "spawn_potion" || func === "spawn_potions") {
    return spawnItem(ws, ng, x, y, biomeName, perks, gameMode);
  } else if (func === "spawn_heart") {
    return spawnHeart(ws, ng, x, y, biomeName, perks, gameMode);
  } else if (func === "spawn_chest") {
    return spawnChest(ws, ng, x, y, biomeName.includes("tower"), perks, gameMode);
  } else if (func === "load_altar") {
    return loadPixelScene(biomeData, biomeName, "trailer_altar", ws, ng, x - 92, y - 96, skipCosmeticScenes, true, gameMode);
  } else if (func === "spawn_treasure") {
    return { type: "item", item: "treasure", x, y };
  } else if (func === "spawn_specialshop") {
  } else if (func === "spawn_music_machine") {
    return { type: "item", item: "music_machine", x, y };
  }
  if (PIXEL_SCENE_BIOME_MAP[biomeName]) {
    if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_01"] && func === "load_pixel_scene") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_01"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_01_alt"] && func === "load_pixel_scene_alt") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_01_alt"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_02"] && func === "load_pixel_scene2") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_02"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_03"] && func === "load_pixel_scene3") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_03"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_04"] && func === "load_pixel_scene4") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_04"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_04_alt"] && func === "load_pixel_scene4_alt") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_04_alt"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_05"] && func === "load_pixel_scene5") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_05"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_05b"] && func === "load_pixel_scene5b") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_05b"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    } else if (PIXEL_SCENE_BIOME_MAP[biomeName]["g_pixel_scene_05_alt"] && func === "load_pixel_scene5_alt") {
      return loadRandomPixelScene(biomeData, biomeName, scenes["g_pixel_scene_05_alt"], ws, ng, x, y, skipCosmeticScenes, gameMode);
    }
  }
  return null;
}

// vendor/noita-telescope-main/js/temple_generation.js
var templeX = [-32, -32, -32, -32, -32, -32, 2560];
var templeY = [1410, 2946, 4994, 6530, 8578, 10626, 13181];
var templeTiers = [0, 1, 2, 2, 3, 4, 6];
var templeXNGPlus = [-32, -32, -32, -32, 2560];
var templeYNGPlus = [1410, 2946, 6530, 10626, 13181];
var templeTiersNGPlus = [0, 1, 2, 4, 6];
var templeXNightmare = [-32, -32, -32, -32, 2560];
var templeYNightmare = [1410, 3970, 6530, 10626, 13181];
var templeTiersNightmare = [0, 2, 2, 4, 6];
function generateHolyMountainShops(ws, ng, pwIndex, perks = {}, gameMode = "normal") {
  const isNGPlus = ng > 0;
  const worldSize = getWorldSize(isNGPlus, gameMode);
  const extraShopItems = perks["extraShopItems"] ? perks["extraShopItems"] : 0;
  const noMoreShuffle = perks["noMoreShuffle"] ? perks["noMoreShuffle"] : false;
  let templeLoot = [];
  for (let hmIndex = 0; hmIndex < 6 - (isNGPlus || gameMode === "nightmare" ? 2 : 0); hmIndex++) {
    let x = (isNGPlus ? templeXNGPlus : gameMode === "nightmare" ? templeXNightmare : templeX)[hmIndex] - 46 + pwIndex * 512 * worldSize;
    let y = (isNGPlus ? templeYNGPlus : gameMode === "nightmare" ? templeYNightmare : templeY)[hmIndex] - 39;
    let chest = generateChest(ws, ng, x, y, perks, gameMode);
    chest["type"] = "pacifist_chest";
    chest["biome"] = "temple_altar";
    templeLoot.push(chest);
  }
  let prng2 = new NollaPrng(0);
  let width = 132;
  let itemCount = extraShopItems + 5;
  let stepSize = width / itemCount;
  for (let hmIndex = 0; hmIndex < (pwIndex == 0 ? 7 : 6) - (isNGPlus || gameMode === "nightmare" ? 2 : 0); hmIndex++) {
    let x = (isNGPlus ? templeXNGPlus : gameMode === "nightmare" ? templeXNightmare : templeX)[hmIndex] - 299 + pwIndex * 512 * worldSize;
    let y = (isNGPlus ? templeYNGPlus : gameMode === "nightmare" ? templeYNightmare : templeY)[hmIndex] - 15;
    let tier = (isNGPlus ? templeTiersNGPlus : gameMode === "nightmare" ? templeTiersNightmare : templeTiers)[hmIndex];
    prng2.SetRandomSeed(ws + ng, x, y);
    let saleItem = prng2.Random(0, itemCount - 1);
    let sellWands = prng2.Random(0, 100) > 50;
    if (sellWands) {
      let wandList = [];
      for (let i = 0; i < itemCount; i++) {
        let shopWand = getShopWand(ws, ng, x + i * stepSize, y, Math.max(1, tier), noMoreShuffle);
        if (i === saleItem) shopWand["is_sale"] = true;
        wandList.push(shopWand);
      }
      templeLoot.push({ type: "holy_mountain_shop", items: wandList, x, y, biome: "temple_altar" });
    } else {
      let spellList = [];
      for (let i = 0; i < itemCount; i++) {
        spellList.push(generateShopItem(ws, ng, Math.fround(x + i * stepSize), y - 30, tier, 0));
        spellList.push(generateShopItem(ws, ng, Math.fround(x + i * stepSize), y, tier, 0));
      }
      templeLoot.push({ type: "holy_mountain_shop", items: spellList, x, y, biome: "temple_altar" });
    }
  }
  return templeLoot;
}
function getShopWand(ws, ng, x, y, tier, noMoreShuffle = false) {
  let prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws + ng, x, y);
  let shuffle = prng2.Random(0, 100) <= 50;
  let wand_type_name = "wand_" + (shuffle ? "level_" : "unshuffle_") + ("0" + tier);
  return createWand(ws, ng, Math.round(x), Math.round(y), WAND_TYPES[wand_type_name], false, noMoreShuffle);
}

// vendor/noita-telescope-main/js/poi_scanner.js
var MAX_SCAN_CYCLES = 10;
var ORIGINAL_BIOME_SPAWNS = /* @__PURE__ */ new Set([
  "spawn_heart",
  "spawn_chest",
  //'spawn_items', // This was a mistake. Understandable, honestly, since this has a very misleading name, but it's actually for the wand altar pixel scene
  // Instead, these two needed to be included
  "spawn_wands",
  "spawn_potions"
]);
function getTileScanPoint(worldX, worldY) {
  const axis = (w) => {
    const phase = (Math.floor(w / 512) * 512 % 10 + 10) % 10;
    const base2 = ((phase - w) % 10 + 10) % 10;
    return w + (base2 >= 5 ? base2 : base2 + 10);
  };
  return { x: axis(worldX), y: axis(worldY) };
}
function prescanPixelScene(imgData, sourceBiome) {
  const clearSpawnPixels = appSettings.clearSpawnPixels;
  const detectedSpawns = [];
  if (!imgData) return detectedSpawns;
  const sWidth = imgData.width;
  const sHeight = imgData.height;
  for (let y = 0; y < sHeight; y++) {
    for (let x = 0; x < sWidth; x++) {
      const idx = (y * sWidth + x) * 4;
      const r = imgData.data[idx];
      const g = imgData.data[idx + 1];
      const b = imgData.data[idx + 2];
      const a = imgData.data[idx + 3];
      if (a === 0) continue;
      const colorInt = r << 16 | g << 8 | b;
      if (colorInt === 0 || colorInt === 16777215) continue;
      const index = getSpawnFunctionIndex(sourceBiome, colorInt);
      if (index !== null) {
        detectedSpawns.push({
          sourceBiome,
          x,
          y,
          spawnFunctionIndex: index
        });
      }
      if (clearSpawnPixels && index !== null) {
        imgData.data[idx] = 0;
        imgData.data[idx + 1] = 0;
        imgData.data[idx + 2] = 0;
        imgData.data[idx + 3] = 0;
      }
    }
  }
  return detectedSpawns;
}
function getPixelSceneSpawnFunctionIndices(biomeData, biomeName, pixelScene, worldSeed, ngPlusCount, skipCosmeticScenes = true, perks = {}, gameMode = "normal") {
  let detectedSpawns = [];
  let newPixelScenes = [];
  let generatedSpawns = [];
  const spawnFunctions = BIOME_SPAWN_FUNCTION_MAP[biomeName] || [];
  if (spawnFunctions.length === 0) return { detectedSpawns, newPixelScenes, generatedSpawns };
  let spellList = [];
  let potionList = [];
  const spawnPoints = PIXEL_SCENE_SPAWN_DATA[pixelScene.key];
  for (const spawnPoint of spawnPoints) {
    const spawnX = pixelScene.x + spawnPoint.x;
    const spawnY = pixelScene.y + spawnPoint.y;
    const index = spawnPoint.spawnFunctionIndex;
    if (index === null || index >= 0 && !spawnFunctions[index]) continue;
    if (index >= 0 && spawnFunctions[index].isPixelScene) {
      const nestedSpawnData = spawnSwitch(biomeData, biomeName, index, worldSeed, ngPlusCount, spawnX, spawnY, skipCosmeticScenes, perks, gameMode);
      if (nestedSpawnData && nestedSpawnData.type === "pixel_scene") {
        newPixelScenes.push(nestedSpawnData);
      }
    } else {
      if (pixelScene.name.includes("laboratory")) {
        const spawnData = spawnSwitch(biomeData, biomeName, index, worldSeed, ngPlusCount, spawnX, spawnY, skipCosmeticScenes, perks, gameMode);
        if (spawnData && spawnData.item === "potion") {
          potionList.push(spawnData);
        }
      } else if (pixelScene.name.includes("shop")) {
        const spawnData = spawnSwitch(biomeData, biomeName, index, worldSeed, ngPlusCount, spawnX, spawnY, skipCosmeticScenes, perks, gameMode);
        if (spawnData && spawnData.item === "spell") {
          spellList.push(spawnData);
        }
      } else {
        detectedSpawns.push({
          sourceBiome: biomeName,
          x: spawnX,
          y: spawnY,
          spawnFunctionIndex: index,
          fromPixelScene: true,
          // The game resolves the spawn biome for the whole scene at its center
          sceneCenterX: pixelScene.x + Math.floor(pixelScene.width / 2),
          sceneCenterY: pixelScene.y + Math.floor(pixelScene.height / 2)
        });
      }
    }
  }
  if (spellList.length > 0) {
    const worldX = pixelScene.x + pixelScene.width / 2;
    const worldY = pixelScene.y + pixelScene.height / 2;
    const shopData = { type: "shop", items: spellList, x: worldX, y: worldY, biome: biomeName };
    generatedSpawns.push(shopData);
  }
  if (potionList.length > 0) {
    let dedupedItems = [];
    for (let item of potionList) {
      let found = false;
      for (let deduped of dedupedItems) {
        if (isDuplicateObject(deduped, item)) {
          if (deduped.amount && item.amount) deduped.amount += item.amount;
          deduped.count = (deduped.count || 1) + 1;
          found = true;
          break;
        }
      }
      if (!found) {
        dedupedItems.push(item);
      }
    }
    const worldX = pixelScene.x + pixelScene.width / 2;
    const worldY = pixelScene.y + pixelScene.height / 2;
    const labData = { type: "laboratory", items: dedupedItems, x: worldX, y: worldY, biome: biomeName };
    generatedSpawns.push(labData);
  }
  if (pixelScene.name === "trailer_altar") {
    generatedSpawns.push({
      type: "item",
      item: "trailer_altar",
      x: pixelScene.x + pixelScene.width / 2,
      y: pixelScene.y + pixelScene.height / 2,
      biome: biomeName
    });
  }
  if (pixelScene.name === "meditation_cube_visual") {
    generatedSpawns.push({
      type: "item",
      item: "meditation_cube",
      x: pixelScene.x + 20,
      y: pixelScene.y + 29 - 70,
      // Match teleporter position
      biome: biomeName
    });
  }
  return { detectedSpawns, newPixelScenes, generatedSpawns };
}
function getChunkBasesForTileIndexAxis(tileIndex, off) {
  const out = [];
  const lo = tileIndex * TILE_SIZE - off - 1;
  const hi = tileIndex * TILE_SIZE - off + TILE_SIZE + 1;
  for (let s = Math.ceil(lo); s <= hi; s++) {
    if (Math.floor((s + off + 0.5) / TILE_SIZE) !== tileIndex) continue;
    const cb = Math.floor(s / CHUNK_SIZE) * CHUNK_SIZE;
    if (((s - cb) % TILE_SIZE + TILE_SIZE) % TILE_SIZE !== 0) continue;
    if (!out.includes(cb)) out.push(cb);
  }
  return out;
}
function passesSpawnChunkGate(emitX, emitY, isNGP, gameMode) {
  const offX = getWorldCenter(isNGP, gameMode) * CHUNK_SIZE;
  const offY = WORLD_CHUNK_CENTER_Y * CHUNK_SIZE;
  const half = TILE_SIZE / 2;
  const cellX = Math.round((emitX + half + offX) / TILE_SIZE);
  const cellY = Math.round((emitY + half + offY) / TILE_SIZE);
  const rx = getChunkBasesForTileIndexAxis(cellX, offX);
  const ry = getChunkBasesForTileIndexAxis(cellY, offY);
  for (const cX of rx) {
    if (!(cX <= emitX && emitX < cX + (CHUNK_SIZE - 1))) continue;
    for (const cY of ry) {
      if (cY <= emitY && emitY < cY + (CHUNK_SIZE - 1)) return true;
    }
  }
  return false;
}
function prescanSpawnFunctions(tileLayers, isNGP, gameMode = "normal") {
  const t0 = performance.now();
  let detectedSpawns = [];
  for (const layer of tileLayers) {
    const sourceBiome = layer.biomeName;
    const width = layer.width;
    const height = layer.mapH;
    const sourceSpawnFunctions = BIOME_SPAWN_FUNCTION_MAP[sourceBiome] || [];
    if (!layer.buffer) {
      console.log("Skipping layer:", layer);
      continue;
    }
    if (sourceSpawnFunctions.length === 0) continue;
    for (let y = 4; y < height + 4; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 3;
        const r = layer.buffer[srcIdx];
        const g = layer.buffer[srcIdx + 1];
        const b = layer.buffer[srcIdx + 2];
        const colorInt = r << 16 | g << 8 | b;
        if (colorInt === 0 || colorInt === 16777215) continue;
        const index = getSpawnFunctionIndex(sourceBiome, colorInt);
        if (index !== null) {
          const coords = tileToWorldCoordinates(layer.minX, layer.minY, x, y - 4, 0, 0, isNGP, gameMode);
          detectedSpawns.push({
            sourceBiome,
            x: coords.x,
            // Note: PW0
            y: coords.y,
            spawnFunctionIndex: index
          });
        }
      }
    }
  }
  const t1 = performance.now();
  console.log(`[Generator] Spawn function prescan completed in ${(t1 - t0).toFixed(2)} ms with ${detectedSpawns.length} detected spawn points.`);
  return detectedSpawns;
}
function scanSpawnFunctions(biomeData, tileSpawns, worldSeed, ngPlusCount, pwIndex, pwIndexVertical, skipCosmeticScenes = true, perks = {}, gameMode = "normal") {
  const t0 = performance.now();
  let detectedSpawns = tileSpawns.map((spawn) => ({
    ...spawn,
    fromPixelScene: false,
    x: spawn.x + pwIndex * getWorldSize(ngPlusCount > 0, gameMode) * 512 - (ngPlusCount > 0 || gameMode === "nightmare" ? 8 * pwIndex : 0),
    y: spawn.y + pwIndexVertical * 24570
  })).filter((spawn) => passesSpawnChunkGate(spawn.x, spawn.y, ngPlusCount > 0, gameMode));
  let generatedSpawns = [];
  let finalPixelScenes = [];
  let newPixelScenes = [];
  const shopsPerChunk = {};
  let scanCycles = 0;
  do {
    let numberOfNewPixelScenes = newPixelScenes.length;
    for (let i = 0; i < numberOfNewPixelScenes; i++) {
      const pixelScene = newPixelScenes[i];
      finalPixelScenes.push(pixelScene);
      const target = getBiomeAtWorldCoordinates(biomeData, pixelScene.x, pixelScene.y, ngPlusCount > 0, gameMode, true);
      const targetBiome = pixelScene.biome || (target ? target.biome : null);
      const pixelSceneResults = getPixelSceneSpawnFunctionIndices(biomeData, targetBiome, pixelScene, worldSeed, ngPlusCount, skipCosmeticScenes, perks, gameMode);
      detectedSpawns.push(...pixelSceneResults.detectedSpawns.map((s) => ({ ...s, fromPixelScene: true })));
      newPixelScenes.push(...pixelSceneResults.newPixelScenes);
      numberOfNewPixelScenes += pixelSceneResults.newPixelScenes.length;
      generatedSpawns.push(...pixelSceneResults.generatedSpawns);
    }
    newPixelScenes = [];
    detectedSpawns.forEach((spawn) => {
      let targetBiome;
      const srcFn = (BIOME_SPAWN_FUNCTION_MAP[spawn.sourceBiome] || [])[spawn.spawnFunctionIndex];
      const srcFnName = srcFn ? srcFn.funcName : null;
      if (spawn.fromPixelScene) {
        const ccx = spawn.sceneCenterX ?? spawn.x, ccy = spawn.sceneCenterY ?? spawn.y;
        const target = getBiomeAtWorldCoordinates(biomeData, ccx, ccy, ngPlusCount > 0, gameMode, true);
        const centerBiome = target ? target.biome : null;
        if (centerBiome && centerBiome !== spawn.sourceBiome) {
          const color = srcFn ? srcFn.color : null;
          const newIdx = color != null ? getSpawnFunctionIndex(centerBiome, color) : null;
          if (newIdx === null || newIdx === void 0) return;
          spawn.spawnFunctionIndex = newIdx;
        }
        targetBiome = centerBiome;
      } else if (ORIGINAL_BIOME_SPAWNS.has(srcFnName)) {
        const sp = getTileScanPoint(spawn.x, spawn.y);
        const spResolved = getResolvedBiome(biomeData, sp.x, sp.y, ngPlusCount > 0, gameMode);
        if (spResolved.biome !== spResolved.origBiome) return;
        const resolved = getResolvedBiome(biomeData, spawn.x, spawn.y, ngPlusCount > 0, gameMode);
        targetBiome = resolved.origBiome;
      } else {
        const sp = getTileScanPoint(spawn.x, spawn.y);
        const resolved = getResolvedBiome(biomeData, sp.x, sp.y, ngPlusCount > 0, gameMode);
        if (resolved.biome !== resolved.origBiome) return;
        targetBiome = resolved.origBiome;
      }
      if (targetBiome) {
        const spawnData = spawnSwitch(biomeData, targetBiome, spawn.spawnFunctionIndex, worldSeed, ngPlusCount, spawn.x, spawn.y, skipCosmeticScenes, perks, gameMode, spawn.fromPixelScene);
        if (spawnData) {
          spawnData.biome = targetBiome;
          if (spawn.sourceBiome != targetBiome) {
            spawnData.originalBiome = spawn.sourceBiome;
            spawnData.originalX = spawn.x;
            spawnData.originalY = spawn.y;
          }
          if (spawnData.type === "pixel_scene") {
            if (scanCycles <= MAX_SCAN_CYCLES - 1) {
              newPixelScenes.push(spawnData);
            } else {
              generatedSpawns.push(spawnData);
            }
          } else {
            generatedSpawns.push(spawnData);
          }
        }
      }
    });
    detectedSpawns = [];
    scanCycles++;
  } while (newPixelScenes.length > 0 && scanCycles <= MAX_SCAN_CYCLES);
  for (const chunkKey in shopsPerChunk) {
    const spells = shopsPerChunk[chunkKey];
    const [biomeName, chunkX, chunkY] = chunkKey.split("/").map((v, i) => i === 0 ? v : Number(v));
    const worldX = chunkX * 512 + 256 - getWorldCenter(ngPlusCount > 0, gameMode) * 512 + getWorldSize(ngPlusCount > 0, gameMode) * 512 * pwIndex;
    const worldY = chunkY * 512 + 256 - 14 * 512 + 24570 * pwIndexVertical;
    const shopData = { type: "shop", items: spells, x: worldX, y: worldY, biome: biomeName, originalBiome: biomeName };
    generatedSpawns.push(shopData);
  }
  const t1 = performance.now();
  console.log(`[Generator] Spawn function scanning completed in ${(t1 - t0).toFixed(2)} ms with ${generatedSpawns.length} generated spawns and ${finalPixelScenes.length} pixel scenes from ${scanCycles} scan cycles.`);
  return {
    generatedSpawns,
    finalPixelScenes
  };
}
function getSpecialPoIs(biomeData, worldSeed, ngPlusCount, pwIndex, pwIndexVertical, perks = {}, gameMode = "normal") {
  const biomeMap = biomeData.pixels;
  let pois = [];
  if (pwIndexVertical === 0) {
    if (GENERATOR_CONFIG["temple_altar"].enabled) {
      let hmPoIs = generateHolyMountainShops(worldSeed, ngPlusCount, pwIndex, perks, gameMode);
      pois = pois.concat(hmPoIs);
    }
    if (GENERATOR_CONFIG["snowcastle_hourglass_chamber"].enabled) {
      let roomExists = true;
      if (ngPlusCount > 0) {
        const color = GENERATOR_CONFIG["snowcastle_hourglass_chamber"].color & 16777215;
        roomExists = biomeMap.some((p) => (p & 16777215) === color);
      }
      if (roomExists) {
        let eyeRoom = generateEyeRoom(worldSeed, ngPlusCount, pwIndex, gameMode);
        pois = pois.concat([eyeRoom]);
      }
    }
    if (pwIndex === 0 && ngPlusCount === 0 && gameMode === "normal") {
      if (GENERATOR_CONFIG["snowcastle_cavern"].enabled) {
        let hourglassShop = generateHourglassShop(worldSeed);
        pois = pois.concat([hourglassShop]);
      }
      let portal = generatePortal(worldSeed);
      if (portal) {
        pois = pois.concat([portal]);
      }
    }
    if (GENERATOR_CONFIG["excavationsite_cube_chamber"].enabled) {
      let roomExists = true;
      if (ngPlusCount > 0) {
        const color = GENERATOR_CONFIG["excavationsite_cube_chamber"].color & 16777215;
        roomExists = biomeMap.some((p) => (p & 16777215) === color);
      }
      if (roomExists) {
        let meditationCubeWand = generateMeditationCube(worldSeed, ngPlusCount, pwIndex, perks, gameMode);
        if (meditationCubeWand) {
          pois = pois.concat([meditationCubeWand]);
        }
      }
    }
    if (GENERATOR_CONFIG["robot_egg"].enabled) {
      let roomExists = true;
      if (ngPlusCount > 0) {
        const color = GENERATOR_CONFIG["robot_egg"].color & 16777215;
        roomExists = biomeMap.some((p) => (p & 16777215) === color);
      }
      if (roomExists) {
        let robotEgg = generateRobotEgg(worldSeed, ngPlusCount, pwIndex, perks, gameMode);
        if (robotEgg) {
          pois = pois.concat([robotEgg]);
        }
      }
    }
    if (ngPlusCount === 0 && gameMode === "normal") {
      if (GENERATOR_CONFIG["snowcave_secret_chamber"].enabled) {
        let snowyRoomWands = generateSnowyRoom(worldSeed, pwIndex, perks);
        if (snowyRoomWands) {
          pois = pois.concat(snowyRoomWands);
        }
      }
      if (GENERATOR_CONFIG["wizardcave_entrance"].enabled) {
        let triangleBossDrops = generateTriangleBossDrops(worldSeed, pwIndex);
        if (triangleBossDrops) {
          pois = pois.concat([triangleBossDrops]);
        }
      }
      if (GENERATOR_CONFIG["secret_lab"].enabled) {
        let alchemistBossDrops = generateAlchemistBossDrops(worldSeed, pwIndex);
        if (alchemistBossDrops) {
          pois = pois.concat([alchemistBossDrops]);
        }
      }
      if (GENERATOR_CONFIG["dragoncave"].enabled) {
        let dragonBossDrops = generateDragonBossDrops(worldSeed, pwIndex);
        if (dragonBossDrops) {
          pois = pois.concat([dragonBossDrops]);
        }
      }
    }
  }
  if (ngPlusCount === 0 && pwIndex === 0) {
    if (GENERATOR_CONFIG["pyramid_top"].enabled) {
      let pyramidBossDrops = generatePyramidBossDrops(worldSeed, pwIndex);
      if (pyramidBossDrops) {
        pois = pois.concat([pyramidBossDrops]);
      }
    }
    if (gameMode === "normal") {
      if (pwIndexVertical === 1) {
        let hellShop = generateEndShop(worldSeed, ngPlusCount, pwIndexVertical);
        if (hellShop) {
          pois = pois.concat([hellShop]);
        }
      } else if (pwIndexVertical === -1) {
        let heavenShop = generateEndShop(worldSeed, ngPlusCount, pwIndexVertical);
        if (heavenShop) {
          pois = pois.concat([heavenShop]);
        }
      }
    }
  }
  return pois;
}

// vendor/noita-telescope-main/js/image_processing.js
async function createBiomeColorLookup(mapPath) {
  const [img1, img2] = await Promise.all([
    loadPNG("../data/biome_maps/biome_map.png"),
    loadPNG(mapPath)
  ]);
  const nameLookup = {};
  const backgroundColors = {};
  for (let i = 0; i < img1.data.length; i += 4) {
    const color1 = img1.data[i] << 16 | img1.data[i + 1] << 8 | img1.data[i + 2];
    const color2 = img2.data[i] << 16 | img2.data[i + 1] << 8 | img2.data[i + 2];
    if (BIOME_COLOR_TO_NAME[color1]) {
      nameLookup[BIOME_COLOR_TO_NAME[color1]] = color2;
    }
    backgroundColors[color1] = color2;
  }
  nameLookup["temple_altar_right_snowcave"] = 5128498;
  backgroundColors[9685839] = 5128498;
  nameLookup["temple_altar_right_snowcastle"] = 5128499;
  backgroundColors[9685850] = 5128499;
  backgroundColors[4334669] = 2824468;
  backgroundColors[6262699] = 2824468;
  backgroundColors[2394250] = 4539201;
  backgroundColors[1627862] = 4539201;
  backgroundColors[14080227] = 987676;
  backgroundColors[13408580] = 2103828;
  backgroundColors[1408181] = 1906452;
  backgroundColors[5757646] = 1906452;
  backgroundColors[4013633] = 1906452;
  return [nameLookup, backgroundColors];
}
var BIOME_BACKGROUND_COLORS = {};
var BIOME_COLOR_LOOKUP = {};
var TILE_OVERLAY_COLORS = {};
var TILE_FOREGROUND_COLORS = {};
var _initPromise = null;
function initBiomeColors() {
  return _initPromise ??= (async () => {
    [BIOME_BACKGROUND_COLORS, BIOME_COLOR_LOOKUP] = await createBiomeColorLookup("../data/biome_maps/biome_map_background.png");
    [TILE_OVERLAY_COLORS, TILE_FOREGROUND_COLORS] = await createBiomeColorLookup("../data/biome_maps/biome_map_foreground.png");
  })();
}
if (typeof process === "undefined" || !process?.versions?.node) {
  await initBiomeColors();
}
function createTileOverlaysCheap(biomeData, layers, pwIndex, pwIndexVertical, isNGP, gameMode = "normal") {
  const recolorMaterials = appSettings.recolorMaterials;
  const clearSpawnPixels = appSettings.clearSpawnPixels;
  const mapWidth = getWorldSize(isNGP, gameMode);
  const mapHeight = 48;
  const t0 = performance.now();
  const overlays = [];
  let biomeMap = biomeData.pixels;
  if (pwIndexVertical < 0) {
    biomeMap = biomeData.heavenPixels;
  } else if (pwIndexVertical > 0) {
    biomeMap = biomeData.hellPixels;
  }
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const buffer = layer.buffer;
    if (!buffer) {
      overlays.push(null);
      continue;
    }
    const width = layer.width;
    const mapH = layer.mapH;
    const canvas = new OffscreenCanvas(width, mapH);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const outImageData = ctx.createImageData(width, mapH);
    const out32 = new Uint32Array(outImageData.data.buffer);
    const originCoords = tileToWorldCoordinates(layer.minX, layer.minY, 0, 0, pwIndex, pwIndexVertical, isNGP, gameMode);
    for (let y = 4; y < mapH + 4; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const srcIdx = idx * 3;
        const targetIdx = (y - 4) * width + x;
        if (buffer[srcIdx] === buffer[srcIdx + 1] && buffer[srcIdx + 1] === buffer[srcIdx + 2] && buffer[srcIdx] > 0) {
          const coordX = originCoords.x + x * TILE_SIZE;
          const coordY = originCoords.y + (y - 4) * TILE_SIZE;
          const roundedX = (Math.floor((coordX + mapWidth * 512 / 2) / 512) % mapWidth + mapWidth) % mapWidth;
          const roundedY = (Math.floor((coordY + 14 * 512) / 512) % mapHeight + mapHeight) % mapHeight;
          const biomeColor = biomeMap[roundedY * mapWidth + roundedX] & 16777215;
          const foregroundColor = TILE_FOREGROUND_COLORS[biomeColor];
          if (BIOME_COLORS_WITH_TILES.has(biomeColor) && foregroundColor) {
            const r = foregroundColor >> 16 & 255;
            const g = foregroundColor >> 8 & 255;
            const b = foregroundColor & 255;
            out32[targetIdx] = 255 << 24 | b << 16 | g << 8 | r;
          }
        } else {
          if (buffer[srcIdx] > 0 || buffer[srcIdx + 1] > 0 || buffer[srcIdx + 2] > 0) {
            const spawnCoordX = originCoords.x + x * TILE_SIZE;
            const spawnCoordY = originCoords.y + (y - 4) * TILE_SIZE;
            const spawnRoundedX = (Math.floor((spawnCoordX + mapWidth * 512 / 2) / 512) % mapWidth + mapWidth) % mapWidth;
            const spawnRoundedY = (Math.floor((spawnCoordY + 14 * 512) / 512) % mapHeight + mapHeight) % mapHeight;
            const spawnBiomeColor = biomeMap[spawnRoundedY * mapWidth + spawnRoundedX] & 16777215;
            if (!clearSpawnPixels) {
              if (BIOME_COLORS_WITH_TILES.has(spawnBiomeColor)) {
                out32[targetIdx] = 255 << 24 | buffer[srcIdx + 2] << 16 | buffer[srcIdx + 1] << 8 | buffer[srcIdx];
              }
            }
            if (recolorMaterials) {
              const biomeColor = spawnBiomeColor;
              if (biomeColor && BIOME_COLORS_WITH_TILES.has(biomeColor)) {
                const wangColor = buffer[srcIdx] << 16 | buffer[srcIdx + 1] << 8 | buffer[srcIdx + 2];
                const materialColor = MATERIAL_COLOR_CONVERSION[wangColor];
                if (materialColor) {
                  const r = materialColor >> 16 & 255;
                  const g = materialColor >> 8 & 255;
                  const b = materialColor & 255;
                  out32[targetIdx] = 255 << 24 | b << 16 | g << 8 | r;
                }
              }
            }
          }
        }
      }
    }
    ctx.putImageData(outImageData, 0, 0);
    overlays.push(canvas);
  }
  const t1 = performance.now();
  console.log(`[Tile Overlays] PW ${pwIndex},${pwIndexVertical} took ${(t1 - t0).toFixed(2)} ms`);
  return overlays;
}
function makeBlackTransparent(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
      data[i + 3] = 0;
    }
  }
}

// vendor/noita-telescope-main/js/pixel_scene_generation.js
var PIXEL_SCENE_DATA = {};
var PIXEL_SCENE_SPAWN_DATA = {};
var PIXEL_SCENE_CANVAS_CACHE = {};
var SCENES_TO_NOT_RECOLOR = ["wand_altar", "wand_altar_vault", "potion_altar", "potion_altar_vault"];
function getPixelSceneCanvas(pixelScene) {
  const pixelSceneKey = pixelScene.key;
  const variantKey = pixelScene.variantKey || "";
  const key = `${pixelSceneKey}/${variantKey}`;
  if (PIXEL_SCENE_CANVAS_CACHE[key]) return PIXEL_SCENE_CANVAS_CACHE[key];
  const pixelSceneData = PIXEL_SCENE_DATA[pixelSceneKey].variants[variantKey];
  if (!pixelSceneData) {
    return null;
  }
  const width = PIXEL_SCENE_DATA[pixelSceneKey].width;
  const height = PIXEL_SCENE_DATA[pixelSceneKey].height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(pixelSceneData);
  ctx.putImageData(imageData, 0, 0);
  PIXEL_SCENE_CANVAS_CACHE[key] = canvas;
  return canvas;
}
function getBiomeAlias(biomeName) {
  if (biomeName === "coalmine_alt") return "coalmine";
  if (biomeName === "excavationsite_cube_chamber") return "excavationsite";
  if (biomeName === "snowcave_secret_chamber") return "snowcave";
  if (biomeName === "sandcave" || biomeName === "snowcastle_cavern" || biomeName === "snowcastle_hourglass_chamber") return "snowcastle";
  if (biomeName === "rainforest_open" || biomeName === "rainforest_dark") return "rainforest";
  if (biomeName === "vault_frozen") return "vault";
  if (biomeName === "the_end" || biomeName === "the_sky") return "crypt";
  if (biomeName === "scale") return "overworld";
  if (biomeName.includes("temple")) return "temple";
  if (biomeName.includes("pyramid")) return "pyramid";
  if (biomeName.includes("mountain")) return "mountain";
  return biomeName;
}
var GENERAL_SCENE_NAMES = GENERAL_SCENES["extras"].map((scene) => scene.name);
function getPixelSceneKey(biomeName, sceneName) {
  if (biomeName.includes("temple")) return "temple/" + sceneName;
  if (biomeName.includes("pyramid")) return "pyramid/" + sceneName;
  if (biomeName.includes("mountain")) return "mountain/" + sceneName;
  if (!biomeName || GENERAL_SCENE_NAMES.includes(sceneName) || !GENERATOR_CONFIG[biomeName]) return "general/" + sceneName;
  return biomeName + "/" + sceneName;
}
async function loadPixelSceneData() {
  let loaded = 0;
  for (const biome of Object.keys(PIXEL_SCENE_BIOME_MAP)) {
    const biomeScenes = PIXEL_SCENE_BIOME_MAP[biome];
    for (const sceneList of Object.values(biomeScenes)) {
      for (const scene of sceneList) {
        if (scene.name === "") continue;
        const key = getPixelSceneKey(biome, scene.name);
        if (!PIXEL_SCENE_DATA[key]) {
          const url = `../data/pixel_scenes/${getBiomeAlias(biome)}/${scene.name}.png`;
          const imgData = await loadPNG(url);
          makeBlackTransparent(imgData.data);
          const spawnPoints = prescanPixelScene(imgData, biome);
          PIXEL_SCENE_SPAWN_DATA[key] = spawnPoints;
          PIXEL_SCENE_DATA[key] = {
            key,
            biome,
            name: scene.name,
            imgElement: imgData.data,
            // Store the image data directly since we need to manipulate it for recoloring
            width: imgData.width,
            height: imgData.height,
            //spawnPoints: spawnPoints,
            isCosmetic: spawnPoints.length === 0,
            // If there are no spawn points, we can consider it purely cosmetic and can optionally skip some checks during generation
            variants: {}
            // Used for color material changes, keyed as `${color}=${material}`
          };
          loaded++;
        }
      }
    }
  }
  console.log(`Loaded ${loaded} pixel scenes.`);
}
function blockOutRooms(pixels, width, height) {
  let rooms = [];
  for (let y = 4; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const color = pixels[idx] << 16 | pixels[idx + 1] << 8 | pixels[idx + 2];
      if (color === 0 || color === 16777215) continue;
      if (!BLOCKED_COLORS.includes(color)) continue;
      let startX = x + 1;
      let startY = y + 1;
      let endX = x + 1;
      let endY = y + 1;
      let foundEnd = false;
      while (!foundEnd && endX < width) {
        if (endX >= width) break;
        const tempIdx = (startY * width + endX) * 3;
        const tempColor = pixels[tempIdx] << 16 | pixels[tempIdx + 1] << 8 | pixels[tempIdx + 2];
        if (tempColor === 0 || tempColor === 3289650) {
          endX++;
          continue;
        }
        endX--;
        foundEnd = true;
      }
      if (endX >= width) endX = width - 1;
      foundEnd = false;
      while (!foundEnd && endY < height) {
        if (endY >= height) break;
        const tempIdx = (endY * width + startX) * 3;
        const tempColor = pixels[tempIdx] << 16 | pixels[tempIdx + 1] << 8 | pixels[tempIdx + 2];
        if (tempColor === 0 || tempColor === 3289650) {
          endY++;
          continue;
        }
        endY--;
        foundEnd = true;
      }
      if (endY >= height) endY = height - 1;
      if (endX > startX && endY > startY) {
        for (let by = startY; by <= endY; by++) {
          for (let bx = startX; bx <= endX; bx++) {
            const bIdx = (by * width + bx) * 3;
            pixels[bIdx] = 255;
            pixels[bIdx + 1] = 1;
            pixels[bIdx + 2] = 255;
          }
        }
      }
      rooms.push({ color, startX, startY, endX, endY });
    }
  }
  return rooms;
}
var CHECK_PIXEL_SCENE_BIOME = true;
function loadPixelScene(biomeData, biomeName, sceneName, ws, ng, x, y, skipCosmeticScenes = true, checkBounds = true, gameMode = "normal") {
  const pixelSceneKey = getPixelSceneKey(biomeName, sceneName);
  if (!PIXEL_SCENE_DATA[pixelSceneKey]) {
    console.warn(`Pixel scene data not found for key ${pixelSceneKey}. This should not happen because we preload all pixel scene images.`);
    return null;
  }
  const pixelSceneData = PIXEL_SCENE_DATA[pixelSceneKey];
  if (pixelSceneData.isCosmetic && skipCosmeticScenes) {
    return null;
  }
  if (checkBounds && biomeName && CHECK_PIXEL_SCENE_BIOME) {
    const topLeft = getBiomeAtWorldCoordinates(biomeData, x, y, ng > 0, gameMode);
    if (!topLeft.biome && biomeEdgeNoiseFlag(topLeft.colorInt, "noise_biome_edges") === null) {
      console.log(`Rejected spawn for pixel scene ${sceneName} at (${x}, ${y}) with unknown biome color ${topLeft.colorInt.toString(16)} in original biome ${biomeName}. This likely means the biome map is missing colors from the data.wak unpack, such as NG+ palette swaps. Accepting spawn but returning null biome so it can be recolored without a biome-specific variant.`);
      return null;
    }
    if (topLeft.biome !== biomeName) {
      return null;
    }
  }
  if (!biomeName || biomeName === "general") {
    if (SCENES_TO_NOT_RECOLOR.includes(sceneName)) {
      biomeName = "general";
    } else {
      biomeName = getBiomeAtWorldCoordinates(biomeData, x + pixelSceneData.width / 2, y + pixelSceneData.height / 2, ng > 0, gameMode, true)?.biome || "general";
    }
  }
  if (sceneName !== "the_end_shop" && GENERAL_SCENE_NAMES.includes(sceneName)) {
    biomeName = "general";
  }
  const variantKey = `biome=${biomeName}`;
  return {
    key: pixelSceneKey,
    variantKey,
    name: sceneName,
    //imgElement: pixelSceneImage,
    width: pixelSceneData.width,
    height: pixelSceneData.height,
    x,
    y,
    //spawnPoints: pixelSceneData.spawnPoints,
    material: null,
    type: "pixel_scene"
  };
}
function loadRandomPixelScene(biomeData, biomeName, scene_list, ws, ng, x, y, skipCosmeticScenes = true, gameMode = "normal") {
  if (!scene_list || scene_list.length === 0) return null;
  const prng2 = new NollaPrng(0);
  let total_prob = 0;
  for (const scene of scene_list) {
    total_prob += scene.prob;
  }
  let r = prng2.ProceduralRandom(ws + ng, x, y) * total_prob;
  for (const scene of scene_list) {
    if (scene.prob <= 0) continue;
    if (r <= scene.prob) {
      if (scene.name === "") return null;
      const pixelSceneKey = getPixelSceneKey(biomeName, scene.name);
      if (!PIXEL_SCENE_DATA[pixelSceneKey]) {
        console.warn(`Pixel scene data not found for key ${pixelSceneKey}. This should not happen because we preload all pixel scene images.`);
        return null;
      }
      const pixelSceneData = PIXEL_SCENE_DATA[pixelSceneKey];
      if (pixelSceneData.isCosmetic && skipCosmeticScenes) {
        return null;
      }
      let outputScene = {
        key: pixelSceneKey,
        name: scene.name,
        //imgElement: pixelSceneData.imgElement,
        width: pixelSceneData.width,
        height: pixelSceneData.height,
        x,
        y,
        material: null,
        //spawnPoints: pixelSceneData.spawnPoints,
        type: "pixel_scene"
      };
      if (CHECK_PIXEL_SCENE_BIOME) {
        const w = pixelSceneData.width;
        const h = pixelSceneData.height;
        const corners = [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h]
        ];
        for (const [cx, cy] of corners) {
          const res = getBiomeAtWorldCoordinates(biomeData, cx, cy, ng > 0, gameMode, true);
          if (res.biome !== biomeName) {
            return null;
          }
        }
      }
      let variantKey = "";
      if (scene.color_material) {
        const sortedColors = Object.keys(scene.color_material).sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
        for (const color of sortedColors) {
          const materials = scene.color_material[color];
          prng2.SetRandomSeed(ws + ng, x + 11, y - 21);
          let r2 = prng2.ProceduralRandom(ws + ng, x + 11, y - 21);
          let mr = Math.ceil(r2 * materials.length) - 1;
          const targetMaterial = materials[mr];
          outputScene.material = targetMaterial;
          let materialColor = MATERIAL_WANG_COLORS[materials[mr]];
          variantKey += (variantKey !== "" ? "&" : "") + `${color}=${materialColor}`;
        }
      }
      const finalVariantKey = variantKey + (variantKey !== "" ? "&" : "") + `biome=${biomeName}`;
      outputScene.variantKey = finalVariantKey;
      return outputScene;
    }
    r -= scene.prob;
  }
  console.log(`Impossible zero probability outcome for pixel scene at (${x}, ${y}), total prob ${total_prob}, r ${r}: ${JSON.stringify(scene_list)}`);
  return null;
}

// vendor/noita-telescope-main/js/utils.js
var MATERIAL_CONTAINER_TYPES = [
  "potion",
  "pouch",
  "jar"
];
function tileToWorldCoordinates(chunkBaseX, chunkBaseY, tileX, tileY, pw = 0, pwVertical = 0, isNGP = false, gameMode = "normal") {
  const world_chunk_center_x = isNGP || gameMode === "nightmare" ? WORLD_CHUNK_CENTER_X_NGP : WORLD_CHUNK_CENTER_X;
  const worldSize = isNGP || gameMode === "nightmare" ? 64 * 512 - 8 : 70 * 512;
  let smallChunkSize = Math.floor(CHUNK_SIZE / TILE_SIZE);
  let div5offX = 5 * CHUNK_SIZE * Math.floor((chunkBaseX - world_chunk_center_x) / 5);
  let mod5offX = ((chunkBaseX - world_chunk_center_x) % 5 + 5) % 5;
  let worldBaseX = div5offX + mod5offX * smallChunkSize * TILE_SIZE;
  let worldX_alt = -TILE_SIZE + worldBaseX + tileX * TILE_SIZE + TILE_OFFSET_X;
  let div5offY = 5 * CHUNK_SIZE * Math.floor((chunkBaseY - WORLD_CHUNK_CENTER_Y) / 5);
  let mod5offY = ((chunkBaseY - WORLD_CHUNK_CENTER_Y) % 5 + 5) % 5;
  let worldBaseY = div5offY + mod5offY * smallChunkSize * TILE_SIZE;
  if (mod5offY > 0) worldBaseY += TILE_SIZE;
  let worldY_alt = -TILE_SIZE + worldBaseY + tileY * TILE_SIZE + TILE_OFFSET_Y;
  if (isNGP || gameMode === "nightmare") {
    if (mod5offX >= 3) worldX_alt += TILE_SIZE;
  }
  worldY_alt += TILE_SIZE;
  if (isNGP || gameMode === "nightmare") {
    worldX_alt -= 4;
  }
  worldX_alt += pw * worldSize;
  worldY_alt += pwVertical * 24570;
  return { x: worldX_alt, y: worldY_alt };
}
function roundRNGPos(num) {
  if (-1e6 < num && num < 1e6)
    return num;
  else if (-1e7 < num && num < 1e7)
    return roundHalfOfEven(num / 10) * 10;
  else if (-1e8 < num && num < 1e8)
    return roundHalfOfEven(num / 100) * 100;
  return num;
}
var WAND_KEYS = [
  "always_casts",
  "wand_type",
  "actions_per_round",
  "fire_rate_wait",
  "reload_time",
  "mana_max",
  "mana_charge_speed",
  "deck_capacity",
  "spread_degrees",
  "speed_multiplier",
  "shuffle_deck_when_empty",
  "sprite"
];
function isDuplicateObject(currentObj, newObj) {
  if (currentObj.type !== newObj.type) return false;
  if (currentObj.type === "wand") {
    if (currentObj.cards.length !== newObj.cards.length) return false;
    for (let i = 0; i < currentObj.cards.length; i++) {
      if (currentObj.cards[i] !== newObj.cards[i]) return false;
    }
    for (let key of WAND_KEYS) {
      if (Math.abs(currentObj[key] - newObj[key]) > 0.01) return false;
    }
    return true;
  } else {
    if (currentObj.item) {
      if (currentObj.item === "spell" && newObj.item === "spell") return currentObj.spell === newObj.spell;
      if (MATERIAL_CONTAINER_TYPES.includes(currentObj.item)) {
        return currentObj.material === newObj.material && currentObj.item === newObj.item;
      } else {
        return currentObj.item === newObj.item;
      }
    }
    return false;
  }
}
function shuffleTable(arr, prng2) {
  for (let i = arr.length - 1; i >= 1; i--) {
    let j = prng2.Random(0, i);
    let temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getWorldSize(isNGP, gameMode = "normal") {
  if (gameMode === "nightmare") return 64;
  return isNGP ? 64 : 70;
}
function getWorldCenter(isNGP, gameMode = "normal") {
  if (gameMode === "nightmare") return 32;
  return isNGP ? 32 : 35;
}
var PROBE_X = new Int32Array(8);
var PROBE_Y = new Int32Array(8);
var colorIneligible = (color) => biomeEdgeNoiseFlag(color, "noise_biome_edges") === 0;
function getBiomeAtWorldCoordinates(biomeData, worldX, worldY, isNGP = false, gameMode = "normal", useEdgeNoise = false) {
  let biomeMap = biomeData.pixels;
  if (worldY < -14 * 512) {
    biomeMap = biomeData.heavenPixels;
  } else if (worldY > 34 * 512) {
    biomeMap = biomeData.hellPixels;
  }
  const mapWidth = getWorldSize(isNGP, gameMode);
  const worldSize = mapWidth * 512;
  const worldCenter = worldSize / 2;
  const modX = ((worldX + worldCenter) % worldSize + worldSize) % worldSize;
  const modY = ((worldY + 14 * 512) % 24576 + 24576) % 24576;
  let highDetail = true;
  const subWX = (worldX % 512 + 512) % 512;
  const subWY = (worldY % 512 + 512) % 512;
  const nearEdgeX = subWX < 42 || subWX > 470;
  const nearEdgeY = subWY < 42 || subWY > 470;
  let edgeOffsetX = 0;
  let edgeOffsetY = 0;
  if (useEdgeNoise && (nearEdgeX || nearEdgeY)) {
    const edgeOffset = GetBiomeOffset(worldX, worldY, isNGP, highDetail, gameMode);
    edgeOffsetX = edgeOffset.x;
    edgeOffsetY = edgeOffset.y;
  }
  const originalX = Math.floor(modX / 512);
  const originalY = Math.floor(modY / 512);
  let biomePixelX = originalX + edgeOffsetX;
  let biomePixelY = originalY + edgeOffsetY;
  biomePixelX = (biomePixelX % mapWidth + mapWidth) % mapWidth;
  biomePixelY = Math.max(0, Math.min(47, biomePixelY));
  const idx = biomePixelY * mapWidth + biomePixelX;
  const colorInt = biomeMap[idx] & 16777215;
  let biomeName = BIOME_COLOR_TO_NAME[colorInt];
  const origIdx = originalY * mapWidth + originalX;
  const origColorInt = biomeMap[origIdx] & 16777215;
  const origBiomeName = BIOME_COLOR_TO_NAME[origColorInt];
  let skipWobble = colorIneligible(origColorInt) || colorIneligible(colorInt);
  if (!skipWobble) {
    let probeCount = 0;
    if (subWX < 42) {
      PROBE_X[probeCount] = originalX - 1;
      PROBE_Y[probeCount] = originalY;
      probeCount++;
    }
    if (subWY < 42) {
      PROBE_X[probeCount] = originalX;
      PROBE_Y[probeCount] = originalY - 1;
      probeCount++;
    }
    if (subWX > 470) {
      PROBE_X[probeCount] = originalX + 1;
      PROBE_Y[probeCount] = originalY;
      probeCount++;
    }
    if (subWY > 470) {
      PROBE_X[probeCount] = originalX;
      PROBE_Y[probeCount] = originalY + 1;
      probeCount++;
    }
    if (subWX < 42) {
      if (subWY < 42) {
        PROBE_X[probeCount] = originalX - 1;
        PROBE_Y[probeCount] = originalY - 1;
        probeCount++;
      }
      if (subWY > 470) {
        PROBE_X[probeCount] = originalX - 1;
        PROBE_Y[probeCount] = originalY + 1;
        probeCount++;
      }
    }
    if (subWX > 470) {
      if (subWY < 42) {
        PROBE_X[probeCount] = originalX + 1;
        PROBE_Y[probeCount] = originalY - 1;
        probeCount++;
      }
      if (subWY > 470) {
        PROBE_X[probeCount] = originalX + 1;
        PROBE_Y[probeCount] = originalY + 1;
        probeCount++;
      }
    }
    let foundDifferingNeighbor = false;
    for (let p = 0; p < probeCount; p++) {
      const pcx = PROBE_X[p], pcy = PROBE_Y[p];
      const ncx = (pcx % mapWidth + mapWidth) % mapWidth;
      const ncy = Math.max(0, Math.min(47, pcy));
      const nIdx = ncy * mapWidth + ncx;
      if (nIdx < 0 || nIdx >= biomeMap.length) continue;
      const ncolor = biomeMap[nIdx] & 16777215;
      if (ncolor === origColorInt) continue;
      foundDifferingNeighbor = true;
      if (colorIneligible(ncolor)) skipWobble = true;
      break;
    }
    if (probeCount > 0 && !foundDifferingNeighbor) {
      skipWobble = true;
    }
  }
  if (skipWobble) {
    biomePixelX = originalX;
    biomePixelY = originalY;
    biomeName = origBiomeName;
  }
  const finalColorInt = biomeMap[biomePixelY * mapWidth + biomePixelX] & 16777215;
  return {
    biome: biomeName || null,
    origBiome: origBiomeName || null,
    colorInt: finalColorInt,
    pos: { x: biomePixelX, y: biomePixelY },
    originalPos: { x: originalX, y: originalY },
    mightBeEdgeCase: edgeOffsetX !== 0 || edgeOffsetY !== 0
  };
}
function getResolvedBiome(biomeData, worldX, worldY, isNGP = false, gameMode = "normal") {
  let biomeMap = biomeData.pixels;
  if (worldY < -14 * 512) biomeMap = biomeData.heavenPixels;
  else if (worldY > 34 * 512) biomeMap = biomeData.hellPixels;
  const mapWidth = getWorldSize(isNGP, gameMode);
  const mapHeight = 48;
  const shifted_x = worldX + 512 * getWorldCenter(isNGP, gameMode);
  const shifted_y = worldY + 512 * 14;
  const fx = Math.floor(shifted_x);
  const fy = Math.floor(shifted_y);
  const wrapX = (cx) => (cx % mapWidth + mapWidth) % mapWidth;
  const clampY = (cy) => cy < 0 ? 0 : cy > mapHeight - 1 ? mapHeight - 1 : cy;
  const colorAt = (cx, cy) => biomeMap[clampY(cy) * mapWidth + wrapX(cx)] & 16777215;
  const nameOf = (color) => BIOME_COLOR_TO_NAME[color] || null;
  const origCx = wrapX(fx >> 9);
  const origCy = clampY(fy >> 9);
  const origColor = colorAt(origCx, origCy);
  const origName = nameOf(origColor);
  const make = (cx, cy, color) => ({
    biome: nameOf(color),
    origBiome: origName,
    colorInt: color,
    pos: { x: cx, y: cy },
    originalPos: { x: origCx, y: origCy }
  });
  const orig = () => make(origCx, origCy, origColor);
  if (biomeEdgeNoiseFlag(origColor, "noise_biome_edges") === 0) return orig();
  if (biomeEdgeNoiseFlag(origColor, "fat_biome_edges")) return orig();
  const sub_x = fx & 511;
  const sub_y = fy & 511;
  let nCx = null, nCy = null;
  const consider = (cx, cy) => {
    if (nCx !== null) return;
    if (colorAt(cx, cy) !== origColor) {
      nCx = cx;
      nCy = cy;
    }
  };
  if (sub_x < 42 && colorAt(origCx - 1, origCy) !== origColor) {
    nCx = origCx - 1;
    nCy = origCy;
  }
  if (nCx === null) {
    if (sub_y < 42) consider(origCx, origCy - 1);
    if (sub_x > 470) consider(origCx + 1, origCy);
    if (sub_y > 470) consider(origCx, origCy + 1);
    if (sub_x < 42) {
      if (sub_y < 42) consider(origCx - 1, origCy - 1);
      if (sub_y > 470) consider(origCx - 1, origCy + 1);
    }
    if (sub_x > 470) {
      if (sub_y < 42) consider(origCx + 1, origCy - 1);
      if (sub_y > 470) consider(origCx + 1, origCy + 1);
    }
  }
  if (nCx === null) return orig();
  if (biomeEdgeNoiseFlag(colorAt(nCx, nCy), "noise_biome_edges") === 0) return orig();
  const simplex = ComputeMagicValueFromDoubles(shifted_x * 0.05, shifted_y * 0.05);
  const dxBranch = Math.cos(shifted_x * 5e-3) * 30 + simplex * 11;
  const dyBranch = Math.sin(shifted_y * 5e-3) * 30 + simplex * 11;
  const wCx = wrapX((dyBranch + shifted_x | 0) >> 9);
  const wCy = clampY((dxBranch + shifted_y | 0) >> 9);
  const wColor = colorAt(wCx, wCy);
  if (biomeEdgeNoiseFlag(wColor, "noise_biome_edges") !== 0) return make(wCx, wCy, wColor);
  return orig();
}
function roundHalfOfEven(n) {
  if (n % 1 === 0.5) {
    const floor = Math.floor(n);
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(n);
}
function getDateAndTime() {
  const date = /* @__PURE__ */ new Date();
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds()
  };
}
async function fetchSafeJson(url) {
  const dataUrl = new URL(url, new URL("../vendor/noita-telescope-main/js/utils.js", import.meta.url).href);
  if (typeof process !== "undefined" && process?.versions?.node) {
    const { readFile: readFile2 } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return JSON.parse(await readFile2(fileURLToPath(dataUrl), "utf8"));
  }
  const res = await fetch(dataUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${url}, but received ${contentType}. File path might be wrong.`);
  }
  return await res.json();
}

// vendor/noita-telescope-main/js/biome_generator.js
var BiomePainter = class {
  constructor(pixels, w, h, rng, isNightmare) {
    this.pixels = pixels;
    this.w = w;
    this.h = h;
    this.rng = rng;
    this.isNightmare = isNightmare;
  }
  set(x, y, c) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    this.pixels[y * this.w + x] = c;
  }
  rect(x, y, w, h, c, buf) {
    let ex = this.rng.Random(0, buf);
    x -= ex;
    w += ex + this.rng.Random(0, buf);
    for (let iy = y; iy < y + h; iy++) {
      for (let ix = x; ix < x + w; ix++) {
        this.set(ix, iy, c);
      }
    }
  }
  rectSplit(x, y, w, h, c1, c2, buf) {
    let ex = this.rng.Random(0, buf);
    x -= ex;
    w += ex + this.rng.Random(0, buf);
    let cut = this.rng.Random(y + 1, y + h - 2);
    for (let ix = x; ix < x + w; ix++) {
      for (let iy = y; iy < y + h; iy++) {
        this.set(ix, iy, iy < cut ? c1 : c2);
      }
      cut += this.rng.Random(-1, 1);
      cut = Math.max(y + 1, Math.min(y + h - 2, cut));
    }
  }
  cave(x, y, dir, c, len) {
    for (let i = 1; i <= len; i++) {
      this.set(x, y, c);
      if (i < 5 || this.rng.Random(0, 100) < 75) x += dir;
      else x -= dir;
      x = Math.max(2, Math.min(62, x));
      this.set(x, y, c);
      if (this.isNightmare) {
        y = Math.max(17, Math.min(45, y));
      }
      if (i > 3) {
        if (this.rng.Random(0, 100) < 65) y++;
        else y--;
      }
      if (!this.isNightmare) {
        y = Math.max(17, Math.min(45, y));
      }
      if (i > 6) {
        if (this.rng.Random(0, 100) < 35) this.set(x - 1, y, c);
        if (this.rng.Random(0, 100) < 35) this.set(x + 1, y, c);
        if (this.rng.Random(0, 100) < 35) this.set(x, y - 1, c);
        if (this.rng.Random(0, 100) < 35) this.set(x, y + 1, c);
      }
    }
  }
};
function generateBiomeData(seed, ng, gameMode, baseImageData, width, height) {
  const pixels = new Uint32Array(width * height);
  for (let i = 0; i < baseImageData.length; i++) {
    pixels[i] = 4278190080 | baseImageData[i * 4] << 16 | baseImageData[i * 4 + 1] << 8 | baseImageData[i * 4 + 2];
  }
  const orbs = [];
  const isNightmare = gameMode === "nightmare" && ng === 0;
  if (ng === 0 && !isNightmare) {
    let heavenPixels2 = new Uint32Array(pixels.length);
    let hellPixels2 = new Uint32Array(pixels.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        heavenPixels2[y * width + x] = pixels[x % width];
        hellPixels2[y * width + x] = pixels[(height - 1) * width + x % width];
      }
    }
    return { pixels, heavenPixels: heavenPixels2, hellPixels: hellPixels2, orbs };
  }
  const rng = new NollaPrng(0);
  rng.SetRandomSeed(seed + ng, 4573, 4621);
  const painter = new BiomePainter(pixels, width, height, rng, isNightmare);
  let b = {
    coal: isNightmare ? 4292180247 : 4292175127,
    coll: 4292175127,
    fungi: 4293419504,
    excav: 4279387205,
    snow: 4279727573,
    hiisi: 4278208255,
    j1: 4288709632,
    j2: 4286611456,
    vault: 4278222848,
    sand: 4292988210,
    snowvault: 4278223016,
    wand: 4278217794,
    crypt: 4286082114
    // Not present in nightmare biome list for some reason??
  };
  let doWalls = false;
  if (ng > 0) {
    if (ng % 2 === 0) {
      b.coal = 4282203703;
      b.coll = 4282203703;
      b.fungi = 4282203707;
      b.excav = 4282203704;
      b.snow = 4282203705;
      b.hiisi = 4282203706;
      b.j1 = 4282203708;
      b.j2 = 4282203708;
      b.vault = 4282203709;
      b.crypt = 4282203710;
    }
    if (ng % 3 === 0) {
      let pool = [
        4292175127,
        4292175127,
        4293419504,
        4279387205,
        4279727573,
        4278208255,
        4288709632,
        4286611456,
        4278222848,
        4292988210,
        4278223016,
        4278217794,
        4286082114
      ];
      shuffleTable(pool, rng);
      b.coal = pool[0];
      b.coll = pool[1];
      b.fungi = pool[2];
      b.excav = pool[3];
      b.snow = pool[4];
      b.hiisi = pool[5];
      b.j1 = pool[6];
      b.j2 = pool[7];
      b.vault = pool[8];
      b.crypt = pool[9];
    }
    doWalls = ng % 5 === 0;
    if (ng % 7 === 0) {
      const t = Math.floor(ng / 7) % 3;
      const c = t === 0 ? 4291598660 : t === 1 ? 4292270307 : 4281590545;
      const target = pixels[5 * width + 16];
      for (let i = 0; i < pixels.length; i++) {
        if (pixels[i] === target) pixels[i] = c;
      }
    }
  }
  const swap = (k1, k2) => {
    if (rng.Random(0, 100) < 35) {
      let t = b[k1];
      b[k1] = b[k2];
      b[k2] = t;
    }
  };
  if (!isNightmare) {
    swap("coal", "coll");
  } else {
    let t = b["coal"];
    b["coal"] = b["excav"];
    b["excav"] = t;
  }
  swap("fungi", "excav");
  swap("snow", "hiisi");
  swap("j1", "j2");
  swap("sand", "fungi");
  swap("wand", "sand");
  const doCave = (x, y, dir, c, lMin, lMax) => {
    if (rng.Random(0, 100) < 65) {
      painter.cave(x, y, dir, c, rng.Random(lMin, lMax));
    }
  };
  doCave(27, 15, -1, b.fungi, 4, 50);
  doCave(35, 15, 1, b.fungi, 4, 50);
  doCave(27, 18, -1, b.fungi, 4, 50);
  doCave(35, 18, 1, b.fungi, 4, 50);
  if (rng.Random(0, 100) < 65) painter.cave(27, 20 + rng.Random(0, 5), -1, b.wand, rng.Random(5, 50));
  if (rng.Random(0, 100) < 65) painter.cave(35, 20 + rng.Random(0, 5), 1, b.wand, rng.Random(5, 50));
  if (rng.Random(0, 100) < 65) painter.cave(27, 27 + rng.Random(0, 6), -1, b.sand, rng.Random(5, 50));
  if (rng.Random(0, 100) < 65) painter.cave(35, 27 + rng.Random(0, 6), 1, b.sand, rng.Random(5, 50));
  painter.rect(32, 14, 3, 2, b.coal, 0);
  painter.rect(28, 15, 4, 1, b.coll, 1);
  if (!isNightmare) {
    painter.rect(28, 17, 4, 2, b.excav, 2);
    painter.rectSplit(28, 20, 7, 6, b.snow, b.hiisi, 3);
  } else {
    painter.rect(28, 17, 4, 4, b.snow, 2);
    painter.rect(28, 22, 7, 4, b.hiisi, 3);
  }
  painter.rectSplit(28, 27, 7, 4, b.j1, b.j2, 4);
  painter.rectSplit(28, 29, 7, 5, b.j2, b.vault, 4);
  if (!isNightmare) {
    painter.rect(29, 35, 11, 3, b.crypt, 0);
  }
  if (doWalls) {
    const wallLeft = rng.Random(2, 6);
    const wallRight = rng.Random(1, 4);
    painter.rect(23, 15, wallLeft, 25, 4282203453, 0);
    painter.rect(33 + (4 - wallRight), 16, wallRight, 22, 4282203453, 0);
  }
  const addOrb = (x, y, name, color) => {
    painter.set(x, y, color);
    orbs.push({ x, y, name, type: "item", item: "orb", biome: "orb_room" });
  };
  addOrb(51, 11, "Pyramid", 4291333983);
  addOrb(33, 11, "Floating Island", 4290805890);
  if (!isNightmare) {
    addOrb(rng.Random(0, 5) + 10, rng.Random(0, 2) + 18, "Vault", 4294955266);
    addOrb(rng.Random(0, 5) + 49, rng.Random(0, 3) + 17, "Pyramid (Inside)", 4294955268);
    let hx = rng.Random(0, 9) + 27;
    let hy = rng.Random(0, 2) + 44;
    if (ng === 3 || ng >= 25) hy = 47;
    addOrb(hx, hy, "Hell", 4294955272);
    addOrb(rng.Random(0, 6) + 12, rng.Random(0, 3) + 40, "Snowcave", 4294955273);
    addOrb(rng.Random(0, 4) + 51, rng.Random(0, 5) + 41, "Desert", 4294955280);
    addOrb(rng.Random(0, 5) + 58, rng.Random(0, 5) + 34, "Nuke", 4294955267);
    addOrb(rng.Random(0, 9) + 40, rng.Random(0, 11) + 21, "Orb 1", 4294955269);
    addOrb(rng.Random(0, 7) + 17, rng.Random(0, 8) + 21, "Orb 2", 4294955270);
    addOrb(rng.Random(0, 7) + 1, rng.Random(0, 9) + 24, "Orb 3", 4294955271);
  } else {
    addOrb(12, 19, "Vault", 4294955266);
    addOrb(51, 19, "Pyramid (Inside)", 4294955268);
    addOrb(31, 45, "Hell", 4294955272);
    addOrb(14, 42, "Snowcave", 4294955273);
    addOrb(52, 45, "Desert", 4294955280);
  }
  const color_end_room = 4283494103;
  const color_boss_arena = 4279561943;
  painter.set(44, 43, color_end_room);
  painter.rect(35, 38, 5, 2, color_boss_arena, 0);
  painter.set(37, 40, color_boss_arena);
  painter.set(38, 40, color_boss_arena);
  let heavenPixels = new Uint32Array(pixels.length);
  let hellPixels = new Uint32Array(pixels.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      heavenPixels[y * width + x] = pixels[x % width];
      hellPixels[y * width + x] = pixels[(height - 1) * width + x % width];
    }
  }
  return { pixels, heavenPixels, hellPixels, orbs };
}

// vendor/noita-telescope-main/js/stbhw.js
var MAX_W = 300;
var MAX_H = 300;
var c_color = new Int32Array(MAX_W * MAX_H).fill(-1);
var v_color = new Int32Array(MAX_W * MAX_H).fill(-1);
var h_color = new Int32Array(MAX_W * MAX_H).fill(-1);
function get_c(x, y) {
  return x < 0 || x >= MAX_W || y < 0 || y >= MAX_H ? -1 : c_color[y * MAX_W + x];
}
function set_c(x, y, v) {
  if (x >= 0 && x < MAX_W && y >= 0 && y < MAX_H) c_color[y * MAX_W + x] = v;
}
var globalPrng = new NollaPrng(0);
var repetition_reduction = true;
function stbhw_set_prng(prng2) {
  globalPrng = prng2;
}
var StbhwTile = class {
  constructor(pixels, a, b, c, d, e, f) {
    this.pixels = pixels;
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }
};
var StbhwTileset = class {
  constructor() {
    this.is_corner = false;
    this.num_color = [0, 0, 0, 0, 0, 0];
    this.short_side_len = 0;
    this.h_tiles = [];
    this.v_tiles = [];
    this.num_h_tiles = 0;
    this.num_v_tiles = 0;
    this.num_vary_x = 0;
    this.num_vary_y = 0;
  }
};
function STB_HBWANG_RAND() {
  let r = globalPrng.NextU();
  return r;
}
function stbhw_generate_image(ts, pixels, stride_in_bytes, w, h) {
  c_color.fill(-1);
  h_color.fill(-1);
  v_color.fill(-1);
  const sidelen = ts.short_side_len;
  if (sidelen <= 0) return null;
  w = Math.min(w, 1024);
  h = Math.min(h, 1028);
  const xmax = Math.floor(w / sidelen) + 6;
  const ymax = Math.floor(h / sidelen) + 6;
  const tileIndices = new Int32Array(xmax * ymax).fill(0);
  const num_vary_product = ts.num_vary_x * ts.num_vary_y;
  if (ts.is_corner) {
    for (let j = 0; j < ymax; j++) {
      for (let i = 0; i < xmax; i++) {
        let p = i - j + 1 & 3;
        set_c(i, j, (globalPrng.NextU() >>> 0) % ts.num_color[p]);
      }
    }
    if (repetition_reduction) {
      for (let j = 0; j < ymax - 3; j++) {
        for (let i = 0; i < xmax - 3; i++) {
          if (stbhw__match(i, j) && stbhw__match(i, j + 1) && stbhw__match(i, j + 2) && stbhw__match(i + 1, j) && stbhw__match(i + 1, j + 1) && stbhw__match(i + 1, j + 2)) {
            let p = i + 1 - (j + 1) + 1 & 3;
            if (ts.num_color[p] > 1) {
              let curr = get_c(i + 1, j + 1);
              set_c(i + 1, j + 1, stbhw__change_color(curr, ts.num_color[p]));
            }
          }
          if (stbhw__match(i, j) && stbhw__match(i + 1, j) && stbhw__match(i + 2, j) && stbhw__match(i, j + 1) && stbhw__match(i + 1, j + 1) && stbhw__match(i + 2, j + 1)) {
            let p = i + 2 - (j + 1) + 1 & 3;
            if (ts.num_color[p] > 1) {
              let curr = get_c(i + 2, j + 1);
              set_c(i + 2, j + 1, stbhw__change_color(curr, ts.num_color[p]));
            }
          }
        }
      }
    }
    let yIdx = -1;
    let ypos = -1 * sidelen;
    for (let j = -1; yIdx * sidelen < h; j++) {
      let phase = j & 3;
      let i = phase === 0 ? 0 : phase - 4;
      for (; ; i += 4) {
        let xIdx = i;
        let xpos = xIdx * sidelen;
        if (xpos >= w) break;
        if (xIdx + 2 >= 0 && yIdx >= 0) {
          let ti = stbhw__choose_tile_refactor2(
            ts.h_tiles,
            ts.num_h_tiles,
            [i + 2, j + 2],
            [i + 3, j + 2],
            [i + 4, j + 2],
            [i + 2, j + 3],
            [i + 3, j + 3],
            [i + 4, j + 3],
            num_vary_product
          );
          if (ti === -1) return null;
          if (xIdx >= 0) tileIndices[yIdx * xmax + xIdx] = ti;
          if (xIdx + 1 >= 0) tileIndices[yIdx * xmax + xIdx + 1] = ti | 32768;
          stbhw__draw_h_tile(pixels, stride_in_bytes, w, h, xpos, ypos, ts.h_tiles[ti], sidelen);
        }
        let xIdxV = i + 3;
        let xposV = xIdxV * sidelen;
        if (xposV < w) {
          let ti = stbhw__choose_tile_refactor2(
            ts.v_tiles,
            ts.num_v_tiles,
            [i + 5, j + 2],
            [i + 5, j + 3],
            [i + 5, j + 4],
            [i + 6, j + 2],
            [i + 6, j + 3],
            [i + 6, j + 4],
            num_vary_product
          );
          if (ti === -1) return null;
          if (yIdx >= 0) tileIndices[yIdx * xmax + xIdxV] = ti | 16384;
          if ((yIdx + 1) * sidelen < h + sidelen) {
            tileIndices[(yIdx + 1) * xmax + xIdxV] = ti | 49152;
          }
          stbhw__draw_v_tile(pixels, stride_in_bytes, w, h, xposV, ypos, ts.v_tiles[ti], sidelen);
        }
      }
      yIdx++;
      ypos += sidelen;
    }
  }
  return { pixels, tileIndices, xmax, ymax };
}
function stbhw__choose_tile_refactor2(tiles, num_tiles, a_idx, b_idx, c_idx, d_idx, e_idx, f_idx, num_vary_product) {
  let a = get_c(a_idx[0], a_idx[1]), b = get_c(b_idx[0], b_idx[1]);
  let c = get_c(c_idx[0], c_idx[1]), d = get_c(d_idx[0], d_idx[1]);
  let e = get_c(e_idx[0], e_idx[1]), f = get_c(f_idx[0], f_idx[1]);
  let first = -1;
  let second = -1;
  for (let i = 0; i < num_tiles; i++) {
    let h = tiles[i];
    if ((a < 0 || a === h.a) && (b < 0 || b === h.b) && (c < 0 || c === h.c) && (d < 0 || d === h.d) && (e < 0 || e === h.e) && (f < 0 || f === h.f)) {
      if (first < 0) first = i;
      else if (second < 0) {
        second = i;
        break;
      }
    }
  }
  if (first < 0) return null;
  let stride = second === -1 ? 0 : second - first;
  let m = STB_HBWANG_RAND() % num_vary_product;
  let finalIdx = first + m * stride;
  let t = tiles[finalIdx];
  set_c(a_idx[0], a_idx[1], t.a);
  set_c(b_idx[0], b_idx[1], t.b);
  set_c(c_idx[0], c_idx[1], t.c);
  set_c(d_idx[0], d_idx[1], t.d);
  set_c(e_idx[0], e_idx[1], t.e);
  set_c(f_idx[0], f_idx[1], t.f);
  return finalIdx;
}
function stbhw__match(i, j) {
  return get_c(i, j) === get_c(i + 1, j + 1);
}
function stbhw__change_color(old_color, num_options, weights) {
  if (weights) {
    let total = 0;
    for (let i = 0; i < num_options; i++) {
      if (i !== old_color) total += weights[i];
    }
    let choice = STB_HBWANG_RAND() % total;
    let cumulative = 0;
    for (let k = 0; k < num_options; k++) {
      if (k === old_color) continue;
      cumulative += weights[k];
      if (choice < cumulative) return k;
    }
    return num_options - 1;
  } else {
    let offset = 1 + STB_HBWANG_RAND() % (num_options - 1);
    return (old_color + offset) % num_options;
  }
}
function stbhw__draw_h_tile(out, stride, w, h, x, y, tile, sz) {
  for (let j = 0; j < sz; j++) {
    if (y + j >= 0 && y + j < h) {
      for (let i = 0; i < sz * 2; i++) {
        if (x + i >= 0 && x + i < w) {
          const srcIdx = (j * (sz * 2) + i) * 3;
          const dstIdx = (y + j) * stride + (x + i) * 3;
          out[dstIdx] = tile.pixels[srcIdx];
          out[dstIdx + 1] = tile.pixels[srcIdx + 1];
          out[dstIdx + 2] = tile.pixels[srcIdx + 2];
        }
      }
    }
  }
}
function stbhw__draw_v_tile(out, stride, w, h, x, y, tile, sz) {
  for (let j = 0; j < sz * 2; j++) {
    if (y + j >= 0 && y + j < h) {
      for (let i = 0; i < sz; i++) {
        if (x + i >= 0 && x + i < w) {
          const srcIdx = (j * sz + i) * 3;
          const dstIdx = (y + j) * stride + (x + i) * 3;
          out[dstIdx] = tile.pixels[srcIdx];
          out[dstIdx + 1] = tile.pixels[srcIdx + 1];
          out[dstIdx + 2] = tile.pixels[srcIdx + 2];
        }
      }
    }
  }
}
function stbhw_build_tileset_from_image(ts, data, stride, w, h, override = null) {
  let header = new Uint8Array(9);
  for (let i = 0; i < 9; i++) {
    let idx = w * 3 - 1 - i;
    if (idx >= 0 && idx < data.length) header[i] = data[idx] ^ i * 55 % 256;
  }
  if (header[7] === 192) {
    ts.is_corner = true;
    ts.num_color = [header[0], header[1], header[2], header[3], 0, 0];
    ts.num_vary_x = header[4];
    ts.num_vary_y = header[5];
    ts.short_side_len = header[6];
  } else {
    ts.is_corner = false;
    ts.num_color = [header[0], header[1], header[2], header[3], header[4], header[5]];
    ts.num_vary_x = header[6];
    ts.num_vary_y = header[7];
    ts.short_side_len = header[8];
  }
  if (override) {
    if (override.short_side_len) ts.short_side_len = override.short_side_len;
    if (override.is_corner !== void 0) ts.is_corner = override.is_corner;
    for (let i = 0; i < 6; i++) if (ts.num_color[i] === 0) ts.num_color[i] = 1;
    if (ts.num_vary_x === 0) ts.num_vary_x = 1;
    if (ts.num_vary_y === 0) ts.num_vary_y = 1;
  }
  if (ts.short_side_len <= 0 || ts.short_side_len > 100) return 0;
  const p = { ts, data, stride, w, h };
  let ypos = 2;
  ts.h_tiles = [];
  ts.v_tiles = [];
  ts.num_h_tiles = 0;
  ts.num_v_tiles = 0;
  if (ts.is_corner) {
    for (let k = 0; k < ts.num_color[2]; k++)
      for (let j = 0; j < ts.num_color[1]; j++)
        for (let i = 0; i < ts.num_color[0]; i++)
          for (let q = 0; q < ts.num_vary_y; q++) {
            process_h_row(p, 0, ypos, 0, ts.num_color[1] - 1, 0, ts.num_color[2] - 1, 0, ts.num_color[3] - 1, i, i, j, j, k, k, ts.num_vary_x);
            ypos += ts.short_side_len + 3;
          }
    ypos += 2;
    for (let k = 0; k < ts.num_color[3]; k++)
      for (let j = 0; j < ts.num_color[0]; j++)
        for (let i = 0; i < ts.num_color[1]; i++)
          for (let q = 0; q < ts.num_vary_x; q++) {
            process_v_row(p, 0, ypos, 0, ts.num_color[0] - 1, 0, ts.num_color[3] - 1, 0, ts.num_color[2] - 1, i, i, j, j, k, k, ts.num_vary_y);
            ypos += ts.short_side_len * 2 + 3;
          }
  } else {
    for (let k = 0; k < ts.num_color[3]; k++)
      for (let j = 0; j < ts.num_color[4]; j++)
        for (let i = 0; i < ts.num_color[2]; i++)
          for (let q = 0; q < ts.num_vary_y; q++) {
            process_h_row(p, 0, ypos, 0, ts.num_color[2] - 1, k, k, 0, ts.num_color[1] - 1, j, j, 0, ts.num_color[0] - 1, i, i, ts.num_vary_x);
            ypos += ts.short_side_len + 3;
          }
    ypos += 2;
    for (let k = 0; k < ts.num_color[3]; k++)
      for (let j = 0; j < ts.num_color[4]; j++)
        for (let i = 0; i < ts.num_color[5]; i++)
          for (let q = 0; q < ts.num_vary_x; q++) {
            process_v_row(p, 0, ypos, 0, ts.num_color[0] - 1, i, i, 0, ts.num_color[1] - 1, j, j, 0, ts.num_color[5] - 1, k, k, ts.num_vary_y);
            ypos += ts.short_side_len * 2 + 3;
          }
  }
  return 1;
}
function process_h_row(p, xpos, ypos, a0, a1, b0, b1, c0, c1, d0, d1, e0, e1, f0, f1, variants) {
  for (let v = 0; v < variants; v++)
    for (let f = f0; f <= f1; f++)
      for (let e = e0; e <= e1; e++)
        for (let d = d0; d <= d1; d++)
          for (let c = c0; c <= c1; c++)
            for (let b = b0; b <= b1; b++)
              for (let a = a0; a <= a1; a++) {
                parse_rect(p, xpos, ypos, a, b, c, d, e, f, false);
                xpos += 2 * p.ts.short_side_len + 3;
              }
}
function process_v_row(p, xpos, ypos, a0, a1, b0, b1, c0, c1, d0, d1, e0, e1, f0, f1, variants) {
  for (let v = 0; v < variants; v++)
    for (let f = f0; f <= f1; f++)
      for (let e = e0; e <= e1; e++)
        for (let d = d0; d <= d1; d++)
          for (let c = c0; c <= c1; c++)
            for (let b = b0; b <= b1; b++)
              for (let a = a0; a <= a1; a++) {
                parse_rect(p, xpos, ypos, a, b, c, d, e, f, true);
                xpos += p.ts.short_side_len + 3;
              }
}
function parse_rect(p, xpos, ypos, a, b, c, d, e, f, isV) {
  let len_ = p.ts.short_side_len;
  let w_t = isV ? len_ : len_ * 2;
  let h_t = isV ? len_ * 2 : len_;
  let pixels = new Uint8Array(w_t * h_t * 3);
  xpos += 1;
  ypos += 1;
  for (let j = 0; j < h_t; j++) {
    for (let i = 0; i < w_t; i++) {
      let start = (ypos + j) * p.stride + (xpos + i) * 3;
      let dest = (j * w_t + i) * 3;
      if (start + 2 < p.data.length) {
        pixels[dest] = p.data[start];
        pixels[dest + 1] = p.data[start + 1];
        pixels[dest + 2] = p.data[start + 2];
      }
    }
  }
  let t = new StbhwTile(pixels, a, b, c, d, e, f);
  if (isV) {
    p.ts.v_tiles.push(t);
    p.ts.num_v_tiles++;
  } else {
    p.ts.h_tiles.push(t);
    p.ts.num_h_tiles++;
  }
}

// vendor/noita-telescope-main/js/biome_hacks.js
function applyMainBiomeHack(startX, pixels, width, height) {
  for (let y = 0; y < 11; y++) {
    for (let x = startX; x < startX + 7; x++) {
      if (x < width && y < height) {
        let idx = (y * width + x) * 3;
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
      }
    }
  }
}
var BiomeOverlays = {
  "coalmine": { path: "../data/wang_tiles/extra_layers/coalmine.png", image: null }
};
async function preloadOverlays() {
  for (let key in BiomeOverlays) {
    const entry = BiomeOverlays[key];
    entry.image = await loadPNG(entry.path);
  }
}
preloadOverlays();
function applyCoalmineHack(pixels, width, height, biomeName) {
  const overlay = BiomeOverlays[biomeName]?.image;
  if (!overlay || !overlay.data) {
    console.warn(`Overlay for ${biomeName} not ready!`);
    return;
  }
  for (let y = 0; y < Math.min(height, overlay.height); y++) {
    for (let x = 0; x < Math.min(width, overlay.width); x++) {
      const oIdx = (y * overlay.width + x) * 4;
      const r = overlay.data[oIdx];
      const g = overlay.data[oIdx + 1];
      const b = overlay.data[oIdx + 2];
      const a = overlay.data[oIdx + 3];
      if (a === 0) continue;
      const hex = r << 16 | g << 8 | b;
      const pIdx = ((y + 4) * width + x) * 3;
      if (hex === 66) {
        pixels[pIdx] = 0;
        pixels[pIdx + 1] = 0;
        pixels[pIdx + 2] = 0;
      } else if (hex !== 16777215) {
        pixels[pIdx] = 1;
        pixels[pIdx + 1] = 1;
        pixels[pIdx + 2] = 1;
      }
    }
  }
}
function undoCoalmineHack(pixels, width, height, biomeName) {
  const overlay = BiomeOverlays[biomeName]?.image;
  if (!overlay || !overlay.data) {
    console.warn(`Overlay for ${biomeName} not ready!`);
    return;
  }
  for (let y = 0; y < Math.min(height, overlay.height); y++) {
    for (let x = 0; x < Math.min(width, overlay.width); x++) {
      const oIdx = (y * overlay.width + x) * 4;
      const r = overlay.data[oIdx];
      const g = overlay.data[oIdx + 1];
      const b = overlay.data[oIdx + 2];
      const a = overlay.data[oIdx + 3];
      if (a === 0) continue;
      const hex = r << 16 | g << 8 | b;
      const pIdx = ((y + 4) * width + x) * 3;
      if (hex === 66) {
        pixels[pIdx] = 0;
        pixels[pIdx + 1] = 0;
        pixels[pIdx + 2] = 0;
      } else if (hex !== 16777215) {
        pixels[pIdx] = 0;
        pixels[pIdx + 1] = 0;
        pixels[pIdx + 2] = 0;
      }
    }
  }
}
function clearPath(pixels, width, height, path) {
  for (let i = 0; i < path.length; i++) {
    const x = path[i].x, y = path[i].y;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 3;
      if (pixels[idx] === 192 && pixels[idx + 1] === 255 && pixels[idx + 2] === 238) {
        const selectedColor = 0;
        const queue = [[x, y]];
        const visited = /* @__PURE__ */ new Set();
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          let idx2 = (cy * width + cx) * 3;
          pixels[idx2] = selectedColor;
          pixels[idx2 + 1] = selectedColor;
          pixels[idx2 + 2] = selectedColor;
          const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of neighbors) {
            const nx = cx + dx, ny = cy + dy;
            const nidx = (ny * width + nx) * 3;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`) && pixels[nidx] === 192 && pixels[nidx + 1] === 255 && pixels[nidx + 2] === 238) {
              visited.add(`${nx},${ny}`);
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }
}
function applyCoffeeHack(pixels, width, height, worldSeed) {
  let prng2 = new NollaPrng(0);
  prng2.SetRandomFromWorldSeed(worldSeed);
  prng2.Next();
  for (let y = 4; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = (y * width + x) * 3;
      if (pixels[startIdx] === 192 && pixels[startIdx + 1] === 255 && pixels[startIdx + 2] === 238) {
        const selectedColor = prng2.Next() < 0.5 ? 255 : 0;
        const queue = [[x, y]];
        const visited = /* @__PURE__ */ new Set();
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          let idx = (cy * width + cx) * 3;
          pixels[idx] = selectedColor;
          pixels[idx + 1] = selectedColor;
          pixels[idx + 2] = selectedColor;
          const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of neighbors) {
            const nx = cx + dx, ny = cy + dy;
            const nidx = (ny * width + nx) * 3;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`) && pixels[nidx] === 192 && pixels[nidx + 1] === 255 && pixels[nidx + 2] === 238) {
              visited.add(`${nx},${ny}`);
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
  }
}
function applyRandomColors(pixels, width, height, worldSeed, ngPlus, randomColors) {
  for (const [color, options] of Object.entries(randomColors)) {
    let prng2 = new NollaPrng(0);
    prng2.SetRandomFromWorldSeed(worldSeed + ngPlus);
    prng2.Next();
    const iters = width + (worldSeed + ngPlus) - 11 * Math.floor(width / 11) - 12 * Math.floor((worldSeed + ngPlus) / 12);
    for (let i = 0; i < iters; i++) prng2.Next();
    prng2.Next();
    for (let y = 4; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const startIdx = (y * width + x) * 3;
        if (pixels[startIdx] === (color >> 16 & 255) && pixels[startIdx + 1] === (color >> 8 & 255) && pixels[startIdx + 2] === (color & 255)) {
          const selectedColor = options[Math.floor(prng2.Next() * options.length)];
          const queue = [[x, y]];
          const visited = /* @__PURE__ */ new Set();
          while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            let idx = (cy * width + cx) * 3;
            pixels[idx] = selectedColor >> 16 & 255;
            pixels[idx + 1] = selectedColor >> 8 & 255;
            pixels[idx + 2] = selectedColor & 255;
            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dx, dy] of neighbors) {
              const nx = cx + dx, ny = cy + dy;
              const nidx = (ny * width + nx) * 3;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited.has(`${nx},${ny}`) && pixels[nidx] === (color >> 16 & 255) && pixels[nidx + 1] === (color >> 8 & 255) && pixels[nidx + 2] === (color & 255)) {
                visited.add(`${nx},${ny}`);
                queue.push([nx, ny]);
              }
            }
          }
        }
      }
    }
  }
}
function applyPostprocessingHacks(pixels, width, height, worldSeed, ngPlus, path, randomColors) {
  clearPath(pixels, width, height, path);
  applyCoffeeHack(pixels, width, height, worldSeed, ngPlus);
  if (randomColors) {
    applyRandomColors(pixels, width, height, worldSeed, ngPlus, randomColors);
  }
}

// vendor/noita-telescope-main/js/pathfinding.js
var PATH_FIND_WORLD_POS_MIN_X = 159;
var PATH_FIND_WORLD_POS_MAX_X = 223;
var MINES_TEMPLATE = "coalmine.png";
var MINES_START_X = 142;
var MINES_START_LEN = 12;
function usesMinesTemplate(wangFile) {
  return !!wangFile && wangFile.endsWith(MINES_TEMPLATE);
}
function getPathStartSegment(bbox, width, height, wangFile, isNGPlus, gameMode = "normal") {
  if (usesMinesTemplate(wangFile)) return { x: MINES_START_X, len: MINES_START_LEN };
  const segLen = Math.trunc((PATH_FIND_WORLD_POS_MAX_X - PATH_FIND_WORLD_POS_MIN_X) / 10);
  const regionX = (bbox[0] - getWorldCenter(isNGPlus, gameMode)) * 512;
  const startX = Math.trunc((PATH_FIND_WORLD_POS_MIN_X - regionX) / 10);
  if (startX < 0 || startX >= width) return null;
  if (startX + segLen < 0 || startX + segLen >= width) return null;
  if (height < 7) return null;
  return { x: startX, len: Math.trunc(segLen / 10) };
}
function isOpen(pixels, idx) {
  const color = pixels[idx] << 16 | pixels[idx + 1] << 8 | pixels[idx + 2];
  return color === 0 || color === 12648430;
}
function findSequences(pixels, width, rowY, stride) {
  const seqs = [];
  let start = null;
  const rowOffset = rowY * width;
  for (let x = 0; x < width; x++) {
    if (isOpen(pixels, (rowOffset + x) * stride)) {
      if (start === null) start = x;
    } else {
      if (start !== null) {
        seqs.push({ x: start, len: x - start });
        start = null;
      }
    }
  }
  if (start !== null) seqs.push({ x: start, len: width - start });
  return seqs;
}
function midpoint(seq) {
  return seq.x + Math.trunc(seq.len / 2);
}
function findMinPath(pixels, width, height, startSegment) {
  const stride = 3;
  let startY = 4;
  let topSequences = [];
  topSequences = startSegment ? [startSegment] : findSequences(pixels, width, startY, stride);
  if (topSequences.length === 0) return null;
  const bottomSequences = findSequences(pixels, width, height - 1, stride);
  if (bottomSequences.length === 0) return null;
  const directions = [[0, 1], [-1, 0], [1, 0], [0, -1]];
  for (const startSeq of topSequences) {
    const startX = midpoint(startSeq);
    if (startX < 0 || startX >= width) continue;
    const visited = new Uint8Array(width * height);
    const parents = new Int32Array(width * height).fill(-1);
    const queue = [];
    queue.push({ x: startX, y: startY });
    visited[startY * width + startX] = 1;
    parents[startY * width + startX] = -2;
    let maxY = startY;
    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr.y > maxY) maxY = curr.y;
      for (const [dx, dy] of directions) {
        const nx = curr.x + dx;
        const ny = curr.y + dy;
        if (nx >= 0 && nx < width && ny > 3 && ny < height) {
          const nIdx = ny * width + nx;
          if (visited[nIdx] === 0 && isOpen(pixels, nIdx * stride)) {
            visited[nIdx] = 1;
            parents[nIdx] = curr.y * width + curr.x;
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
    if (maxY < height - 1) continue;
    let endIdx = -1;
    for (const endSeq of bottomSequences) {
      const endX = midpoint(endSeq);
      if (endX >= 0 && endX < width && visited[(height - 1) * width + endX] === 1) {
        endIdx = (height - 1) * width + endX;
        break;
      }
    }
    if (endIdx === -1) continue;
    const path = [];
    let currIdx = endIdx;
    while (currIdx !== -2 && currIdx !== -1) {
      const py = Math.floor(currIdx / width);
      const px = currIdx % width;
      path.push({ x: px, y: py });
      const pIdx = parents[currIdx];
      if (pIdx === -2) break;
      currIdx = pIdx;
    }
    return path.reverse();
  }
  return null;
}

// vendor/noita-telescope-main/js/tile_generator.js
var MAX_PATHFINDING_ATTEMPTS = 99;
var BIOME_PATH_HEIGHT_LIMIT_CHUNKS = 4;
var BYPASS_PATHFINDING = false;
var RESTORE_BLOCKED_ROOMS = true;
var DEFAULT_OFFSET_Y = 4;
var prng = new NollaPrng(0);
var TILESET_CACHE = {};
function calculateMapDimensions(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  const td = (n) => Math.trunc(n / 10);
  const totalWidth = td((maxX + 1) * 512) - td(minX * 512);
  const totalHeight = td((maxY + 1) * 512) - td(minY * 512);
  return { width: totalWidth, height: totalHeight };
}
function getCachedTileset(biomeName, wangData) {
  if (TILESET_CACHE[biomeName]) return TILESET_CACHE[biomeName];
  let ts = new StbhwTileset();
  if (wangData) {
    const rgba = wangData.data;
    const w = wangData.width;
    const h = wangData.height;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgb[i * 3] = rgba[i * 4];
      rgb[i * 3 + 1] = rgba[i * 4 + 1];
      rgb[i * 3 + 2] = rgba[i * 4 + 2];
    }
    stbhw_build_tileset_from_image(ts, rgb, w * 3, w, h);
  }
  TILESET_CACHE[biomeName] = ts;
  return ts;
}
function generateRawTileBuffer(regionPoints, bbox, wangData, worldSeed, ngPlus, extraRerolls, biomeName, gameMode = "normal", wangFile = "") {
  const minX = bbox[0];
  const minY = bbox[1];
  const mapDimensions = calculateMapDimensions(bbox);
  const mapW = mapDimensions.width;
  const mapH = mapDimensions.height;
  const outH = mapH + 4;
  const ts = getCachedTileset(biomeName, wangData);
  if (ts.h_tiles.length === 0) return null;
  stbhw_set_prng(prng);
  prng.SetRandomFromWorldSeed(worldSeed + ngPlus);
  prng.Next();
  const effectiveMapWidth = Math.min(mapW, 1024);
  const iters = effectiveMapWidth + (worldSeed + ngPlus) - 11 * Math.floor(effectiveMapWidth / 11) - 12 * Math.floor((worldSeed + ngPlus) / 12);
  for (let i = 0; i < iters; i++) prng.Next();
  for (let i = 0; i < extraRerolls; i++) prng.Next();
  prng.Seed = prng.NextU();
  prng.Next();
  const rawBuffer = new Uint8Array(mapW * outH * 3);
  let coffee_hack = false;
  const tile_indices = stbhw_generate_image(ts, rawBuffer, mapW * 3, mapW, outH, coffee_hack);
  if (!tile_indices) return null;
  const isMines = usesMinesTemplate(wangFile);
  let shouldBlockOutRooms = isMines || !!wangFile && wangFile.endsWith("excavationsite.png");
  let pixelSceneRooms = [];
  if (shouldBlockOutRooms) {
    pixelSceneRooms = blockOutRooms(rawBuffer, mapW, outH);
  }
  const pathStart = getPathStartSegment(bbox, mapW, mapH, wangFile, ngPlus > 0, gameMode);
  if (pathStart && !isMines) {
    applyMainBiomeHack(pathStart.x, rawBuffer, mapW, outH);
  }
  if (isMines && gameMode !== "nightmare") {
    applyCoalmineHack(rawBuffer, mapW, outH, "coalmine");
  }
  return {
    buffer: rawBuffer,
    width: mapW,
    height: outH,
    tileIndices: tile_indices.tileIndices,
    xmax: tile_indices.xmax,
    ymax: tile_indices.ymax,
    tileSize: ts.short_side_len,
    numHTiles: ts.num_h_tiles,
    numVTiles: ts.num_v_tiles,
    minX,
    minY,
    mapH,
    pixelSceneRooms,
    pathStart
  };
}
function findBiomeRegions(pixels, width, height, targetColor) {
  const visited = new Uint8Array(width * height);
  const regions = [];
  const bboxes = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] === 0 && pixels[idx] === targetColor) {
        const regionPoints = [];
        const queue = [[x, y]];
        visited[idx] = 1;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          regionPoints.push([cx, cy]);
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;
          const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dy] of neighbors) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (visited[nIdx] === 0 && pixels[nIdx] === targetColor) {
                visited[nIdx] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }
        let valid = true;
        for (let i = 0; i < regions.length; i++) {
          const [rMinX, rMinY, rMaxX, rMaxY] = bboxes[i];
          if (minX >= rMinX && maxX <= rMaxX && minY >= rMinY && maxY <= rMaxY) {
            for (const p of regionPoints) {
              regions[i].push(p);
            }
            valid = false;
          }
        }
        if (valid) {
          regions.push(regionPoints);
          bboxes.push([minX, minY, maxX, maxY]);
        }
      }
    }
  }
  return { regions, bboxes };
}
function applyMasking(pixels, imgData, mapW, bbox, validChunks, offsetY = 4) {
  const [minCX, minCY, maxCX, maxCY] = bbox;
  let tx = 0;
  for (let cx = minCX; cx <= maxCX; cx++) {
    let cw = 51;
    if (cx % 5 === 4) cw += 1;
    let ty = 0;
    for (let cy = minCY; cy <= maxCY; cy++) {
      let ch = 51;
      if (cy % 5 === 4) ch += 1;
      if (validChunks.has(`${cx},${cy}`)) {
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const srcIdx = ((ty + y + offsetY) * mapW + (tx + x)) * 3;
            const dstIdx = ((ty + y) * mapW + (tx + x)) * 4;
            const r = pixels[srcIdx], g = pixels[srcIdx + 1], b = pixels[srcIdx + 2];
            imgData.data[dstIdx] = r;
            imgData.data[dstIdx + 1] = g;
            imgData.data[dstIdx + 2] = b;
            imgData.data[dstIdx + 3] = r <= 1 && g <= 1 && b <= 1 ? 0 : 255;
          }
        }
      } else {
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            const srcIdx = ((ty + y + offsetY) * mapW + (tx + x)) * 3;
            pixels[srcIdx] = 0;
            pixels[srcIdx + 1] = 0;
            pixels[srcIdx + 2] = 0;
          }
        }
      }
      ty += ch;
    }
    tx += cw;
  }
}
function generateStaticTile(biomeName, config, bbox) {
  const wangData = config.wangData;
  const canvas = document.createElement("canvas");
  canvas.width = wangData.width;
  canvas.height = wangData.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(wangData.width, wangData.height + 4);
  const buffer = new Uint8Array(wangData.width * (wangData.height + 4) * 3);
  for (let y = 0; y < wangData.height; y++) {
    for (let x = 0; x < wangData.width; x++) {
      const inIdx = (y * wangData.width + x) * 4;
      const outIdxBuffer = ((y + 4) * wangData.width + x) * 3;
      const outIdxCanvas = ((y + 4) * wangData.width + x) * 4;
      const r = wangData.data[inIdx], g = wangData.data[inIdx + 1], b = wangData.data[inIdx + 2], a = wangData.data[inIdx + 3];
      imgData.data[outIdxCanvas] = r;
      imgData.data[outIdxCanvas + 1] = g;
      imgData.data[outIdxCanvas + 2] = b;
      imgData.data[outIdxCanvas + 3] = a;
      buffer[outIdxBuffer] = r;
      buffer[outIdxBuffer + 1] = g;
      buffer[outIdxBuffer + 2] = b;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const div5x = Math.floor(bbox[0] / 5);
  const div5y = Math.floor(bbox[1] / 5);
  const mod5x = bbox[0] % 5;
  const mod5y = bbox[1] % 5;
  const correctedX = div5x * 5 * 512 + mod5x * 51 * 10;
  const correctedY = div5y * 5 * 512 + mod5y * 51 * 10;
  return {
    biomeName,
    x: bbox[0] * CHUNK_SIZE,
    y: bbox[1] * CHUNK_SIZE,
    correctedX,
    correctedY,
    w: wangData.width * TILE_SIZE,
    h: wangData.height * TILE_SIZE,
    //canvas: canvas, // Note: Need to remove canvas from the layers data because web workers cannot access it
    path: null,
    // Storage for independent PW scanning
    buffer,
    width: wangData.width,
    mapH: wangData.height,
    tileIndices: null,
    xmax: null,
    ymax: null,
    tileSize: null,
    numHTiles: null,
    numVTiles: null,
    chunkBasePos: { x: bbox[0], y: bbox[1] },
    minX: bbox[0],
    // TODO: Refactor references to these
    minY: bbox[1],
    validChunks: null,
    // Not needed for static tiles
    poisByPW: {},
    // Initialize PW cache
    pixelSceneRooms: null
  };
}
async function generateBiomeTiles(biomePixels, width, height, biomeConfig, worldSeed, ngPlus, global_extra_rerolls = 0, gameMode = "normal") {
  const t0 = performance.now();
  const layers = [];
  for (let biomeName of Object.keys(biomeConfig)) {
    const conf = biomeConfig[biomeName];
    if (!conf.wangFile) continue;
    if (!conf.enabled) continue;
    const offsetY = conf.offsetY !== void 0 ? conf.offsetY : DEFAULT_OFFSET_Y;
    const { regions, bboxes } = findBiomeRegions(biomePixels, width, height, conf.color);
    for (let i = 0; i < regions.length; i++) {
      if (bboxes[i][3] - bboxes[i][1] > 20 && bboxes[i][2] - bboxes[i][0] > 20) console.log(`Generated 20+ chunk region for ${biomeName}: ${bboxes[i][0]},${bboxes[i][1]} to ${bboxes[i][2]},${bboxes[i][3]}`);
      if (!biomeConfig[biomeName].wangFile) continue;
      if (biomeConfig[biomeName].wangFile.includes("static")) {
        layers.push(generateStaticTile(biomeName, biomeConfig[biomeName], bboxes[i]));
        continue;
      }
      let valid = false;
      let currentRerolls = conf.extraRerolls || 0;
      currentRerolls += global_extra_rerolls;
      let attempts = 0;
      let rawResult = null;
      let finalPath = null;
      while (!valid && attempts < MAX_PATHFINDING_ATTEMPTS) {
        rawResult = generateRawTileBuffer(regions[i], bboxes[i], conf.wangData, worldSeed, ngPlus, currentRerolls, biomeName, gameMode, conf.wangFile);
        if (!rawResult) break;
        let path = 1 + bboxes[i][3] - bboxes[i][1] > BIOME_PATH_HEIGHT_LIMIT_CHUNKS ? [] : findMinPath(rawResult.buffer, rawResult.width, rawResult.height, rawResult.pathStart);
        if (BYPASS_PATHFINDING && !path) path = [];
        if (path) {
          valid = true;
          finalPath = path;
        } else {
          currentRerolls++;
          attempts++;
        }
      }
      if (attempts == MAX_PATHFINDING_ATTEMPTS) {
        console.warn(`[Generator] Failed to generate valid tile buffer for ${biomeName} after ${MAX_PATHFINDING_ATTEMPTS} attempts`);
        rawResult = generateRawTileBuffer(regions[i], bboxes[i], conf.wangData, worldSeed, ngPlus, currentRerolls, biomeName, gameMode, conf.wangFile);
        valid = true;
        finalPath = [];
      }
      if (valid && rawResult) {
        if (rawResult.pixelSceneRooms && RESTORE_BLOCKED_ROOMS) {
          for (const room of rawResult.pixelSceneRooms) {
            for (let y = room.startY; y <= room.endY; y++) {
              for (let x = room.startX; x <= room.endX; x++) {
                const idx = (y * rawResult.width + x) * 3;
                rawResult.buffer[idx] = 0;
                rawResult.buffer[idx + 1] = 0;
                rawResult.buffer[idx + 2] = 0;
              }
            }
          }
        }
        if (usesMinesTemplate(conf.wangFile) && gameMode !== "nightmare") {
          undoCoalmineHack(rawResult.buffer, rawResult.width, rawResult.height, "coalmine");
        }
        applyPostprocessingHacks(rawResult.buffer, rawResult.width, rawResult.height, worldSeed, ngPlus, finalPath, conf.randomColors);
        if (rawResult.width > 1024 || rawResult.height > 1028) {
          console.log(`[Generator] Applying extension hack for ${biomeName} region ${i} due to large dimensions (${rawResult.width}x${rawResult.height})`);
          for (let y = 0; y < rawResult.height; y++) {
            for (let x = 0; x < rawResult.width; x++) {
              if (y < 4) continue;
              if (x < 1024 && y < 1028) continue;
              const srcX = x % 1024;
              const srcY = 4 + (y - 4) % 1024;
              const srcIdx = (srcY * rawResult.width + srcX) * 3;
              const dstIdx = (y * rawResult.width + x) * 3;
              rawResult.buffer[dstIdx] = rawResult.buffer[srcIdx];
              rawResult.buffer[dstIdx + 1] = rawResult.buffer[srcIdx + 1];
              rawResult.buffer[dstIdx + 2] = rawResult.buffer[srcIdx + 2];
            }
          }
        }
        const { minX, minY, width: mapW, mapH: renderH } = rawResult;
        const canvas = document.createElement("canvas");
        canvas.width = mapW;
        canvas.height = renderH;
        const ctx = canvas.getContext("2d");
        const imgData = ctx.createImageData(mapW, renderH);
        const validChunks = new Set(regions[i].map((p) => `${p[0]},${p[1]}`));
        applyMasking(rawResult.buffer, imgData, mapW, bboxes[i], validChunks);
        ctx.putImageData(imgData, 0, 0);
        const div5x = Math.floor(bboxes[i][0] / 5);
        const div5y = Math.floor(bboxes[i][1] / 5);
        const mod5x = bboxes[i][0] % 5;
        const mod5y = bboxes[i][1] % 5;
        const correctedX = div5x * 5 * 512 + mod5x * 51 * 10;
        const correctedY = div5y * 5 * 512 + mod5y * 51 * 10;
        layers.push({
          biomeName,
          x: minX * CHUNK_SIZE,
          y: minY * CHUNK_SIZE,
          correctedX,
          correctedY,
          w: mapW * TILE_SIZE,
          h: renderH * TILE_SIZE,
          //canvas: canvas, // Note: Need to remove canvas from the layers data because web workers cannot access it
          path: finalPath ? finalPath.map((p) => ({ x: p.x, y: p.y - offsetY })) : null,
          // Storage for independent PW scanning
          buffer: rawResult.buffer,
          width: mapW,
          mapH: renderH,
          tileIndices: rawResult.tileIndices,
          xmax: rawResult.xmax,
          ymax: rawResult.ymax,
          tileSize: rawResult.tileSize,
          numHTiles: rawResult.numHTiles,
          numVTiles: rawResult.numVTiles,
          chunkBasePos: { x: minX, y: minY },
          minX,
          // TODO: Refactor references to these
          minY,
          validChunks,
          poisByPW: {},
          // Initialize PW cache
          pixelSceneRooms: rawResult.pixelSceneRooms
        });
      }
    }
  }
  const t1 = performance.now();
  console.log(`[Generator] Biome tile generation completed in ${(t1 - t0).toFixed(2)} ms`);
  return layers;
}

// engine/special-sites.json
var special_sites_default = [
  { spell: "CRUMBLING_EARTH", x: 9983, y: -1222, title: "\u91D1\u5B57\u5854\u9876" },
  { spell: "SEA_LAVA", x: 780, y: -1088, title: "\u5C71\u9876\u6D6E\u5C9B" },
  { spell: "TENTACLE", x: -9985, y: 2883, title: "\u79EF\u96EA\u8352\u539F\u9B54\u7403\u5BA4" },
  { spell: "NUKE", x: 3472, y: 1879, title: "\u7194\u5CA9\u6E56\u4E0B\u65B9", mainOnly: true },
  { spell: "NECROMANCY", x: 9982, y: 2883, title: "\u91D1\u5B57\u5854\u4E0B\u65B9" },
  { spell: "BOMB_HOLY", x: -4353, y: 3912, title: "\u79EF\u96EA\u6DF1\u6E0A\u897F\u4FA7\u795E\u6BBF" },
  { spell: "SPIRAL_SHOT", x: -3841, y: 10052, title: "\u8718\u86DB\u6D1E\u6DF1\u90E8" },
  { spell: "CLOUD_THUNDER", x: 4350, y: 836, title: "\u7194\u5CA9\u6E56\u4E1C\u4FA7" },
  { spell: "FIREWORK", x: -256, y: 16208, title: "\u5730\u72F1\u5165\u53E3" },
  { spell: "EXPLODING_DEER", x: -8960, y: 14666, title: "\u897F\u90E8\u6DF1\u5C42" },
  { spell: "MATERIAL_CEMENT", x: 10495, y: 16195, title: "\u4E1C\u90E8\u6DF1\u5C42" }
];

// vendor/noita-telescope-main/js/static_spawns.js
var STATIC_PIXEL_SCENES = [
  { name: "pyramid/boss_limbs", x: 9726, y: -1024, required: true },
  { name: "snowcastle/altar_snowcastle_capsule", x: 143, y: 5112, required: true },
  { name: "snowcastle/forge", x: 1464, y: 5976 },
  { name: "vault/altar_vault_capsule", x: 143, y: 8704, required: true },
  { name: "snowcave/altar_snowcave_capsule", x: 127, y: 3072, required: true },
  { name: "general/tower_start", x: 9676, y: 9086, required: true },
  { name: "general/the_end_shop", x: 0, y: 24576, required: true },
  { name: "general/the_end_shop", x: 0, y: -13954, required: true },
  { name: "general/greed_treasure", x: 9216, y: 4096 },
  { name: "general/fishing_hut", x: -12600, y: 140 },
  { name: "overworld/essence_altar", x: -6948, y: -270, inNGP: true },
  { name: "overworld/essence_altar_desert", x: 12519, y: -30, inNGP: true },
  { name: "overworld/essence_altar", x: -43300, y: -270 },
  { name: "overworld/essence_altar_desert", x: -23833, y: -30 },
  { name: "overworld/essence_altar", x: 29404, y: -270 },
  { name: "overworld/essence_altar_desert", x: 48871, y: -30 },
  { name: "general/bunker", x: -12603, y: 326 },
  { name: "general/bunker2", x: -12953, y: 540 },
  { name: "overworld/snowy_ruins_eye_pillar", x: -2446, y: -223 },
  { name: "general/rainbow_cloud", x: -14059, y: -2851 },
  { name: "overworld/cliff", x: -12400, y: -400 },
  { name: "general/eyespot", x: -3408, y: 1712, required: true },
  { name: "general/eyespot", x: 5852, y: -4944 },
  // This one is in the art
  { name: "general/eyespot", x: 15024, y: 1712, required: true },
  { name: "general/eyespot", x: -1360, y: 9904, required: true },
  { name: "general/eyespot", x: 12976, y: 9904, required: true },
  { name: "overworld/desert_ruins_base_01", x: 5890, y: 0 },
  { name: "overworld/music_machine_stand", x: 14650, y: -34 },
  { name: "overworld/music_machine_stand", x: -1953, y: -1360 },
  { name: "general/huussi", x: 9e3, y: -1900 },
  { name: "general/lavalake_pit", x: 7 * 512, y: 5 * 512 },
  { name: "general/lavalake_pit_cracked", x: 7 * 512, y: 4 * 512 },
  { name: "general/cauldron", x: 7 * 512, y: 10 * 512 }
  // entities...
];
var STATIC_PIXEL_SCENES_NIGHTMARE = [
  { name: "pyramid/boss_limbs", x: 9726, y: -1024, required: true },
  { name: "general/clean_entrance", x: 128, y: 1535, required: true },
  { name: "general/clean_entrance", x: 128, y: 4095, required: true },
  { name: "general/clean_entrance", x: 128, y: 6655, required: true },
  { name: "general/clean_entrance", x: 128, y: 10751, required: true },
  { name: "snowcastle/altar_snowcastle_capsule", x: 143, y: 5112, required: true },
  { name: "vault/altar_vault_capsule", x: 143, y: 8704, required: true },
  { name: "snowcave/altar_snowcave_capsule", x: 127, y: 3072, required: true }
];
var PIXEL_SCENE_BIOMES = {
  // Biome color: scene name
  4280584330: { biome: "excavationsite_cube_chamber", name: "cube_chamber" },
  4279804118: { biome: "snowcave_secret_chamber", name: "secret_chamber" },
  4279817942: { biome: "snowcastle_hourglass_chamber", name: "hourglass_chamber" },
  4281748772: { biome: "dragoncave", name: "dragoncave" },
  4288561922: { biome: "robot_egg", name: "robot_egg" },
  4290421573: { biome: "secret_lab", name: "secret_lab" },
  4286595433: { biome: "wizardcave_entrance", name: "wizardcave_entrance" },
  4284452779: { biome: "teleroom", name: "teleportroom" },
  // Renamed because I was having issues with another scene named the same way
  4279598263: { biome: "mystery_teleport", name: "mystery_teleport" },
  4283943630: { biome: "ocarina", name: "ocarina" },
  4279598256: { biome: "essenceroom", name: "essenceroom" },
  4279598261: { biome: "essenceroom_hell", name: "essenceroom" },
  4279598262: { biome: "essenceroom_alc", name: "essenceroom_submerged" },
  4279598264: { biome: "essenceroom_air", name: "essenceroom" },
  4294955264: { biome: "orbroom_00", name: "orbroom" },
  4294955265: { biome: "orbroom_01", name: "orbroom" },
  4294955266: { biome: "orbroom_02", name: "orbroom" },
  4294955267: { biome: "orbroom_03", name: "orbroom" },
  4294955268: { biome: "orbroom_04", name: "orbroom" },
  4294955269: { biome: "orbroom_05", name: "orbroom" },
  4294955270: { biome: "orbroom_06", name: "orbroom" },
  4294955271: { biome: "orbroom_07", name: "orbroom" },
  4294955272: { biome: "orbroom_08", name: "orbroom" },
  4294955273: { biome: "orbroom_09", name: "orbroom" },
  4294955280: { biome: "orbroom_10", name: "orbroom" },
  4294955281: { biome: "orbroom_11", name: "orbroom" },
  4280236898: { biome: "mestari_secret", name: "secret_lab" },
  4280236900: { biome: "ghost_secret", name: "secret_lab" },
  4283947726: { biome: "alchemist_secret", name: "alchemist_secret" },
  4278883748: { biome: "funroom", name: "funroom" },
  4283858096: { biome: "moon_room", name: "essenceroom" },
  4281493077: { biome: "rock_room", name: "essenceroom" },
  4292967986: { biome: "null_room", name: "null_room" },
  4281968480: { biome: "gun_room", name: "essenceroom" },
  4288514365: { biome: "roboroom", name: "roboroom" },
  4286146080: { biome: "meatroom", name: "meatroom" },
  4293633280: { biome: "scale", name: "scale", offsetX: 100, offsetY: 382 },
  4288518609: { biome: "song_room", name: "alchemist_secret_music" },
  4288057183: { biome: "pyramid_left", name: "left" },
  4288057238: { biome: "pyramid_right", name: "right" },
  4291333983: { biome: "pyramid_top", name: "top" },
  4288053087: { biome: "pyramid_entrance", name: "entrance" },
  4279664479: { biome: "pyramid_hallway", name: "hallway" },
  4293973271: { biome: "roadblock", name: "roadblock" },
  // TODO: I forgot what this was
  4287875930: { biome: "temple_altar_right_snowcastle", name: "altar_right_snowcastle", offsetY: 256 },
  4287875919: { biome: "temple_altar_right_snowcave", name: "altar_right_snowcastle", offsetY: 256 },
  4287875918: { biome: "temple_altar_right", name: "altar_right", offsetY: 256 },
  4287875917: { biome: "temple_altar_left", name: "altar_left", offsetY: 256 },
  4287875916: { biome: "temple_altar", name: "altar", offsetY: 256 },
  4290805890: { biome: "mountain_floating_island", name: "floating_island" },
  4290805888: { biome: "mountain_top", name: "top" },
  4292903040: { biome: "mountain_right_stub", name: "right_stub" },
  4282417280: { biome: "mountain_right", name: "right" },
  4280303712: { biome: "mountain_hall", name: "hall" },
  4280320128: { biome: "mountain_left_entrance", name: "left_entrance" },
  4283494103: { biome: "boss_victoryroom", name: "boss_victoryroom" },
  4279085209: { biome: "boss_arena_top", name: "boss_arena_top" },
  4282203713: { biome: "solid_wall_tower_10", name: "essenceroom" },
  4282456278: { biome: "lavalake_racing", name: "lavalake_racing" }
};
function addStaticPixelScenes(ws, ng, pwIndex, pwIndexVertical, biomeData, skipCosmeticPixelScenes = false, perks = {}, isDaily = false, gameMode = "normal") {
  const isNightmare = gameMode === "nightmare";
  const pixelSceneOption = appSettings.enableStaticPixelScenes;
  let newPixelScenes = [];
  let newPois = [];
  const mapWidth = getWorldSize(ng > 0, gameMode);
  const pwOffsetX = pwIndex * mapWidth * 512;
  if (pixelSceneOption !== "off") {
    const staticScenesToUse = isNightmare ? STATIC_PIXEL_SCENES_NIGHTMARE : STATIC_PIXEL_SCENES;
    for (const scene of staticScenesToUse) {
      if (!scene.inNGP && ng > 0) continue;
      if (pixelSceneOption === "some" && !scene.required) continue;
      const targetPW = Math.floor((scene.x + 512 * getWorldCenter(ng > 0, gameMode)) / (512 * mapWidth));
      const targetPWVertical = Math.floor((scene.y + 512 * 14) / (512 * 48));
      if (targetPW !== pwIndex || targetPWVertical !== pwIndexVertical) continue;
      const biomeFolder = scene.name.split("/")[0];
      const sceneName = scene.name.split("/")[1];
      const pixelScene = loadPixelScene(biomeData, biomeFolder, sceneName, ws, ng, scene.x, scene.y, skipCosmeticPixelScenes, false, gameMode);
      if (pixelScene) {
        newPixelScenes.push(pixelScene);
      }
    }
    if (pixelSceneOption === "all") {
      if (pwIndexVertical === 0) {
        for (let x = 0; x < mapWidth; x++) {
          for (let y = 0; y < 48; y++) {
            const biomeColor = biomeData.pixels[y * mapWidth + x];
            if (PIXEL_SCENE_BIOMES[biomeColor]) {
              const biomePixelSceneInfo = PIXEL_SCENE_BIOMES[biomeColor];
              const biomeName = biomePixelSceneInfo.biome;
              const biomePixelSceneName = biomePixelSceneInfo.name;
              const offsetX = biomePixelSceneInfo.offsetX || 0;
              const offsetY = biomePixelSceneInfo.offsetY || 0;
              const adjX = x * 512 - mapWidth * 256 + pwIndex * mapWidth * 512 + offsetX;
              const adjY = y * 512 - 14 * 512 + pwIndexVertical * 48 * 512 + offsetY;
              const pixelScene = loadPixelScene(biomeData, biomeName, biomePixelSceneName, ws, ng, adjX, adjY, skipCosmeticPixelScenes, false, gameMode);
              if (pixelScene) {
                newPixelScenes.push(pixelScene);
              }
            }
          }
        }
      }
    }
  }
  let hiisiHourglassPosition = null;
  const prng2 = new NollaPrng(0);
  if (ng === 0 && pwIndexVertical === 0 && !isNightmare) {
    const is_right = prng2.ProceduralRandom(ws, 0, 0) > 0.5;
    if (is_right) {
      hiisiHourglassPosition = "right";
      if (pixelSceneOption === "all") {
        const pixelScene2 = loadPixelScene(biomeData, "snowcastle_cavern", "side_cavern_right", ws, ng, 3 * 512 - 50, 10 * 512, skipCosmeticPixelScenes, false, gameMode);
        if (pixelScene2) {
          newPixelScenes.push(pixelScene2);
        }
      }
    } else {
      hiisiHourglassPosition = "left";
      if (pixelSceneOption === "all") {
        const pixelScene2 = loadPixelScene(biomeData, "snowcastle_cavern", "side_cavern_left", ws, ng, -5 * 512 + 50, 10 * 512, skipCosmeticPixelScenes, false, gameMode);
        if (pixelScene2) {
          newPixelScenes.push(pixelScene2);
        }
      }
    }
    const friendRoomPositions = [
      { x: 6 * 512 + pwOffsetX, y: 11 * 512 },
      { x: 8 * 512 + pwOffsetX, y: 19 * 512 },
      { x: -10 * 512 + pwOffsetX, y: 9 * 512 },
      { x: -21 * 512 + pwOffsetX, y: 8 * 512 },
      { x: -22 * 512 + pwOffsetX, y: 22 * 512 },
      { x: -10 * 512 + pwOffsetX, y: 25 * 512 }
    ];
    prng2.SetRandomSeed(ws, 24, 32);
    const friendRoom = prng2.Random(1, 6);
    for (let i = 1; i <= 6; i++) {
      const pixelScene2 = loadPixelScene(biomeData, `friend_${i}`, i === friendRoom ? "cavern" : "friendroom", ws, ng, friendRoomPositions[i - 1].x, friendRoomPositions[i - 1].y, skipCosmeticPixelScenes, false, gameMode);
      if (pixelScene2) {
        newPixelScenes.push(pixelScene2);
      }
      if (i === friendRoom) {
        newPois.push({ type: "item", item: "gourd", x: friendRoomPositions[i - 1].x + 256, y: friendRoomPositions[i - 1].y + 350, biome: `friend_${i}` });
      }
    }
    const stashLocations = [
      { x: -6 * 512 + pwOffsetX, y: 0 },
      { x: -6 * 512 + pwOffsetX, y: 16 * 512 },
      { x: 5 * 512 + pwOffsetX, y: 17 * 512 },
      { x: -8 * 512 + pwOffsetX, y: 22 * 512 }
    ];
    const location = Math.floor(prng2.ProceduralRandom(ws, 1240, -750) * 4);
    const pixelScene = loadPixelScene(biomeData, "solid_wall_hidden_cavern", "solid_wall_hidden_cavern", ws, ng, stashLocations[location].x - 30, stashLocations[location].y, skipCosmeticPixelScenes, false, gameMode);
    if (pixelScene) {
      newPixelScenes.push(pixelScene);
    }
    if (pwIndex === 0) {
      const layout = 1 + Math.floor(prng2.ProceduralRandom(ws, -2048, 515) * 5);
      const waterCaveScene = loadPixelScene(biomeData, "watercave", `watercave_layout_${layout}`, ws, ng, -2048, 515, skipCosmeticPixelScenes, false, gameMode);
      if (waterCaveScene) {
        newPixelScenes.push(waterCaveScene);
      }
      const waterCavePois = {
        1: [{ type: "item", item: "heart", x: -2048 + 184, y: 515 + 96, biome: "watercave" }, { type: "item", item: "full_heal", x: -2048 + 142, y: 515 + 386, biome: "watercave" }],
        2: [{ type: "item", item: "heart", x: -2048 + 340, y: 515 + 329, biome: "watercave" }, { type: "item", item: "full_heal", x: -2048 + 142, y: 515 + 386, biome: "watercave" }],
        3: [{ type: "item", item: "heart", x: -2048 + 144, y: 515 + 385, biome: "watercave" }, { type: "item", item: "full_heal", x: -2048 + 182, y: 515 + 96, biome: "watercave" }],
        4: [{ type: "item", item: "heart", x: -2048 + 170, y: 515 + 384, biome: "watercave" }, { type: "item", item: "full_heal", x: -2048 + 182, y: 515 + 96, biome: "watercave" }],
        5: [{ type: "item", item: "heart", x: -2048 + 184, y: 515 + 96, biome: "watercave" }, { type: "item", item: "full_heal", x: -2048 + 142, y: 515 + 386, biome: "watercave" }]
      };
      newPois.push(...waterCavePois[layout]);
    }
  }
  const holyMountainDepths = { "ng": [2, 5, 9, 12, 16, 20, 25], "ngplus": [2, 5, 12, 20, 25], "nightmare": [2, 7, 12, 20, 25] };
  const holyMountainStarts = { "ng": [-3, -4, -5, -4, -5, -6, -6], "ngplus": [-4, -4, -4, -4, -6], "nightmare": [-7, -7, -7, -7, -6] };
  const holyMountainWidths = { "ng": [7, 8, 10, 7, 9, 11, 9], "ngplus": [7, 7, 7, 9, 9], "nightmare": [14, 14, 13, 14, 9] };
  const ngpkey = ng === 0 ? isNightmare ? "nightmare" : "ng" : "ngplus";
  if (pwIndexVertical === 0) {
    for (let i = 0; i < holyMountainDepths[ngpkey].length; i++) {
      const depth = holyMountainDepths[ngpkey][i];
      const width = holyMountainWidths[ngpkey][i];
      const start = holyMountainStarts[ngpkey][i];
      for (let j = 0; j < width; j++) {
        const idx = (depth + 14) * mapWidth + start + j + mapWidth / 2;
        const biomeColor = biomeData.pixels[idx] & 16777215;
        if (!HOLY_MOUNTAIN_BASIN_COLORS.has(biomeColor)) continue;
        const basin = { x: 512 * (start + j) + pwIndex * mapWidth * 512, y: 512 * depth };
        let material = "";
        if (basin.y > 12e3) material = "_ending";
        else {
          prng2.SetRandomSeed(ws + ng, basin.x, basin.y);
          const randomTop = prng2.Random(1, 50);
          if (randomTop === 5) material = "_water";
          else if (randomTop === 8) material = "_blood";
          else if (randomTop === 11) material = "_oil";
          else if (randomTop === 13) material = "_radioactive";
          else if (randomTop === 15) material = "_lava";
        }
        const pixelScene = loadPixelScene(biomeData, "temple", `altar_top${material}`, ws, ng, basin.x, basin.y - 40, skipCosmeticPixelScenes, false, gameMode);
        if (pixelScene) {
          newPixelScenes.push(pixelScene);
        }
      }
    }
  }
  if (pixelSceneOption !== "off") {
    const splicedScenes = [
      { name: "boss_arena", x: 3 * 512, y: 24 * 512, inNGP: true, inNightmare: true },
      { name: "gourd_room", x: -33 * 512, y: -14 * 512, inNGP: true },
      { name: "lake_statue", x: -29 * 512, y: 0, inNGP: true, inNightmare: true },
      { name: "lavalake_pit_bottom", x: 5 * 512, y: 6 * 512 },
      // TODO: Says this is in nightmare but it doesn't appear to be?
      { name: "lavalake2", x: 4 * 512, y: 0 },
      { name: "moon", x: 0, y: -51 * 512, inNGP: true, required: true, inNightmare: true },
      { name: "moon_dark", x: 0, y: 73 * 512 + 136, inNGP: true, required: true },
      { name: "mountain_lake", x: 5 * 512, y: 0, inNightmare: true },
      // TODO: Top of this changes in NG vs NGP, also it's flat and missing in PWs...
      { name: "skull", x: 29 * 512, y: 31 * 512 + 256 },
      // TODO: Looks weird with the default color
      { name: "skull_in_desert", x: 14 * 512 - 68, y: -100, inNGP: true, inNightmare: true },
      { name: "tree", x: -4 * 512, y: -3 * 512 + 212, inNGP: true, inNightmare: true },
      { name: "watercave", x: -4 * 512, y: 0, required: true }
      // Just the top and bottom edges of the watercave
    ];
    for (const splicedScene of splicedScenes) {
      if (splicedScene.name === "moon" && appSettings.sunState) continue;
      if (splicedScene.name === "moon_dark" && appSettings.darksunState) continue;
      if (!splicedScene.inNGP && ng > 0) continue;
      if (!splicedScene.inNightmare && isNightmare) continue;
      if (pixelSceneOption === "some" && !splicedScene.required) continue;
      const pixelScene = loadPixelScene(biomeData, "spliced", splicedScene.name, ws, ng, splicedScene.x, splicedScene.y, skipCosmeticPixelScenes, false, gameMode);
      if (pixelScene) {
        newPixelScenes.push(pixelScene);
      }
    }
  }
  if (ng === 0 && pwIndex === 0 && pwIndexVertical === 0 && !isNightmare) {
    newPois.push({ type: "item", item: "paha_silma", x: -2434, y: -204, biome: "winter" });
    newPois.push({ type: "item", item: "spell", spell: "RAINBOW_TRAIL", x: -14001, y: -2851, biome: "lake" });
    newPois.push({ type: "puzzle", materials: "tablet", items: [
      generateExperimentalWand2(ws, -12603 + 95 + 64, 326 + 83 - 32),
      { type: "item", item: "spell", spell: "COLOUR_RED", biome: "lake", x: -12603 + 95 + 32, y: 326 + 83 - 8 },
      { type: "item", item: "spell", spell: "COLOUR_ORANGE", biome: "lake", x: -12603 + 95 + 44, y: 326 + 83 - 9 },
      { type: "item", item: "spell", spell: "COLOUR_YELLOW", biome: "lake", x: -12603 + 95 + 56, y: 326 + 83 - 10 },
      { type: "item", item: "spell", spell: "COLOUR_GREEN", biome: "lake", x: -12603 + 95 + 68, y: 326 + 83 - 11 },
      { type: "item", item: "spell", spell: "COLOUR_BLUE", biome: "lake", x: -12603 + 95 + 80, y: 326 + 83 - 12 },
      { type: "item", item: "spell", spell: "COLOUR_PURPLE", biome: "lake", x: -12603 + 95 + 92, y: 326 + 83 - 13 },
      { type: "item", item: "spell", spell: "COLOUR_RAINBOW", biome: "lake", x: -12603 + 95 + 104, y: 326 + 83 - 14 },
      { type: "item", item: "spell", spell: "COLOUR_INVIS", biome: "lake", x: -12603 + 95 + 116, y: 326 + 83 - 15 }
    ], x: -12456, y: 392, biome: "lake" });
    newPois.push({ type: "puzzle", materials: "reforged tablet", items: [
      generateExperimentalWand1(ws, -12953 + 95 + 64, 540 + 83 - 32),
      { type: "item", item: "spell", spell: "IF_HALF", biome: "lake", x: -12953 + 95 + 24, y: 540 + 83 - 8 },
      { type: "item", item: "spell", spell: "IF_HP", biome: "lake", x: -12953 + 95 + 38, y: 540 + 83 - 9 },
      { type: "item", item: "spell", spell: "IF_PROJECTILE", biome: "lake", x: -12953 + 95 + 52, y: 540 + 83 - 10 },
      { type: "item", item: "spell", spell: "IF_ENEMY", biome: "lake", x: -12953 + 95 + 66, y: 540 + 83 - 11 },
      { type: "item", item: "spell", spell: "IF_ELSE", biome: "lake", x: -12953 + 95 + 80, y: 540 + 83 - 12 },
      { type: "item", item: "spell", spell: "IF_ELSE", biome: "lake", x: -12953 + 95 + 94, y: 540 + 83 - 13 },
      { type: "item", item: "spell", spell: "IF_END", biome: "lake", x: -12953 + 95 + 108, y: 540 + 83 - 14 },
      { type: "item", item: "spell", spell: "IF_END", biome: "lake", x: -12953 + 95 + 122, y: 540 + 83 - 15 }
    ], x: -12800, y: 610, biome: "lake" });
    newPois.push({ type: "item", item: "gourd", x: -32 * 512 + 256, y: -13 * 512 + 256, biome: "gourd_room" });
    newPois.push({ type: "item", item: "treasure", x: 9472, y: 4347, biome: "hills" });
  }
  if (ng === 0 && pwIndex === 0 && pwIndexVertical === 0) {
    newPois.push(generateWandKantele(-1633, -783));
    newPois.push({ type: "shop", biome: "mountain_tree", x: -1628, y: -736, items: [
      { type: "item", item: "spell", spell: "KANTELE_A", biome: "mountain_tree", x: -1663, y: -760 },
      { type: "item", item: "spell", spell: "KANTELE_A", biome: "mountain_tree", x: -1663, y: -740 },
      { type: "item", item: "spell", spell: "KANTELE_D", biome: "mountain_tree", x: -1643, y: -760 },
      { type: "item", item: "spell", spell: "KANTELE_D", biome: "mountain_tree", x: -1643, y: -740 },
      { type: "item", item: "spell", spell: "KANTELE_DIS", biome: "mountain_tree", x: -1623, y: -760 },
      { type: "item", item: "spell", spell: "KANTELE_DIS", biome: "mountain_tree", x: -1623, y: -740 },
      { type: "item", item: "spell", spell: "KANTELE_E", biome: "mountain_tree", x: -1603, y: -760 },
      { type: "item", item: "spell", spell: "KANTELE_E", biome: "mountain_tree", x: -1603, y: -740 },
      { type: "item", item: "spell", spell: "KANTELE_G", biome: "mountain_tree", x: -1583, y: -760 },
      { type: "item", item: "spell", spell: "KANTELE_G", biome: "mountain_tree", x: -1583, y: -740 }
    ] });
  }
  if (ng === 0 && pwIndexVertical === 0 && !isNightmare) {
    newPois.push(generateExperimentalWand3(16120 + pwOffsetX, 9996));
    newPois.push(generateExperimentalWand4(13 * 512 + 256 + pwOffsetX, 16 * 512 + 256));
    newPois.push(generateGoodWand1(9884 + pwOffsetX, 4360));
    newPois.push(generateGoodWand2(9984 + pwOffsetX, 4360));
    newPois.push(generateGoodWand3(10084 + pwOffsetX, 4360));
  }
  if (pwIndexVertical === 0) {
    newPois.push(generateWandHuilu(-9985 + pwOffsetX, -6472));
    newPois.push({ type: "shop", biome: "ocarina", x: -9987 + pwOffsetX, y: -6400, items: [
      { type: "item", item: "spell", spell: "OCARINA_A", biome: "ocarina", x: -10055 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_A", biome: "ocarina", x: -10055 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_B", biome: "ocarina", x: -10035 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_B", biome: "ocarina", x: -10035 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_C", biome: "ocarina", x: -10015 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_C", biome: "ocarina", x: -10015 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_D", biome: "ocarina", x: -9995 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_D", biome: "ocarina", x: -9995 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_E", biome: "ocarina", x: -9975 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_E", biome: "ocarina", x: -9975 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_F", biome: "ocarina", x: -9955 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_F", biome: "ocarina", x: -9955 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_GSHARP", biome: "ocarina", x: -9935 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_GSHARP", biome: "ocarina", x: -9935 + pwOffsetX, y: -6418 },
      { type: "item", item: "spell", spell: "OCARINA_A2", biome: "ocarina", x: -9915 + pwOffsetX, y: -6466 },
      { type: "item", item: "spell", spell: "OCARINA_A2", biome: "ocarina", x: -9915 + pwOffsetX, y: -6418 }
    ] });
  }
  if (pwIndex === 0 && pwIndexVertical === 0 && !isNightmare) {
    newPois.push(getTinyDrops(ws, ng, "meat", 14941, 16454, perks));
  }
  if (pwIndex === 0 && pwIndexVertical === 0) {
    const baseX = -4 * 512;
    const baseY = -3 * 512 + 212;
    const egg_positions = [
      { x: 999, y: 845 },
      // -> -1047, -477
      { x: 914, y: 301 },
      { x: 904, y: 302 }
    ];
    for (const pos of egg_positions) {
      prng2.SetRandomSeed(ws + ng, baseX + pos.x, baseY + pos.y);
      let r = prng2.Next() * 0.42;
      let eggType = "egg_worm";
      if (r >= 0.4) {
        eggType = "egg_purple";
      }
      newPois.push({ type: "item", item: eggType, x: baseX + pos.x + 2, y: baseY + pos.y + 2, biome: "mountain_tree" });
    }
  }
  if (ng === 0) {
    const startingLoadout = getStartingLoadout(ws, isDaily, gameMode);
    newPois.push(startingLoadout);
  }
  if (isNightmare && ng === 0 && pwIndexVertical === 0) {
    const nightmareWands = getNightmareStartingWands(ws, pwIndex);
    newPois.push(...nightmareWands);
  }
  return {
    pixelScenes: newPixelScenes,
    pois: newPois,
    hiisiHourglassPosition
  };
}
function getNightmareStartingWands(ws, pwIndex) {
  const prng2 = new NollaPrng(0);
  prng2.SetRandomSeed(ws, 703 + pwIndex * 64 * 512, -94);
  const wands = [];
  const opts = ["wand_level_02", "wand_level_02_better", "wand_level_03", "wand_unshuffle_01", "wand_unshuffle_02", "wand_unshuffle_03"];
  for (let i = 0; i < 3; i++) {
    const wandChoice = 0;
    const x = Math.fround(703 + i * 132 / 3);
    const y = -94;
    const wand = generateWand(ws, 0, x, y, opts[wandChoice]);
    wand["biome"] = "mountain_hall";
    wands.push(wand);
  }
  return wands;
}
function generateExperimentalWand1(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "lake",
    x,
    y,
    name: "IfElse Experimental Wand",
    sprite: "custom/experimental_wand_1",
    tip: { x: 9, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 14,
    actions_per_round: 1,
    reload_time: "0.5 - 0.67",
    // 30 - 40f
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 5,
    spread_degrees: 0,
    speed_multiplier: 1,
    mana_charge_speed: "200 - 300",
    mana_max: "500 - 600",
    is_rare: false,
    always_casts: [],
    cards: ["BLOODLUST", "IF_HALF", "ROCKET_TIER_3", "IF_ELSE", "GRENADE_TIER_3", "IF_END"]
  };
}
function generateExperimentalWand2(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "lake",
    x,
    y,
    name: "Colour Experimental Wand",
    sprite: "custom/experimental_wand_2",
    tip: { x: 12, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 10,
    actions_per_round: 1,
    reload_time: "0.67 - 1.0",
    // 40 - 60f
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 20,
    spread_degrees: 0,
    speed_multiplier: 1,
    mana_charge_speed: "100 - 200",
    mana_max: "500 - 600",
    is_rare: false,
    always_casts: [],
    cards: ["UNIDENTIFIED", "SPITTER_TIER_3", "UNIDENTIFIED", "SPITTER_TIER_3", "UNIDENTIFIED", "SPITTER_TIER_3", "COLOUR_INVIS", "SPITTER_TIER_3", "COLOUR_RAINBOW", "SPITTER_TIER_3"]
    // TODO: It would be cool to use a gif for random color but meh
    //cards: ['RANDOM_COLOUR', 'SPITTER_TIER_3', 'RANDOM_COLOUR', 'SPITTER_TIER_3', 'RANDOM_COLOUR', 'SPITTER_TIER_3', 'COLOUR_INVIS', 'SPITTER_TIER_3', 'COLOUR_RAINBOW', 'SPITTER_TIER_3'],
  };
}
function generateExperimentalWand3(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "gun_room",
    x,
    y,
    name: "It's a wand, ok? Experimental Wand",
    sprite: "custom/actual_wand_honest",
    tip: { x: 15, y: 1 },
    grip: { x: 0, y: 0 },
    deck_capacity: 2,
    actions_per_round: 1,
    reload_time: 3,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 3,
    spread_degrees: 10,
    speed_multiplier: 2,
    mana_charge_speed: 500,
    mana_max: "1200 - 1500",
    is_rare: false,
    always_casts: ["FUNKY_SPELL"],
    cards: []
  };
}
function generateExperimentalWand4(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "meatroom",
    x,
    y,
    name: "Saha Experimental Wand",
    sprite: "custom/chainsaw",
    tip: { x: 8, y: 1 },
    grip: { x: 0, y: 0 },
    deck_capacity: 1,
    actions_per_round: 1,
    reload_time: 1,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 1,
    spread_degrees: 30,
    speed_multiplier: 4,
    mana_charge_speed: "200 - 300",
    mana_max: "800 - 900",
    is_rare: false,
    always_casts: ["RECOIL_DAMPER", "BLOODLUST", "CHAINSAW"],
    cards: []
  };
}
function generateGoodWand1(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "solid_wall_tower_10",
    x,
    y,
    name: "Wand of Swiftness",
    sprite: "custom/good_01",
    tip: { x: 15, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 19,
    actions_per_round: 1,
    reload_time: "0.0 - 0.08",
    // 0 - 5f
    shuffle_deck_when_empty: 0,
    fire_rate_wait: -20,
    spread_degrees: 0,
    speed_multiplier: 1.25,
    mana_charge_speed: "600 - 700",
    mana_max: "800 - 1000",
    is_rare: false,
    always_casts: [],
    cards: ["UNIDENTIFIED"]
  };
}
function generateGoodWand2(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "solid_wall_tower_10",
    x,
    y,
    name: "Wand of Destruction",
    sprite: "custom/good_02",
    tip: { x: 15, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 25,
    actions_per_round: 1,
    reload_time: -2280,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: "0.33 - 0.83",
    // 20 - 50f
    spread_degrees: 0,
    speed_multiplier: 1.33,
    mana_charge_speed: 800,
    mana_max: "1100 - 1500",
    is_rare: false,
    always_casts: ["NUKE"],
    cards: ["ROCKET_TIER_3"]
  };
}
function generateGoodWand3(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "solid_wall_tower_10",
    x,
    y,
    name: "Wand of Multitudes",
    sprite: "custom/good_03",
    tip: { x: 15, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 26,
    actions_per_round: 26,
    reload_time: "0.4 - 0.63",
    // 24 - 38f
    shuffle_deck_when_empty: 0,
    fire_rate_wait: "0.08 - 0.17",
    // 5 - 10f
    spread_degrees: "3 - 8",
    speed_multiplier: 1.5,
    mana_charge_speed: "300 - 500",
    mana_max: "1200 - 1500",
    is_rare: false,
    always_casts: [],
    cards: ["UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED", "UNIDENTIFIED"]
  };
}
function generateWandKantele(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "mountain_tree",
    x,
    y,
    name: "Kantele",
    sprite: "custom/kantele",
    tip: { x: 10, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 20,
    actions_per_round: 1,
    reload_time: 1,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 2,
    spread_degrees: -2,
    speed_multiplier: 1,
    mana_charge_speed: 30,
    mana_max: 2,
    is_rare: false,
    always_casts: [],
    cards: []
  };
}
function generateWandHuilu(x, y) {
  return {
    type: "wand",
    item: "wand",
    biome: "ocarina",
    x,
    y,
    name: "Huilu",
    sprite: "custom/flute",
    tip: { x: 10, y: -0.5 },
    grip: { x: 0, y: 0 },
    deck_capacity: 20,
    actions_per_round: 1,
    reload_time: 1,
    shuffle_deck_when_empty: 0,
    fire_rate_wait: 2,
    spread_degrees: -2,
    speed_multiplier: 1,
    mana_charge_speed: 30,
    mana_max: 2,
    is_rare: false,
    always_casts: [],
    cards: []
  };
}

// engine/layer.ts
globalThis.document = { createElement: (type) => {
  if (type !== "canvas") throw Error("Unsupported DOM element");
  return createCanvas(1, 1);
} };
globalThis.OffscreenCanvas = function(width, height) {
  return createCanvas(width, height);
};
var bounds = [0, 1536, 3072, 5120, 6656, 8704, 10752, 13312];
var initPromise;
var base;
var lastSeed;
var cache = /* @__PURE__ */ new Map();
var mapContext = "";
var mapCache = /* @__PURE__ */ new Map();
async function init() {
  updateSettings({ enableStaticPixelScenes: "all", skipCosmeticScenes: true, showEnemies: false });
  base = await loadPNG("../data/biome_maps/biome_map.png");
  await initBiomeColors();
  await loadPixelSceneData();
}
var mainBiomes = [["coalmine", "coalmine_alt"], ["excavationsite"], ["snowcave"], ["snowcastle"], ["rainforest", "rainforest_open"], ["vault"], ["crypt"]];
function validateArea(area) {
  if (!area || !["rect", "biome"].includes(area.kind) || !Array.isArray(area.bounds) || area.bounds.length !== 4 || area.bounds.some((n) => !Number.isFinite(n))) throw Error("Invalid resource area");
  const [x1, y1, x2, y2] = area.bounds;
  if (x1 < -17920 || x2 > 17920 || x1 >= x2 || y1 >= y2) throw Error("Invalid resource area bounds");
  if (area.kind === "biome" && (!Array.isArray(area.biomes) || !area.biomes.length || area.biomes.some((k) => !Object.hasOwn(GENERATOR_CONFIG, k)))) throw Error("Invalid resource biome");
  if (area.cells && (!Array.isArray(area.cells) || area.cells.length > 3360 || !area.cells.length || area.cells.some((c) => !Array.isArray(c) || c.length !== 2 || !Number.isInteger(c[0]) || !Number.isInteger(c[1]) || c[0] < 0 || c[0] >= 70 || c[1] < 0 || c[1] >= 48))) throw Error("Invalid biome cells");
}
function pointInArea(obj, x, y, area, pw, biome) {
  const [x1, y1, x2, y2] = area.bounds, lx = x - pw * 35840;
  if (lx < x1 || lx >= x2 || y < y1 || y >= y2) return false;
  if (area.kind === "rect") return true;
  const plane = area.verticalIndex ?? 0, pixels = plane < 0 ? biome.heavenPixels : plane > 0 ? biome.hellPixels : biome.pixels;
  const domain = plane ? { ...biome, pixels, heavenPixels: pixels, hellPixels: pixels } : biome;
  const resolved = getResolvedBiome(domain, x, y - plane * 24570, false, "normal");
  return area.biomes.includes(resolved.biome) && (!area.cells || area.cells.some((c) => c[0] === resolved.pos.x && c[1] === resolved.pos.y));
}
function areaContains(seed, pw, area, x, y) {
  return pointInArea({}, x, y, area, pw, generateBiomeData(seed, 0, "normal", base.data, base.width, base.height));
}
async function areaResources(seed, area, pw = 0) {
  validateArea(area);
  await (initPromise ??= init());
  const cached = mapContext === `${seed}:${pw}` ? [...mapCache.values()].find((m) => area.bounds[1] >= m.origin[1] && area.bounds[3] <= m.origin[1] + m.height) : null;
  if (cached || area.verticalIndex || area.bounds[1] < -7168 || area.bounds[3] > 17408) {
    const map = cached ?? await worldMap(seed, pw, area.verticalIndex ?? 0);
    const biome = generateBiomeData(seed, 0, "normal", base.data, base.width, base.height);
    const items = map.pois.filter((p) => ["wand", "spell", "potion", "pickup", "chest"].includes(p.type) && pointInArea(p, p.x, p.y, area, pw, biome));
    const evidence = [];
    for (const p of items) {
      if (p.spell) evidence.push({ id: p.spell, x: p.x, y: p.y, source: p.source });
      const cards = p.wand?.cards?.cards ?? p.cards ?? [], always = p.wand?.cards?.permanentCard ?? p.always_casts ?? [];
      for (const id of [...cards, ...Array.isArray(always) ? always : always ? [always] : []]) evidence.push({ id, x: p.x, y: p.y, source: "wand" });
    }
    return { items, evidence, ids: [...new Set(evidence.map((p) => p.id))], bounds: [area.bounds[1], area.bounds[3]], scope: "region", layer: 0, worldOffset: pw, area, fromMapCache: !!cached };
  }
  return layerSpells(seed, 0, "region", pw, area);
}
async function layerSpells(seed, layer, scope = "main", pw = 0, area = null) {
  if (!Number.isInteger(layer) || layer < 0 || layer > 6) throw Error("Invalid layer");
  if (!["main", "depth", "overgrown", "region"].includes(scope)) throw Error("Invalid layer scope");
  if (!Number.isInteger(pw) || Math.abs(pw) > 100) throw Error("Invalid parallel world");
  await (initPromise ??= init());
  if (scope === "region") validateArea(area);
  if (seed !== lastSeed) {
    cache.clear();
    lastSeed = seed;
  }
  const cacheKey = (scope === "overgrown" ? "region" : layer) + ":" + scope + ":" + pw + (scope === "region" ? ":" + JSON.stringify(area) : "");
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  if (scope !== "region" && mapContext === `${seed}:${pw}` && mapCache.has(0)) {
    const selected = scope === "overgrown" ? { kind: "biome", biomes: ["fungiforest"], bounds: [-17920, 0, 17920, 8704] } : scope === "depth" ? { kind: "rect", bounds: [-17920, bounds[layer], 17920, bounds[layer + 1]] } : { kind: "biome", biomes: [...mainBiomes[layer], ...Object.keys(GENERATOR_CONFIG).filter((k) => k.startsWith("temple_"))], bounds: [-17920, bounds[layer], 17920, bounds[layer + 1]] };
    const result2 = { ...await areaResources(seed, selected, pw), layer, scope, area: null };
    if (cache.size >= 16) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, result2);
    return result2;
  }
  const biome = generateBiomeData(seed, 0, "normal", base.data, base.width, base.height);
  const low = scope === "region" ? area.bounds[1] : scope === "overgrown" ? 0 : bounds[layer], high = scope === "region" ? area.bounds[3] : scope === "overgrown" ? 8704 : bounds[layer + 1];
  const offset = pw * 35840;
  const colors = /* @__PURE__ */ new Set();
  const minX = scope === "region" ? Math.max(0, Math.floor((area.bounds[0] + 17920) / 512) - 1) : 0, maxX = scope === "region" ? Math.min(base.width, Math.ceil((area.bounds[2] + 17920) / 512) + 1) : base.width;
  for (let y = Math.max(0, 14 + Math.floor(low / 512) - 1); y < Math.min(base.height, 14 + Math.ceil(high / 512) + 1); y++) for (let x = minX; x < maxX; x++) colors.add(biome.pixels[y * base.width + x] >>> 0);
  const allowed = new Set(mainBiomes[layer]);
  for (const [key, conf] of Object.entries(GENERATOR_CONFIG)) {
    conf.enabled = scope === "region" ? area.kind === "biome" ? area.biomes.includes(key) : colors.has(conf.color >>> 0) : scope === "overgrown" ? key === "fungiforest" : scope === "depth" ? colors.has(conf.color >>> 0) : allowed.has(key) || key.startsWith("temple_");
    if (conf.enabled && conf.wangFile && !conf.wangData) conf.wangData = await loadPNG(conf.wangFile);
  }
  const tiles = await generateBiomeTiles(biome.pixels, base.width, base.height, GENERATOR_CONFIG, seed, 0);
  const spawns = prescanSpawnFunctions(tiles, false);
  const scan = scanSpawnFunctions(biome, spawns, seed, 0, pw, 0, true, {});
  const specials = getSpecialPoIs(biome, seed, 0, pw, 0, {});
  const statics = addStaticPixelScenes(seed, 0, pw, 0, biome, true, {}, false, "normal");
  const all = [...scan.generatedSpawns, ...specials, ...statics.pois];
  const evidence = [], items = [], seen = /* @__PURE__ */ new Set();
  function collect(obj, x, y, source) {
    if (!obj || typeof obj !== "object") return;
    x = Number.isFinite(obj.x) ? obj.x : x;
    y = Number.isFinite(obj.y) ? obj.y : y;
    if (!Number.isFinite(y) || !Number.isFinite(x)) return;
    if (y < low || y >= high || x < offset - 17920 || x >= offset + 17920) {
      if (Array.isArray(obj.items)) for (const item of obj.items) collect(item, x, y, obj.type ?? source);
      return;
    }
    const resolved = getResolvedBiome(biome, x, y, false, "normal").biome;
    if (scope === "overgrown" && resolved !== "fungiforest") return;
    const inside = scope === "region" ? pointInArea(obj, x, y, area, pw, biome) : scope !== "main" || allowed.has(resolved) || resolved?.startsWith("temple_");
    if (!inside) {
      if (Array.isArray(obj.items)) for (const item of obj.items) collect(item, x, y, obj.type ?? source);
      return;
    }
    if (obj.type === "wand" || typeof obj.spell === "string" || obj.type === "item" || ["chest", "great_chest"].includes(obj.type)) {
      const key = [obj.type, x, y, obj.spell ?? obj.item ?? obj.cards?.join(",")].join(":");
      const type = obj.type === "wand" ? "wand" : obj.spell ? "spell" : ["chest", "great_chest"].includes(obj.type) ? "chest" : ["potion", "potion_empty", "powder_stash", "powder_pouch", "pouch"].includes(obj.item) ? "potion" : "pickup";
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ ...obj, type, x, y, biome: resolved, worldOffset: pw, source, price: source.includes("shop") ? null : 0 });
      }
    }
    if (obj.spell && typeof obj.spell === "string") evidence.push({ id: obj.spell, x, y, source });
    for (const key of ["cards", "always_casts"]) if (Array.isArray(obj[key])) {
      for (const id of obj[key]) if (typeof id === "string") evidence.push({ id, x, y, source: obj.type ?? source });
    }
    if (Array.isArray(obj.items)) for (const item of obj.items) collect(item, x, y, obj.type ?? source);
  }
  for (const obj of all) {
    collect(obj, obj.x, obj.y, obj.type ?? "world");
  }
  const result = { ids: [...new Set(evidence.map((e) => e.id))], evidence, items, bounds: [low, high], layer, scope, worldOffset: pw, area };
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, result);
  return result;
}
function mapRegions(pixels, pw, plane) {
  const result = [], visited = /* @__PURE__ */ new Set(), names = new Map(Object.entries(GENERATOR_CONFIG).map(([key, conf]) => [conf.color >>> 0, key]));
  const part = (key, y) => key === "winter" ? Math.floor(y / 14) : key === "winter_caves" ? y < 24 ? 0 : y < 31 ? 1 : y < 39 ? 2 : 3 : 0;
  for (let index = 0; index < pixels.length; index++) {
    if (visited.has(index)) continue;
    const color = pixels[index] >>> 0, key = names.get(color);
    if (!key) continue;
    const cells = [], keys = /* @__PURE__ */ new Set(), queue = [index];
    visited.add(index);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i], x = n % base.width, y = Math.floor(n / base.width);
      cells.push([x, y]);
      keys.add(names.get(pixels[n] >>> 0));
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const ni = ny * base.width + nx;
        const neighbor = names.get(pixels[ni] >>> 0);
        const same = pixels[ni] >>> 0 === color || key.startsWith("temple_") && neighbor?.startsWith("temple_");
        if (nx >= 0 && nx < base.width && ny >= 0 && ny < base.height && !visited.has(ni) && same && part(key, ny) === part(key, y)) {
          visited.add(ni);
          queue.push(ni);
        }
      }
    }
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const bounds2 = [Math.max(-17920, Math.min(...xs) * 512 - 17920 - 64), Math.min(...ys) * 512 - 7168 + plane * 24570 - 64, Math.min(17920, (Math.max(...xs) + 1) * 512 - 17920 + 64), (Math.max(...ys) + 1) * 512 - 7168 + plane * 24570 + 64];
    result.push({ kind: "biome", biomes: [...keys], label: key.startsWith("temple_") ? "\u5723\u5C71" : GENERATOR_CONFIG[key].name ?? key, bounds: bounds2, cells, verticalIndex: plane });
  }
  return result;
}
async function worldMap(seed, pw = 0, vertical = 0, progress = (value, phase) => {
}) {
  const context = `${seed}:${pw}`;
  if (context !== mapContext) {
    mapCache.clear();
    mapContext = context;
  }
  if (mapCache.has(vertical)) return mapCache.get(vertical);
  const result = await generateWorldMap(seed, pw, vertical, progress);
  if (mapCache.size >= 3) mapCache.delete(mapCache.keys().next().value);
  mapCache.set(vertical, result);
  return result;
}
async function generateWorldMap(seed, pw = 0, vertical = 0, progress = (value, phase) => {
}) {
  progress(0, "\u521D\u59CB\u5316\u5730\u56FE\u751F\u6210\u5668");
  if (!Number.isInteger(pw) || Math.abs(pw) > 100) throw Error("Invalid parallel world");
  if (!Number.isInteger(vertical) || Math.abs(vertical) > 1e6) throw Error("Invalid vertical section");
  await (initPromise ??= init());
  updateSettings({ enableStaticPixelScenes: "all", skipCosmeticScenes: false, showEnemies: true, clearSpawnPixels: true, recolorMaterials: true });
  try {
    let collect = function(obj, parent = {}) {
      if (!obj || typeof obj !== "object" || obj.type === "holy_mountain_shop" || obj.ignore) return;
      const x = Number.isFinite(obj.x) ? obj.x : parent.x, y = Number.isFinite(obj.y) ? obj.y : parent.y;
      const source = obj.biome ?? parent.biome ?? "", paid = !!parent.paid || parent.type === "shop" || obj.type === "shop";
      const plane = obj.verticalIndex ?? parent.verticalIndex ?? 0;
      let type = obj.type === "wand" ? "wand" : typeof obj.spell === "string" ? "spell" : null;
      if (["chest", "great_chest"].includes(obj.type)) type = "chest";
      else if (obj.type === "item" && !obj.spell) type = ["potion", "potion_empty", "powder_stash", "powder_pouch", "pouch"].includes(obj.item) ? "potion" : "pickup";
      if (type) {
        const key = [type, x, y, obj.spell ?? obj.item ?? obj.cards?.join(",")].join(":");
        if (!seen.has(key) && Number.isFinite(x) && Number.isFinite(y)) {
          seen.add(key);
          pois.push({ ...obj, type, x, y, source, paid, verticalIndex: plane, tier: paid ? tiers[source] ?? null : null, container: parent.type ?? null, price: paid ? null : 0 });
        }
      }
      if (obj.entity && /boss_|alchemist_boss/.test(obj.entity)) pois.push({ type: "boss", entity: obj.entity, x, y, source, verticalIndex: plane, accuracy: "spawn", price: 0 });
      if (Array.isArray(obj.items)) for (const item of obj.items) collect(item, { ...obj, x, y, biome: source, paid, verticalIndex: plane });
    };
    const biome = generateBiomeData(seed, 0, "normal", base.data, base.width, base.height);
    for (const conf of Object.values(GENERATOR_CONFIG)) {
      conf.enabled = true;
      if (conf.wangFile && !conf.wangData) conf.wangData = await loadPNG(conf.wangFile);
    }
    const offset = pw * 35840, left = offset - 17920, top = vertical === 0 ? -31744 : -7168 + vertical * 24570, scale = 10;
    const height = vertical === 0 ? 73728 : 24576;
    const canvas = createCanvas(3584, Math.ceil(height / scale)), ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const overlay = vertical === 0 ? createCanvas(3584, 2458) : null, oc = overlay?.getContext("2d");
    if (oc) oc.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const all = [], regions = [];
    let waterCave = null;
    let completed = 0;
    const planeCount = vertical === 0 ? 3 : 1;
    for (const plane of vertical === 0 ? [-1, 0, 1] : [vertical]) {
      const label = plane < 0 ? "\u5929\u754C" : plane > 0 ? "\u5730\u72F1" : "\u5730\u8868\u4E0E\u5730\u4E0B";
      progress(5 + Math.floor(completed / planeCount * 85), "\u751F\u6210" + label + "\u5730\u5F62");
      const pixels = plane < 0 ? biome.heavenPixels : plane > 0 ? biome.hellPixels : biome.pixels;
      regions.push(...mapRegions(pixels, pw, plane));
      const tiles = await generateBiomeTiles(pixels, base.width, base.height, GENERATOR_CONFIG, seed, 0);
      for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
        const color = BIOME_COLOR_LOOKUP[pixels[y * base.width + x] & 16777215] ?? 1514276;
        ctx.fillStyle = "#" + Number(color).toString(16).padStart(6, "0");
        ctx.fillRect(x * 51.2, (y * 512 - 7168 + plane * 24570 - top) / scale, 52, 52);
        if (plane === 0 && oc && BIOME_COLORS_WITH_TILES.has(pixels[y * base.width + x] & 16777215)) {
          oc.fillStyle = "#" + Number(color).toString(16).padStart(6, "0");
          oc.fillRect(x * 51.2, y * 51.2, 51.2, 51.2);
        }
      }
      const images = createTileOverlaysCheap(biome, tiles, pw, plane, false);
      tiles.forEach((tile, i) => {
        const pos = tileToWorldCoordinates(tile.minX, tile.minY, 0, 0, pw, plane, false);
        if (images[i]) ctx.drawImage(images[i], (pos.x - left) / scale, (pos.y - top) / scale);
        if (images[i] && plane === 0 && oc) oc.drawImage(images[i], (pos.x - left) / scale, (pos.y + 7168) / scale);
      });
      const prescan = prescanSpawnFunctions(tiles, false);
      progress(5 + Math.floor((completed + 0.5) / planeCount * 85), "\u8BA1\u7B97" + label + "\u8D44\u6E90\u4E0E\u56FA\u5B9A\u573A\u666F");
      const scanned = scanSpawnFunctions(biome, prescan, seed, 0, pw, plane, false, {});
      const fixed = addStaticPixelScenes(seed, 0, pw, plane, biome, false, {}, false, "normal");
      all.push(...[...scanned.generatedSpawns, ...getSpecialPoIs(biome, seed, 0, pw, plane, {}), ...fixed.pois].map((p) => ({ ...p, verticalIndex: plane })));
      const scenes = [...scanned.finalPixelScenes, ...fixed.pixelScenes];
      scenes.sort((a, b) => Number(!!a.name?.startsWith("watercave_layout_")) - Number(!!b.name?.startsWith("watercave_layout_")));
      for (const scene of scenes) {
        const image = getPixelSceneCanvas(scene);
        if (image) ctx.drawImage(image, (scene.x - left) / scale, (scene.y - top) / scale, scene.width / scale, scene.height / scale);
        if (image && plane === 0 && oc) oc.drawImage(image, (scene.x - left) / scale, (scene.y + 7168) / scale, scene.width / scale, scene.height / scale);
        if (plane === 0 && pw === 0 && scene.name?.startsWith("watercave_layout_")) {
          const png = await loadPNG("../data/pixel_scenes/general/" + scene.name + ".png");
          const layout = createCanvas(png.width, png.height), lc = layout.getContext("2d"), data = lc.createImageData(png.width, png.height);
          data.data.set(png.data);
          lc.putImageData(data, 0, 0);
          ctx.drawImage(layout, (scene.x - left) / scale, (scene.y - top) / scale, scene.width / scale, scene.height / scale);
          if (oc) oc.drawImage(layout, (scene.x - left) / scale, (scene.y + 7168) / scale, scene.width / scale, scene.height / scale);
          waterCave = { layout: Number(scene.name.split("_").pop()), bounds: [scene.x, scene.y, scene.width, scene.height] };
        }
      }
      completed++;
    }
    progress(92, "\u6574\u7406\u7269\u54C1\u3001\u77F3\u677F\u4E0E Boss \u4F4D\u7F6E");
    const pois = [], seen = /* @__PURE__ */ new Set();
    const tiers = { coalmine: 1, coalmine_alt: 1, excavationsite: 2, snowcave: 3, meat: 3, rainforest: 4, vault: 4, crypt: 5, the_end: 10, the_sky: 10 };
    all.forEach((obj) => collect(obj));
    if (vertical === 0) {
      for (const site of special_sites_default) {
        if (pw !== 0 && site.mainOnly) continue;
        const x = site.x + offset, y = site.y;
        pois.push({ type: "pickup", item: pw === 0 ? "orb" : "orb_cursed", x, y, label: (pw === 0 ? "\u771F\u77E5\u9B54\u7403" : "\u8BC5\u5492\u9B54\u7403") + " \xB7 " + site.title, source: "fixed_orb_site", relatedSpell: site.spell, verticalIndex: 0, worldOffset: pw, price: 0 });
        if (site.spell !== "NUKE") pois.push({ type: "pickup", item: "emerald_tablet", x: x + 40, y: y + 50, label: "\u7FE1\u7FE0\u77F3\u677F\uFF08\u7FE0\u7389\u5F55\uFF09\xB7 " + site.title, source: "fixed_tablet_room", relatedSpell: site.spell, accuracy: "region", verticalIndex: 0, worldOffset: pw, price: 0 });
      }
      if (pw === 0) {
        for (const [x, y, title, relatedSpell] of [[-1328, -209, "\u5DE8\u6811\u6839\u90E8", null], [2339, 840, "\u77FF\u5751\u7194\u5CA9\u6E56\u65C1", null], [3503, 1891, "\u7194\u5CA9\u6E56\u4E0B\u65B9", "NUKE"]]) {
          pois.push({ type: "pickup", item: "emerald_tablet", x, y, label: "\u7FE1\u7FE0\u77F3\u677F\uFF08\u7FE0\u7389\u5F55\uFF09\xB7 " + title, source: "fixed_tablet_spawn", relatedSpell, accuracy: "spawn", verticalIndex: 0, worldOffset: 0, price: 0 });
        }
      }
      const rooms = { secret_lab: ["boss_alchemist", "\u9AD8\u9636\u70BC\u91D1\u672F\u58EB"], wizardcave_entrance: ["boss_gate", "Kolmisilm\xE4n koipi"], dragoncave: ["boss_dragon", "\u5DE8\u9F99"], roboroom: ["boss_robot", "\u673A\u68B0 Kolmi"], meatroom: ["boss_meat", "\u8089\u7403 Boss"], mestari_secret: ["boss_wizard", "\u6CD5\u5E08\u4E4B\u5E08"], boss_arena: ["boss_centipede", "Kolmisilm\xE4"], lavalake_pit: ["boss_pit", "Sauvojen tuntija"] };
      for (const [key, [entity, label]] of Object.entries(rooms)) {
        if (pw !== 0 && ["boss_arena", "lavalake_pit"].includes(key)) continue;
        const color = GENERATOR_CONFIG[key]?.color;
        if (!color) continue;
        const cells = [];
        for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) if (biome.pixels[y * base.width + x] >>> 0 === color >>> 0) cells.push([x, y]);
        if (cells.length) {
          const x = offset - 17920 + (cells.reduce((s, p) => s + p[0], 0) / cells.length + 0.5) * 512, y = -7168 + (cells.reduce((s, p) => s + p[1], 0) / cells.length + 0.5) * 512;
          pois.push({ type: "boss", entity, label, x, y, source: key, accuracy: "region", price: 0 });
        }
      }
      if (pw === 0) pois.push({ type: "boss", entity: "boss_limbs", label: "\u91D1\u5B57\u5854 Boss", x: 10112, y: -768, source: "pyramid", accuracy: "region", price: 0 });
    }
    progress(97, "\u7F16\u7801\u5730\u56FE\u56FE\u50CF");
    return { seed, worldOffset: pw, verticalIndex: vertical, origin: [left, top], scale, width: 35840, height, image: canvas.toBuffer("image/png").toString("base64"), overlay: overlay ? { image: overlay.toBuffer("image/png").toString("base64"), origin: [left, -7168], scale } : null, shopCoverage: "fixed-heaven-hell-only", regions, pois: pois.filter((p) => p.x >= left && p.x < left + 35840 && p.y >= top && p.y < top + height), waterCave, terrain: "Wang tiles + pixel scenes (10 world pixels / raster pixel)" };
  } finally {
    updateSettings({ skipCosmeticScenes: true, showEnemies: false });
  }
}
export {
  areaContains,
  areaResources,
  layerSpells,
  validateArea,
  worldMap
};
