class GameOfLife
{
    // What a random soup leaves behind after it settles, with rough relative
    // frequencies taken from the Catagolue census of B3/S23 soups.
    static ASH = [
        { weight: 100, rows: ["OO", "OO"] },
        { weight: 97, rows: ["OOO"] },
        { weight: 53, rows: [".OO.", "O..O", ".OO."] },
        { weight: 18, rows: [".OO.", "O..O", ".O.O", "..O."] },
        { weight: 17, rows: ["OO.", "O.O", ".O."] },
        { weight: 4, rows: ["OO.", "O.O", ".OO"] },
        { weight: 3, rows: [".O.", "O.O", ".O."] },
        { weight: 3, rows: [".OO.", "O..O", "O..O", ".OO."] },
        { weight: 2, rows: [".O..", "O.O.", ".O.O", "..OO"] },
        { weight: 1, rows: [".OOO", "OOO."] },
        { weight: 1, rows: ["OO..", "OO..", "..OO", "..OO"] }
    ];

    // Things that move: they wander through the ash and stir it up.
    static TRAVELLERS = [
        { weight: 20, rows: [".O.", "..O", "OOO"] },
        { weight: 1, rows: [".O..O", "O....", "O...O", "OOOO."] }
    ];

    // Small seeds that burn for hundreds or thousands of generations.
    static SPARKS = [
        { weight: 1, rows: [".OO", "OO.", ".O."] },
        { weight: 1, rows: [".O.....", "...O...", "OO..OOO"] },
        { weight: 1, rows: ["OOO", "O.O", "O.O"] },
        { weight: 1, rows: ["O.OO", "OOO.", ".O.."] }
    ];

