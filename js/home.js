const life = new GameOfLife(document.getElementById("life"), {
    step_ms: 100,
    decay: decayFromUrl(),
    activity_floor: new URLSearchParams(window.location.search).get("activity") === "0" ? 1 : undefined,
    seed: GameOfLife.seedFromUrl()
});

life.start();

function restart()
{
    life.reset();
}

// ?decay=N overrides how many generations a dead cell takes to fade out;
// without it the default from life.js is used.
function decayFromUrl()
{
    const value = Number.parseFloat(new URLSearchParams(window.location.search).get("decay"));
    return Number.isFinite(value) && value >= 0 ? value : undefined;
}

const logo = document.getElementById("logo");
logo.addEventListener("click", restart);

// Breaks the logo's octagon edge into cells aligned with the field grid.
// The dissolve band narrows towards the bottom, so the lower edge stays whole.
function maskLogo()
{
    const rect = logo.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0)
    {
        return;
    }

    const cell = life.cell_size;
    const band = cell * 9;
    const ratio = window.devicePixelRatio || 1;
    const size = Math.min(rect.width, rect.height);
    const cut = size / (2 + Math.SQRT2);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";

    // Cells are filled on whole device pixels so neighbours meet without seams.
    const fill = (x, y, width, height) =>
    {
        const x0 = Math.round(x * ratio);
        const y0 = Math.round(y * ratio);
        ctx.fillRect(x0, y0, Math.round((x + width) * ratio) - x0, Math.round((y + height) * ratio) - y0);
    };

    const edge = (x, y) =>
    {
        const right = rect.width - x;
        const bottom = rect.height - y;

        return Math.min(
            x, right, y, bottom,
            (x + y - cut) / Math.SQRT2,
            (right + y - cut) / Math.SQRT2,
            (x + bottom - cut) / Math.SQRT2,
            (right + bottom - cut) / Math.SQRT2
        );
    };

    const start_x = Math.floor(rect.left / cell) * cell - rect.left;
    const start_y = Math.floor(rect.top / cell) * cell - rect.top;

    for (let y = start_y; y < rect.height; y += cell)
    {
        const depth = (y + cell / 2) / rect.height;
        const width = band * Math.min(Math.max((0.85 - depth) / 0.3, 0), 1);

        if (width < cell)
        {
            fill(0, y, rect.width, cell);
            continue;
        }

        for (let x = start_x; x < rect.width; x += cell)
        {
            const distance = edge(x + cell / 2, y + cell / 2);
            if (distance <= 0)
            {
                continue;
            }

            let keep = 1;
            if (distance < width)
            {
                const t = distance / width;
                keep = t * t * (3 - 2 * t) + 0.04;
            }

            const gx = Math.round((rect.left + x) / cell);
            const gy = Math.round((rect.top + y) / cell);
            if (keep >= 1 || cellHash(gx, gy) < keep)
            {
                fill(x, y, cell, cell);
            }
        }
    }

    const url = `url(${canvas.toDataURL()})`;
    logo.style.webkitMaskImage = url;
    logo.style.maskImage = url;

    castShadow(canvas, rect, ratio);
}

// Bakes the logo's shadow into a static image once. A CSS drop-shadow would
// be re-blurred on every frame of the animated gif.
const shadow = document.createElement("div");
shadow.className = "logo-shadow";
shadow.setAttribute("aria-hidden", "true");
document.querySelector(".stage").before(shadow);

function castShadow(mask, rect, ratio)
{
    const blur = 24;
    const offset = 16;
    const pad = blur * 2 + offset;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round((rect.width + pad * 2) * ratio);
    canvas.height = Math.round((rect.height + pad * 2) * ratio);

    // The mask is solid across the whole lower part, so cut it to the
    // octagon first; the gif's own corners are transparent.
    const shape = document.createElement("canvas");
    shape.width = mask.width;
    shape.height = mask.height;

    const cut = Math.min(shape.width, shape.height) / (2 + Math.SQRT2);
    const w = shape.width;
    const h = shape.height;
    const outline = shape.getContext("2d");
    outline.beginPath();
    outline.moveTo(cut, 0);
    outline.lineTo(w - cut, 0);
    outline.lineTo(w, cut);
    outline.lineTo(w, h - cut);
    outline.lineTo(w - cut, h);
    outline.lineTo(cut, h);
    outline.lineTo(0, h - cut);
    outline.lineTo(0, cut);
    outline.closePath();
    outline.fill();
    outline.globalCompositeOperation = "destination-in";
    outline.drawImage(mask, 0, 0);

    // Draw the shape outside the canvas and let only its shadow fall inside.
    const ctx = canvas.getContext("2d");
    const away = canvas.width + shape.width;
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = blur * ratio;
    ctx.shadowOffsetX = away;
    ctx.shadowOffsetY = offset * ratio;
    ctx.drawImage(shape, pad * ratio - away, pad * ratio);

    shadow.style.left = `${rect.left - pad}px`;
    shadow.style.top = `${rect.top - pad}px`;
    shadow.style.width = `${rect.width + pad * 2}px`;
    shadow.style.height = `${rect.height + pad * 2}px`;
    shadow.style.backgroundImage = `url(${canvas.toDataURL()})`;
}

