/*!
 * From https://www.redblobgames.com/x/2543-mapgen1-hexagons/
 * Copyright 2025 Red Blob Games <redblobgames@gmail.com>
 * @license Apache-2.0 <https://www.apache.org/licenses/LICENSE-2.0.html>
 */

const MAP_RADIUS = 15;

import { Point, Hex, Layout } from "./hexlib.js";
import { createNoise2D } from "./third-party/_libs.js";

function mod(a, b) { return (a % b + b) % b; }


/** Represents an edge between two adjacent hexes
 */
class Edge {
    /**
     * @param {Hex} hex The starting hex tile.
     * @param {number} direction 0 to 5 representing which neighbor we're referring to.
     */
    constructor(hex, direction) {
        // Edges are bidirectional so we canonicalize, from directions 3,4,5 to
        // directions 0,1,2 from the adjacent neighbor:
        // https://www.redblobgames.com/grids/parts/#hexagon-coordinates
        direction = mod(direction, 6);
        if (direction >= 3) {
            hex = hex.neighbor(direction);
            direction -= 3;
        }

        this.hex = hex;
        this.direction = direction;
    }

    /** key used when we want to store a Map() of these */
    toString() {
        return `edge:${this.hex}:dir:${this.direction}`;
    }
}


// from https://www.redblobgames.com/grids/hexagons/implementation.html#map-shapes
function createHexagonShapedMap(radius) {
    let results = new Set();
    for (let q = -radius; q <= radius; q++) {
        let r1 = Math.max(-radius, -q - radius);
        let r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            results.add(new Hex(q, r));
        }
    }
    return results;
}


// adapted from https://www.redblobgames.com/maps/mapgen2/
function biomeFor(elevation, moisture) {
    let ocean = elevation < 0.0;
    let temperature = 1.0 - elevation;
    if (ocean) {
        return 'OCEAN';
    } else if (temperature < 0.2) {
        if (moisture > 0.50) return 'SNOW';
        else if (moisture > 0.33) return 'TUNDRA';
        else if (moisture > 0.16) return 'BARE';
        else return 'SCORCHED';
    } else if (temperature < 0.4) {
        if (moisture > 0.66) return 'TAIGA';
        else if (moisture > 0.33) return 'SHRUBLAND';
        else return 'TEMPERATE_DESERT';
    } else if (temperature < 0.7) {
        if (moisture > 0.83) return 'TEMPERATE_RAIN_FOREST';
        else if (moisture > 0.50) return 'TEMPERATE_DECIDUOUS_FOREST';
        else if (moisture > 0.16) return 'GRASSLAND';
        else return 'TEMPERATE_DESERT';
    } else {
        if (moisture > 0.66) return 'TROPICAL_RAIN_FOREST';
        else if (moisture > 0.33) return 'TROPICAL_SEASONAL_FOREST';
        else if (moisture > 0.16) return 'GRASSLAND';
        else return 'SUBTROPICAL_DESERT';
    }
}

// Adapted from https://www.redblobgames.com/x/2226-roguelike-dev/
// JavaScript Map keys are compared by identity, but I want them
// compared by toString() value, so I have this version of Map.
class KeyMap extends Map {
    get(key)        { return super.get(key.toString()); }
    has(key)        { return super.has(key.toString()); }
    set(key, value) { return super.set(key.toString(), value); }
    delete(key)     { return super.delete(key.toString()); }
}