    constructor(canvas, options = {})
    {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });

        this.cell_size = options.cell_size ?? 5;
        this.margin = options.margin ?? 24;
        this.step_ms = options.step_ms ?? 100;
        this.fade_ms = options.fade_ms ?? 300;

        // Cells per placed object; smaller means a denser field.
        this.ash_area = options.ash_area ?? 220;
        this.traveller_area = options.traveller_area ?? 2400;
        this.spark_area = options.spark_area ?? 9000;

        // Ash gathers in islands of roughly this many cells across, the way it
        // does where real soups burned out, instead of an even sprinkle.
        this.cluster_size = options.cluster_size ?? 40;
        this.cluster_floor = options.cluster_floor ?? 0.08;

        // A dying cell drops to decay_start of full brightness and then fades
        // out over `decay` generations. decay = 0 restores instant on/off.
        this.decay = options.decay ?? 4.5;
        this.decay_ms = this.decay * this.step_ms;
        this.decay_start = options.decay_start ?? 0.55;

        // Live cells in quiet areas dim towards activity_floor, while cells near
        // recent births and deaths stay bright, so settled ash recedes and
        // whatever is moving stands out. activity_floor = 1 turns this off.
        this.activity_floor = options.activity_floor ?? 0.42;
        this.activity_memory = options.activity_memory ?? 0.93;
        this.activity_radius = options.activity_radius ?? 4;
        this.activity_scale = 1 / (options.activity_norm ?? 6);

        const style = getComputedStyle(document.documentElement);
        const alive = GameOfLife.toRgb(style.getPropertyValue("--cell-alive"), "#808080");
        const dead = GameOfLife.toRgb(style.getPropertyValue("--cell-dead"), "#181818");
        this.palette = GameOfLife.buildPalette(dead, alive);
        this.dead_pixel = this.palette[0];
        this.alive_pixel = this.palette[255];
        this.dying_level = Math.round(255 * this.decay_start);

        this.brush = GameOfLife.buildBrush(options.brush_radius ?? 3);

        this.cols = 0;
        this.rows = 0;
        this.cells = null;
        this.next = null;
        this.levels = null;
        this.heat = null;
        this.heat_rows = null;
        this.stamps = null;
        this.image = null;
        this.pixels = null;

        this.seed = 0;
        this.seeding = false;
        this.reveal_at = 0;
        this.fading = false;
        this.decay_accumulator = 0;
        this.stroke = 0;
        this.pointer = -1;
        this.origin_x = 0;
        this.origin_y = 0;
        this.last_x = 0;
        this.last_y = 0;

        this.accumulator = 0;
        this.last_time = 0;
        this.dirty = true;
        this.resize_timer = 0;

        this.generations = 0;
        this.gps = 0;
        this.gps_window = 0;
        this.gps_time = 0;

        // Start hidden without animating, then enable the fade for the reveal.
        canvas.classList.add("is-hidden");
        getComputedStyle(canvas).opacity;
        canvas.style.transition = `opacity ${this.fade_ms}ms cubic-bezier(0.45, 0, 0.55, 1)`;

        this.resize();
        this.reset(options.seed);

        canvas.addEventListener("pointerdown", (event) => this.onDown(event));
        canvas.addEventListener("pointermove", (event) => this.onMove(event));
        canvas.addEventListener("pointerup", (event) => this.onUp(event));
        canvas.addEventListener("pointercancel", (event) => this.onUp(event));
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());

        window.addEventListener("resize", () =>
        {
            clearTimeout(this.resize_timer);
            this.resize_timer = setTimeout(() => this.resize(), 120);
        });
    }

    static toRgb(color, fallback)
    {
        let hex = color.trim() || fallback;
        if (hex.length === 4)
        {
            hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        const value = Number.parseInt(hex.slice(1), 16);
        return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
    }

    static buildPalette(from, to)
    {
        const palette = new Uint32Array(256);

        for (let level = 0; level < 256; level++)
        {
            const t = level / 255;
            const r = Math.round(from[0] + (to[0] - from[0]) * t);
            const g = Math.round(from[1] + (to[1] - from[1]) * t);
            const b = Math.round(from[2] + (to[2] - from[2]) * t);
            palette[level] = ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
        }

        return palette;
    }

    static buildBrush(radius)
    {
        const offsets = [];
        const limit = radius * radius + radius;

        for (let dy = -radius; dy <= radius; dy++)
        {
            for (let dx = -radius; dx <= radius; dx++)
            {
                if (dx * dx + dy * dy <= limit)
                {
                    offsets.push(dx, dy);
                }
            }
        }

        return Int8Array.from(offsets);
    }

    static hashString(text)
    {
        let hash = 0x811c9dc5;
        for (let i = 0; i < text.length; i++)
        {
            hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
        }

        return hash >>> 0;
    }

    static seedFromUrl()
    {
        const value = new URLSearchParams(window.location.search).get("seed");
        return value === null ? undefined : GameOfLife.hashString(value);
    }

    static random(seed)
    {
        let state = seed >>> 0;

        return () =>
        {
            state = (state + 0x6d2b79f5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    static pick(library, random)
    {
        let total = 0;
        for (const item of library)
        {
            total += item.weight;
        }

        let roll = random() * total;
        for (const item of library)
        {
            roll -= item.weight;
            if (roll < 0)
            {
                return item.rows;
            }
        }

        return library[library.length - 1].rows;
    }

    // Returns the live cells of a pattern in one of its 8 orientations.
    static orient(rows, orientation)
    {
        let width = rows[0].length;
        let height = rows.length;
        let points = [];

        for (let y = 0; y < height; y++)
        {
            for (let x = 0; x < width; x++)
            {
                if (rows[y][x] === "O")
                {
                    points.push([x, y]);
                }
            }
        }

        if (orientation & 4)
        {
            points = points.map(([x, y]) => [width - 1 - x, y]);
        }

        for (let turn = 0; turn < (orientation & 3); turn++)
        {
            points = points.map(([x, y]) => [height - 1 - y, x]);
            [width, height] = [height, width];
        }

        return { width, height, points };
    }

    get maxGps()
    {
        return 1000 / this.step_ms;
    }

    resize()
    {
        const visible_cols = Math.ceil(window.innerWidth / this.cell_size);
        const visible_rows = Math.ceil(window.innerHeight / this.cell_size);
        const cols = visible_cols + this.margin * 2;
        const rows = visible_rows + this.margin * 2;

        if (cols === this.cols && rows === this.rows)
        {
            return;
        }

        const cells = new Uint8Array(cols * rows);
        const levels = new Uint8Array(cols * rows);

        if (this.cells)
        {
            const copy_cols = Math.min(cols, this.cols) - 1;
            const copy_rows = Math.min(rows, this.rows) - 1;

            for (let y = 1; y < copy_rows; y++)
            {
                const from = y * this.cols;
                cells.set(this.cells.subarray(from + 1, from + copy_cols), y * cols + 1);
                levels.set(this.levels.subarray(from + 1, from + copy_cols), y * cols + 1);
            }
        }

        this.cols = cols;
        this.rows = rows;
        this.cells = cells;
        this.levels = levels;
        this.next = new Uint8Array(cols * rows);
        this.stamps = new Uint32Array(cols * rows);
        this.heat = new Float32Array(cols * rows);
        this.heat_rows = new Float32Array(cols * rows);
        this.stroke = 0;

        this.canvas.width = visible_cols;
        this.canvas.height = visible_rows;
        this.canvas.style.width = visible_cols * this.cell_size + "px";
        this.canvas.style.height = visible_rows * this.cell_size + "px";

        this.image = this.ctx.createImageData(cols, rows);
        this.pixels = new Uint32Array(this.image.data.buffer);
        this.fading = true;
        this.repaint();
    }

    // Builds a field that already looks settled: ash scattered with gaps so
    // the pieces don't touch, a few travellers, and a few long-burning sparks.
    // The left half is generated and mirrored onto the right half.
    populate(random)
    {
        const { cols, rows, cells } = this;
        const taken = new Uint8Array(cols * rows);
        const gap = 2;
        const edge = 2;

        const fits = (x, y, width, height) =>
        {
            const x0 = Math.max(0, x - gap);
            const y0 = Math.max(0, y - gap);
            const x1 = Math.min(cols, x + width + gap);
            const y1 = Math.min(rows, y + height + gap);

            for (let yy = y0; yy < y1; yy++)
            {
                for (let xx = x0; xx < x1; xx++)
                {
                    if (taken[yy * cols + xx])
                    {
                        return false;
                    }
                }
            }

            return true;
        };

        const scale = this.cluster_size;
        const grid_cols = Math.ceil(cols / scale) + 2;
        const grid_rows = Math.ceil(rows / scale) + 2;
        const grid = new Float32Array(grid_cols * grid_rows);
        for (let i = 0; i < grid.length; i++)
        {
            grid[i] = random();
        }

        const smooth = (t) => t * t * (3 - 2 * t);

        // Smooth value noise in [0, 1] mapped to a placement chance.
        const chance = (x, y) =>
        {
            const fx = x / scale;
            const fy = y / scale;
            const ix = Math.floor(fx);
            const iy = Math.floor(fy);
            const tx = smooth(fx - ix);
            const ty = smooth(fy - iy);
            const i = iy * grid_cols + ix;

            const top = grid[i] + (grid[i + 1] - grid[i]) * tx;
            const bottom = grid[i + grid_cols] + (grid[i + grid_cols + 1] - grid[i + grid_cols]) * tx;
            const value = top + (bottom - top) * ty;

            const t = Math.min(Math.max((value - 0.4) / 0.35, 0), 1);
            return this.cluster_floor + (1 - this.cluster_floor) * smooth(t);
        };

        const claim = (x, y, width, height) =>
        {
            for (let yy = y; yy < y + height; yy++)
            {
                taken.fill(1, yy * cols + x, yy * cols + x + width);
            }
        };

        const place = (library, area, clustered) =>
        {
            const count = Math.round(cols * rows / area / 2);
            const tries = count * (clustered ? 40 : 8);
            let placed = 0;

            for (let attempt = 0; attempt < tries && placed < count; attempt++)
            {
                const shape = GameOfLife.orient(GameOfLife.pick(library, random), Math.floor(random() * 8));
                const { width, height, points } = shape;

                const max_x = (cols >> 1) - width - 1;
                const max_y = rows - height - edge;
                if (max_x <= edge || max_y <= edge)
                {
                    return;
                }

                const x = edge + Math.floor(random() * (max_x - edge));
                const y = edge + Math.floor(random() * (max_y - edge));
                const mirror_x = cols - x - width;

                if (clustered && random() > chance(x + width / 2, y + height / 2))
                {
                    continue;
                }

                if (!fits(x, y, width, height) || !fits(mirror_x, y, width, height))
                {
                    continue;
                }

                claim(x, y, width, height);
                claim(mirror_x, y, width, height);

                for (const [px, py] of points)
                {
                    const row = (y + py) * cols;
                    cells[row + x + px] = 1;
                    cells[row + cols - 1 - (x + px)] = 1;
                }

                placed++;
            }
        };

        place(GameOfLife.SPARKS, this.spark_area, true);
        place(GameOfLife.TRAVELLERS, this.traveller_area, false);
        place(GameOfLife.ASH, this.ash_area, true);
    }

    reset(seed)
    {
        this.seed = seed ?? (Math.random() * 4294967296) >>> 0;

        this.cells.fill(0);
        this.heat.fill(0);
        this.populate(GameOfLife.random(this.seed));

        const hidden = this.canvas.classList.contains("is-hidden");
        this.reveal_at = performance.now() + (hidden ? 0 : this.fade_ms);
        this.seeding = true;
        this.pointer = -1;
        this.canvas.classList.add("is-hidden");

        // Commit the hidden state now, so revealing on the next frame plays the
        // fade-in even on first load.
        getComputedStyle(this.canvas).opacity;
    }

    reveal(time)
    {
        if (time < this.reveal_at)
        {
            return;
        }

        this.seeding = false;
        this.accumulator = 0;
        this.gps = 0;
        this.gps_window = 0;
        this.gps_time = 0;

        const { cells, levels } = this;
        for (let i = 0; i < cells.length; i++)
        {
            levels[i] = cells[i] ? 255 : 0;
        }

        this.updateActivity();
        this.repaint();
        this.canvas.classList.remove("is-hidden");
    }

    repaint()
    {
        const { cells, levels, pixels, palette } = this;

        for (let i = 0; i < cells.length; i++)
        {
            pixels[i] = palette[levels[i]];
        }

        this.dirty = true;
    }

    // Marks a cell that just changed state and updates its pixel.
    setLevel(i, state)
    {
        if (state)
        {
            this.levels[i] = 255;
            this.pixels[i] = this.alive_pixel;
        }
        else if (this.decay_ms > 0)
        {
            const level = Math.round(this.levels[i] * this.decay_start);
            this.levels[i] = level;
            this.pixels[i] = this.palette[level];
            this.fading = true;
        }
        else
        {
            this.levels[i] = 0;
            this.pixels[i] = this.dead_pixel;
        }
    }

    step()
    {
        const { cols, rows, cells, next, heat } = this;
        const memory = this.activity_memory;

        for (let y = 1; y < rows - 1; y++)
        {
            let i = y * cols + 1;
            let up = i - cols;
            let down = i + cols;
            const end = i + cols - 2;

            let left = cells[up - 1] + cells[i - 1] + cells[down - 1];
            let middle = cells[up] + cells[i] + cells[down];

            for (; i < end; i++, up++, down++)
            {
                const right = cells[up + 1] + cells[i + 1] + cells[down + 1];
                const current = cells[i];
                const neighbors = left + middle + right - current;
                const state = (neighbors | current) === 3 ? 1 : 0;

                next[i] = state;
                if (state !== current)
                {
                    heat[i] = heat[i] * memory + 1;
                    this.setLevel(i, state);
                }
                else
                {
                    heat[i] *= memory;
                }

                left = middle;
                middle = right;
            }
        }

        this.cells = next;
        this.next = cells;
        this.updateActivity();
        this.dirty = true;
        this.generations++;
        this.gps_window++;
    }

    // Sets the brightness of every live cell from the recent births and deaths
    // around it: a box sum of heat over (2r + 1)^2 cells, done in two passes.
    updateActivity()
    {
        if (this.activity_floor >= 1)
        {
            return;
        }

        const { cols, rows, cells, heat, heat_rows, levels, pixels, palette } = this;
        const radius = this.activity_radius;
        const scale = this.activity_scale;
        const base = 255 * this.activity_floor;
        const span = 255 - base;

        for (let y = 0; y < rows; y++)
        {
            const row = y * cols;
            let sum = 0;

            for (let x = 0; x <= radius && x < cols; x++)
            {
                sum += heat[row + x];
            }

            for (let x = 0; x < cols; x++)
            {
                heat_rows[row + x] = sum;

                if (x + radius + 1 < cols)
                {
                    sum += heat[row + x + radius + 1];
                }

                if (x - radius >= 0)
                {
                    sum -= heat[row + x - radius];
                }
            }
        }

        for (let x = 0; x < cols; x++)
        {
            let sum = 0;

            for (let y = 0; y <= radius && y < rows; y++)
            {
                sum += heat_rows[y * cols + x];
            }

            for (let y = 0; y < rows; y++)
            {
                const i = y * cols + x;

                if (cells[i])
                {
                    const activity = Math.min(Math.max(sum * scale, 0), 1);
                    const level = Math.round(base + span * activity);
                    levels[i] = level;
                    pixels[i] = palette[level];
                }

                if (y + radius + 1 < rows)
                {
                    sum += heat_rows[(y + radius + 1) * cols + x];
                }

                if (y - radius >= 0)
                {
                    sum -= heat_rows[(y - radius) * cols + x];
                }
            }
        }
    }

    decayCells(elapsed)
    {
        if (!this.fading || this.decay_ms <= 0)
        {
            return;
        }

        this.decay_accumulator += elapsed * this.dying_level / this.decay_ms;
        const amount = Math.floor(this.decay_accumulator);
        if (amount === 0)
        {
            return;
        }

        this.decay_accumulator -= amount;

        const { cells, levels, pixels, palette } = this;
        let fading = false;

        for (let i = 0; i < cells.length; i++)
        {
            const level = levels[i];
            if (level === 0 || cells[i])
            {
                continue;
            }

            const next = level > amount ? level - amount : 0;
            levels[i] = next;
            pixels[i] = palette[next];
            fading = true;
        }

        this.fading = fading;
        this.dirty = true;
    }

    paint(cx, cy)
    {
        const { cols, rows, brush, cells, stamps, stroke } = this;

        for (let k = 0; k < brush.length; k += 2)
        {
            const x = cx + brush[k];
            const y = cy + brush[k + 1];

            if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1)
            {
                continue;
            }

            const i = y * cols + x;
            if (stamps[i] === stroke)
            {
                continue;
            }

            stamps[i] = stroke;

            const state = cells[i] ^ 1;
            cells[i] = state;
            this.heat[i] += 1;
            this.setLevel(i, state);
        }

        this.dirty = true;
    }

    lineTo(x, y)
    {
        const dx = x - this.last_x;
        const dy = y - this.last_y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        for (let s = 1; s <= steps; s++)
        {
            this.paint(this.last_x + Math.round(dx * s / steps), this.last_y + Math.round(dy * s / steps));
        }

        this.last_x = x;
        this.last_y = y;
    }

    cellX(event)
    {
        return Math.floor((event.clientX - this.origin_x) / this.cell_size) + this.margin;
    }

    cellY(event)
    {
        return Math.floor((event.clientY - this.origin_y) / this.cell_size) + this.margin;
    }

    onDown(event)
    {
        if (this.seeding || this.pointer !== -1 || event.button !== 0)
        {
            return;
        }

        event.preventDefault();

        this.pointer = event.pointerId;
        this.canvas.setPointerCapture(event.pointerId);

        const rect = this.canvas.getBoundingClientRect();
        this.origin_x = rect.left;
        this.origin_y = rect.top;

        this.stroke++;
        this.last_x = this.cellX(event);
        this.last_y = this.cellY(event);
        this.paint(this.last_x, this.last_y);
    }

    onMove(event)
    {
        if (event.pointerId === this.pointer)
        {
            this.lineTo(this.cellX(event), this.cellY(event));
        }
    }

    onUp(event)
    {
        if (event.pointerId !== this.pointer)
        {
            return;
        }

        if (this.canvas.hasPointerCapture(event.pointerId))
        {
            this.canvas.releasePointerCapture(event.pointerId);
        }

        this.pointer = -1;
    }

    sampleGps(time)
    {
        if (this.gps_time === 0)
        {
            this.gps_time = time;
            return;
        }

        const elapsed = time - this.gps_time;

        if (elapsed > 2000)
        {
            this.gps_window = 0;
            this.gps_time = time;
            return;
        }

        if (elapsed >= 250)
        {
            const sample = Math.min(this.gps_window * 1000 / elapsed, this.maxGps);
            this.gps = this.gps === 0 ? sample : this.gps * 0.6 + sample * 0.4;
            this.gps_window = 0;
            this.gps_time = time;
        }
    }

    frame = (time) =>
    {
        const elapsed = this.last_time ? Math.min(time - this.last_time, this.step_ms) : 0;
        this.last_time = time;
        this.accumulator += elapsed;

        if (this.seeding)
        {
            this.reveal(time);
        }
        else
        {
            if (this.accumulator >= this.step_ms)
            {
                this.accumulator -= this.step_ms;
                this.step();
            }

            this.decayCells(elapsed);
        }

        if (this.dirty && !this.seeding)
        {
            this.ctx.putImageData(this.image, -this.margin, -this.margin);
            this.dirty = false;
        }

        if (!this.seeding)
        {
            this.sampleGps(time);
        }

        requestAnimationFrame(this.frame);
    };

    start()
    {
        requestAnimationFrame(this.frame);
    }
}
