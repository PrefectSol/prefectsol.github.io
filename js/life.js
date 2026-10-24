class GameOfLife
{
    constructor(canvas, options = {})
    {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d", { alpha: false });

        this.cell_size = options.cell_size ?? 5;
        this.margin = options.margin ?? 24;
        this.density = options.density ?? 0.2;
        this.step_ms = options.step_ms ?? 100;
        this.warmup_min = options.warmup_min ?? 5;
        this.warmup_max = options.warmup_max ?? 500;
        this.budget_ms = options.budget_ms ?? 8;
        this.fade_ms = options.fade_ms ?? 300;

        const style = getComputedStyle(document.documentElement);
        this.alive_pixel = GameOfLife.toPixel(style.getPropertyValue("--cell-alive"), "#808080");
        this.dead_pixel = GameOfLife.toPixel(style.getPropertyValue("--cell-dead"), "#181818");

        this.brush = GameOfLife.buildBrush(options.brush_radius ?? 3);

        this.cols = 0;
        this.rows = 0;
        this.cells = null;
        this.next = null;
        this.stamps = null;
        this.image = null;
        this.pixels = null;

        this.seed = 0;
        this.warmup = 0;
        this.pending = 0;
        this.seeding = false;
        this.reveal_at = 0;
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

        canvas.style.transition = `opacity ${this.fade_ms}ms ease-out`;
        canvas.classList.add("is-hidden");

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

    static toPixel(color, fallback)
    {
        let hex = color.trim() || fallback;
        if (hex.length === 4)
        {
            hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        const value = Number.parseInt(hex.slice(1), 16);
        const r = (value >> 16) & 0xff;
        const g = (value >> 8) & 0xff;
        const b = value & 0xff;

        return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
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

    static noise(seed, x, y)
    {
        let hash = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
        hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
        hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);

        return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
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

        if (this.cells)
        {
            const copy_cols = Math.min(cols, this.cols) - 1;
            const copy_rows = Math.min(rows, this.rows) - 1;

            for (let y = 1; y < copy_rows; y++)
            {
                const from = y * this.cols;
                cells.set(this.cells.subarray(from + 1, from + copy_cols), y * cols + 1);
            }
        }

        this.cols = cols;
        this.rows = rows;
        this.cells = cells;
        this.next = new Uint8Array(cols * rows);
        this.stamps = new Uint32Array(cols * rows);
        this.stroke = 0;

        this.canvas.width = visible_cols;
        this.canvas.height = visible_rows;
        this.canvas.style.width = visible_cols * this.cell_size + "px";
        this.canvas.style.height = visible_rows * this.cell_size + "px";

        this.image = this.ctx.createImageData(cols, rows);
        this.pixels = new Uint32Array(this.image.data.buffer);
        this.repaint();
    }

    reset(seed)
    {
        this.seed = seed ?? (Math.random() * 4294967296) >>> 0;

        const { cols, rows, cells, density } = this;
        const half = cols >> 1;

        for (let y = 1; y < rows - 1; y++)
        {
            const row = y * cols;
            for (let x = 1; x < half; x++)
            {
                const state = GameOfLife.noise(this.seed, x, y) < density ? 1 : 0;
                cells[row + x] = state;
                cells[row + cols - 1 - x] = state;
            }

            if (cols & 1)
            {
                cells[row + half] = GameOfLife.noise(this.seed, half, y) < density ? 1 : 0;
            }
        }

        const span = this.warmup_max - this.warmup_min + 1;
        this.warmup = this.warmup_min + Math.floor(GameOfLife.noise(this.seed, -1, -1) * span);
        this.pending = this.warmup;

        const hidden = this.canvas.classList.contains("is-hidden");
        this.reveal_at = performance.now() + (hidden ? 0 : this.fade_ms);
        this.seeding = true;
        this.pointer = -1;
        this.canvas.classList.add("is-hidden");
    }

    advance(time)
    {
        const deadline = performance.now() + this.budget_ms;

        while (this.pending > 0 && performance.now() < deadline)
        {
            this.step();
            this.pending--;
        }

        if (this.pending > 0 || time < this.reveal_at)
        {
            return;
        }

        this.seeding = false;
        this.accumulator = 0;
        this.gps = 0;
        this.gps_window = 0;
        this.gps_time = 0;
        this.repaint();
        this.canvas.classList.remove("is-hidden");
    }

    repaint()
    {
        const { cells, pixels, alive_pixel, dead_pixel } = this;

        for (let i = 0; i < cells.length; i++)
        {
            pixels[i] = cells[i] ? alive_pixel : dead_pixel;
        }

        this.dirty = true;
    }

    step()
    {
        const { cols, rows, cells, next, pixels, alive_pixel, dead_pixel } = this;

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
                    pixels[i] = state ? alive_pixel : dead_pixel;
                }

                left = middle;
                middle = right;
            }
        }

        this.cells = next;
        this.next = cells;
        this.dirty = true;
        this.generations++;
        this.gps_window++;
    }

    paint(cx, cy)
    {
        const { cols, rows, brush, cells, pixels, stamps, stroke, alive_pixel, dead_pixel } = this;

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
            pixels[i] = state ? alive_pixel : dead_pixel;
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
        if (this.last_time)
        {
            this.accumulator += Math.min(time - this.last_time, this.step_ms);
        }

        this.last_time = time;

        if (this.seeding)
        {
            this.advance(time);
        }
        else if (this.accumulator >= this.step_ms)
        {
            this.accumulator -= this.step_ms;
            this.step();
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