// Stable pseudo-random value in [0, 1) for a grid cell.
function cellHash(x, y)
{
    let hash = 0x9e3779b9 ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
    hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
    hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

let mask_timer = 0;
window.addEventListener("resize", () =>
{
    clearTimeout(mask_timer);
    mask_timer = setTimeout(maskLogo, 120);
});

if (logo.complete)
{
    maskLogo();
}
else
{
    logo.addEventListener("load", maskLogo, { once: true });
}

// The header can change height once the web font arrives, moving the logo.
document.fonts?.ready.then(maskLogo);

// On the home page the brand link restarts the field instead of reloading.
document.querySelector(".brand")?.addEventListener("click", (event) =>
{
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    {
        return;
    }

    event.preventDefault();
    restart();
});

class GpsMeter
{
    constructor(life)
    {
        this.life = life;
        this.collapsed = false;

        this.element = document.createElement("div");
        this.element.className = "meter";

        this.toggle = document.createElement("button");
        this.toggle.type = "button";
        this.toggle.className = "meter-toggle";
        this.toggle.setAttribute("aria-label", "toggle status panel");

        this.details = document.createElement("div");
        this.details.className = "meter-details";

        this.views = this.addRow("views");
        this.value = this.addRow("gen/s");
        this.views.classList.add("views-value");

        this.element.append(this.toggle, this.details);
        document.body.append(this.element);

        this.toggle.addEventListener("click", () => this.setCollapsed(!this.collapsed));

        this.render();
        requestAnimationFrame(this.tick);
    }

    addRow(label)
    {
        const row = document.createElement("div");
        row.className = "meter-row";

        const name = document.createElement("span");
        name.className = "meter-label";
        name.textContent = label;

        const value = document.createElement("span");
        value.className = "meter-value";
        value.textContent = "—";

        row.append(name, value);
        this.details.append(row);
        return value;
    }

    setCollapsed(collapsed)
    {
        this.collapsed = collapsed;
        this.element.classList.toggle("is-collapsed", collapsed);
    }

    render()
    {
        const max = this.life.maxGps;
        const gps = Math.max(0, Math.min(this.life.gps, max));
        const ratio = max > 0 ? gps / max : 0;
        const hue = Math.round(6 + ratio * 114);
        const max_text = max.toFixed(2);
        const gps_text = gps.toFixed(2).padStart(max_text.length, "0");

        // Touch the DOM only when something visible changed.
        this.setText(this.value, `${gps_text}/${max_text}`);
        this.setText(this.toggle, this.collapsed ? "+" : "−");

        const color = `hsl(${hue}, 55%, 70%)`;
        if (this.value.dataset.color !== color)
        {
            this.value.dataset.color = color;
            this.value.style.color = color;
        }
    }

    setText(element, text)
    {
        if (element.textContent !== text)
        {
            element.textContent = text;
        }
    }

    tick = () =>
    {
        this.render();
        requestAnimationFrame(this.tick);
    };
}

new GpsMeter(life);

function loadViewCount()
{
    const element = document.querySelector(".views-value");
    if (!element)
    {
        return;
    }

    const endpoint = "https://prefect.goatcounter.com/counter/TOTAL.json";

    const update = async () =>
    {
        try
        {
            const response = await fetch(`${endpoint}?t=${Date.now()}`, { cache: "no-store" });
            if (!response.ok)
            {
                return;
            }

            const data = await response.json();
            const raw = data.count ?? data.count_unique;
            const digits = String(raw ?? "").replace(/\D/g, "");
            if (!digits)
            {
                return;
            }

            element.textContent = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
        }
        catch
        {
            // Keep the last successful value and retry later.
        }
    };

    update();
    setInterval(update, 5 * 60 * 1000);
}

loadViewCount();