// Store the set of tiles and edges, and their information.
//
// Map information can be of one of four types:
//  1. region attributes (forest, desert, ocean, etc.)
//  2. point attributes (village, volcano, statue, fount, etc.)
//  3. line attributes on the border between hexes (river, coastline, boundary)
//  4. line attributes crossing between hexes (road, trade route, bridge)
//
// These correspond to four elements of geometric algebra in 2
// dimensions, although amitp is not entirely sure if this is
// coincidence or destiny. Geometric algebra has:
//  1. e12 : 2-dimensional, representing areas
//  2. 1   : 0-dimensional, representing points
//  3. e1  : 1-dimensional, representing lines
//  4. e2  : 1-dimensional, representing lines orthogonal to the first set
//
// And here too we have these four types of data. Using duality we can use
// just two data types (Tile and Edge) to represent the four geometry types.
class GameMap {
    /**
     * @param {Set<Hex>} hexes - the set of hexes in this map
     */
    constructor(radius) {
        /** @type{number} */
        this.radius = radius;
        /** @type{Set<Hex>} */
        this.hexes = createHexagonShapedMap(radius);
        /** @type{Set<Edge>} */
        this.edges = new Set();
        for (let hex of this.hexes) {
            for (let direction = 0; direction < 6; direction++) {
                this.edges.add(new Edge(hex, direction));
            }
        }

        /** @type{KeyMap<Hex, number>} */
        this.elevation = new KeyMap();
        /** @type{KeyMap<Hex, number>} */
        this.moisture = new KeyMap();
        /** @type{KeyMap<Hex, string>} */
        this.biome = new KeyMap();
        /** @type{KeyMap<Edge, boolean>} */
        this.coastline = new KeyMap();
    }

    generateElevations() {
        const scale = 1 / this.radius;
        let elevationNoise = createNoise2D();
        let moistureNoise = createNoise2D();
        let layout = new Layout(Layout.pointy, new Point(1, 1), new Point(0, 0));
        for (let hex of this.hexes) {
            let p = layout.hexToPixel(hex);
            let nx = p.x * scale,
                ny = p.y * scale;
            this.elevation.set(hex, elevationNoise(nx, ny));
            this.moisture.set(hex, moistureNoise(nx, ny));
        }
    }

    generateBiomes() {
        for (let hex of this.hexes) {
            this.biome.set(hex, biomeFor(this.elevation.get(hex), this.moisture.get(hex)));
        }
    }
}


// Drawing code
function drawHex(ctx, layout, hex, style={}) {
    let corners = layout.polygonCorners(hex);
    ctx.beginPath();
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";
    ctx.lineWidth = 1;
    Object.assign(ctx, style);
    ctx.moveTo(corners[5].x, corners[5].y);
    for (let direction = 0; direction < 6; direction++) {
        ctx.lineTo(corners[direction].x, corners[direction].y);
    }
    ctx.fill();
    ctx.stroke();
}

function drawEdge(ctx, layout, edge, style) {
}

// Biome colors
const discreteColors = {
    OCEAN: "#44447a",
    COAST: "#33335a",
    LAKESHORE: "#225588",
    LAKE: "#336699",
    RIVER: "#225588",
    MARSH: "#2f6666",
    ICE: "#99ffff",
    BEACH: "#a09077",
    SNOW: "#ffffff",
    TUNDRA: "#bbbbaa",
    BARE: "#888888",
    SCORCHED: "#555555",
    TAIGA: "#99aa77",
    SHRUBLAND: "#889977",
    TEMPERATE_DESERT: "#c9d29b",
    TEMPERATE_RAIN_FOREST: "#448855",
    TEMPERATE_DECIDUOUS_FOREST: "#679459",
    GRASSLAND: "#88aa55",
    SUBTROPICAL_DESERT: "#d2b98b",
    TROPICAL_RAIN_FOREST: "#337755",
    TROPICAL_SEASONAL_FOREST: "#559944",
};

// NOTE: could be merged into GameMap; just depends on your coding style
class Renderer {
    constructor(id, gameMap) {
        /** @type{HTMLCanvasElement} */
        this.canvas = document.getElementById(id);
        /** @type{GameMap} */
        this.gameMap = gameMap;
        /** @type{Layout} */
        this.layout = new Layout(
            Layout.pointy,
            new Point(this.canvas.width/gameMap.radius/3.6, this.canvas.height/gameMap.radius/3.6),
            new Point(this.canvas.width/2, this.canvas.height/2)
        );
    }

    render() {
        let ctx = this.canvas.getContext('2d');
        for (let hex of this.gameMap.hexes) {
            let color = discreteColors[this.gameMap.biome.get(hex)];
            drawHex(ctx, this.layout, hex, {fillStyle: color});
        }
    }
}

let gameMap = new GameMap(MAP_RADIUS);
gameMap.generateElevations();
gameMap.generateBiomes();
let renderer = new Renderer('output', gameMap);
renderer.render();
