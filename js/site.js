const LAST_EDIT = "2026-10-23";

const NAVIGATION = [
    { page: "portfolio", href: "portfolio.html", label: "portfolio" },
    { page: "about", href: "about.html", label: "about me" },
    { page: "contacts", href: "contacts.html", label: "contacts" }
];

function buildHeader()
{
    const header = document.querySelector(".header");
    if (!header)
    {
        return;
    }

    const current = document.body.dataset.page;
    const links = NAVIGATION.map((item) =>
    {
        const active = item.page === current ? ` aria-current="page"` : "";
        return `<a class="button" href="${item.href}"${active}>${item.label}</a>`;
    }).join("");

    header.innerHTML =
        `<a class="brand" href="index.html">Prefect (Maxim)<span class="brand-tail"> | Just a programmer</span></a>` +
        `<nav class="nav">${links}</nav>`;
}

const DECOR_CELL = 6;

const PATTERNS = {
    gun: [
        "........................O...........",
        "......................O.O...........",
        "............OO......OO............OO",
        "...........O...O....OO............OO",
        "OO........O.....O...OO..............",
        "OO........O...O.OO....O.O...........",
        "..........O.....O.......O...........",
        "...........O...O....................",
        "............OO......................"
    ],
    pulsar: [
        "..OOO...OOO..",
        ".............",
        "O....O.O....O",
        "O....O.O....O",
        "O....O.O....O",
        "..OOO...OOO..",
        ".............",
        "..OOO...OOO..",
        "O....O.O....O",
        "O....O.O....O",
        "O....O.O....O",
        ".............",
        "..OOO...OOO.."
    ],
    glider: [".O.", "..O", "OOO"],
    lwss: [".O..O", "O....", "O...O", "OOOO."],
    mwss: ["...O..", ".O...O", "O.....", "O....O", "OOOOO."],
    hwss: ["...OO..", ".O....O", "O......", "O.....O", "OOOOOO."],
    pentadecathlon: ["..O....O..", "OO.OOOO.OO", "..O....O.."],
    acorn: [".O.....", "...O...", "OO..OOO"],
    tub: [".O.", "O.O", ".O."],
    ship: ["OO.", "O.O", ".OO"],
    blinker: ["OOO"],
    toad: [".OOO", "OOO."],
    beacon: ["OO..", "OO..", "..OO", "..OO"],
    beehive: [".OO.", "O..O", ".OO."],
    loaf: [".OO.", "O..O", ".O.O", "..O."],
    boat: ["OO.", "O.O", ".O."],
    block: ["OO", "OO"]
};

const DECOR = {
    portfolio: [
        { pattern: "gun", phase: 96, flip: "x", right: 8, top: 18 },
        { pattern: "glider", phase: 1, flip: "x", right: 54, top: 51 },
        { pattern: "lwss", phase: 2, right: 22, top: 70 },
        { pattern: "toad", phase: 1, right: 46, top: 94 },
        { pattern: "beacon", phase: 1, right: 14, top: 104 },
        { pattern: "boat", left: 120, bottom: 16 },
        { pattern: "tub", right: 60, top: 80 },
        { pattern: "hwss", phase: 1, right: 30, top: 112 },
        { pattern: "pentadecathlon", phase: 4, left: 70, bottom: 13 },
        { pattern: "acorn", phase: 2, left: 160, bottom: 10 },
        { pattern: "ship", right: 8, top: 140 },
        { pattern: "glider", phase: 3, flip: "x", right: -1, top: 84, edge: true },
        { pattern: "lwss", left: -2, bottom: 8, edge: true }
    ],
    about: [
        { pattern: "glider", phase: 2, flip: "x", right: 40, top: 22 },
        { pattern: "blinker", phase: 1, right: 20, top: 30 },
        { pattern: "pulsar", phase: 1, right: 32, top: 46 },
        { pattern: "beehive", right: 12, top: 62 },
        { pattern: "loaf", right: 58, top: 72 },
        { pattern: "pentadecathlon", phase: 7, right: 16, top: 84 },
        { pattern: "ship", right: 70, top: 40 },
        { pattern: "acorn", right: 44, top: 96 },
        { pattern: "tub", right: 8, top: 44 },
        { pattern: "mwss", phase: 1, right: -4, top: 150, edge: true },
        { pattern: "hwss", phase: 2, right: -5, top: 30, edge: true },
        { pattern: "boat", left: -1, bottom: 6, edge: true }
    ],
    contacts: [
        { pattern: "lwss", right: 34, top: 30 },
        { pattern: "mwss", right: 16, top: 44 },
        { pattern: "glider", phase: 1, flip: "x", right: 66, top: 22 },
        { pattern: "hwss", phase: 2, right: 52, top: 58 },
        { pattern: "pulsar", phase: 2, right: 24, top: 80 },
        { pattern: "blinker", right: 62, top: 96 },
        { pattern: "beacon", left: 110, bottom: 20 },
        { pattern: "ship", left: 60, bottom: 32 },
        { pattern: "tub", left: 150, bottom: 40 },
        { pattern: "lwss", right: -3, top: 62, edge: true },
        { pattern: "glider", left: -1, bottom: 6, edge: true }
    ]
};

function evolve(rows, generations)
{
    const pad = Math.ceil(generations / 2) + 2;
    const width = rows[0].length + pad * 2;
    const height = rows.length + pad * 2;

    let cells = new Uint8Array(width * height);
    let next = new Uint8Array(width * height);

    for (let y = 0; y < rows.length; y++)
    {
        for (let x = 0; x < rows[y].length; x++)
        {
            cells[(y + pad) * width + x + pad] = rows[y][x] === "O" ? 1 : 0;
        }
    }

    for (let g = 0; g < generations; g++)
    {
        for (let y = 1; y < height - 1; y++)
        {
            for (let x = 1; x < width - 1; x++)
            {
                const i = y * width + x;
                const neighbors =
                    cells[i - width - 1] + cells[i - width] + cells[i - width + 1] +
                    cells[i - 1] + cells[i + 1] +
                    cells[i + width - 1] + cells[i + width] + cells[i + width + 1];

                next[i] = (neighbors | cells[i]) === 3 ? 1 : 0;
            }
        }

        [cells, next] = [next, cells];
    }

    let top = height;
    let bottom = -1;
    let left = width;
    let right = -1;

    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            if (cells[y * width + x])
            {
                top = Math.min(top, y);
                bottom = Math.max(bottom, y);
                left = Math.min(left, x);
                right = Math.max(right, x);
            }
        }
    }

    const result = [];
    for (let y = top; y <= bottom; y++)
    {
        let row = "";
        for (let x = left; x <= right; x++)
        {
            row += cells[y * width + x] ? "O" : ".";
        }

        result.push(row);
    }

    return result;
}

function flip(rows, axis)
{
    if (axis === "x")
    {
        return rows.map((row) => [...row].reverse().join(""));
    }

    if (axis === "y")
    {
        return [...rows].reverse();
    }

    return rows;
}

function buildPattern(rows)
{
    const width = rows[0].length;
    const height = rows.length;
    let path = "";

    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            if (rows[y][x] === "O")
            {
                path += `M${x} ${y}h1v1h-1z`;
            }
        }
    }

    return `<svg viewBox="0 0 ${width} ${height}" width="${width * DECOR_CELL}" height="${height * DECOR_CELL}" shape-rendering="crispEdges"><path d="${path}"/></svg>`;
}

function buildDecor()
{
    const items = DECOR[document.body.dataset.page];
    if (!items)
    {
        return;
    }

    const layer = document.createElement("div");
    layer.className = "decor";
    layer.setAttribute("aria-hidden", "true");

    layer.innerHTML = items.map((item) =>
    {
        const style = ["left", "right", "top", "bottom"]
            .filter((side) => side in item)
            .map((side) => `${side}: ${item[side] * DECOR_CELL}px`)
            .join("; ");

        const edge = item.edge ? " is-edge" : "";
        const rows = flip(evolve(PATTERNS[item.pattern], item.phase ?? 0), item.flip);
        return `<div class="decor-item${edge}" style="${style}">${buildPattern(rows)}</div>`;
    }).join("");

    document.body.prepend(layer);
}

function buildFooter()
{
    if (document.body.dataset.page === "home")
    {
        return;
    }

    const footer = document.createElement("footer");
    footer.className = "footer";
    footer.innerHTML = `last edit: <time datetime="${LAST_EDIT}">${LAST_EDIT}</time>`;
    document.body.append(footer);
}

class Toast
{
    constructor()
    {
        this.element = document.createElement("div");
        this.element.className = "toast";
        this.element.setAttribute("role", "status");
        this.element.setAttribute("aria-live", "polite");
        document.body.append(this.element);

        this.duration_ms = 800;
        this.timer = 0;
    }

    show(text)
    {
        this.element.textContent = text;
        this.element.classList.add("is-visible");

        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.element.classList.remove("is-visible"), this.duration_ms);
    }
}

async function copyText(text)
{
    try
    {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch
    {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();

        const copied = document.execCommand("copy");
        area.remove();
        return copied;
    }
}

function bindCopyButtons()
{
    const buttons = document.querySelectorAll("[data-copy]");
    if (buttons.length === 0)
    {
        return;
    }

    const toast = new Toast();

    for (const button of buttons)
    {
        button.addEventListener("click", async () =>
        {
            const copied = await copyText(button.dataset.copy);
            toast.show(copied ? "copied to clipboard" : "failed to copy");
        });
    }
}

class CursorFollower
{
    constructor()
    {
        this.element = document.createElement("div");
        this.element.className = "follower is-hidden";
        this.element.setAttribute("aria-hidden", "true");
        document.body.append(this.element);

        this.sharpness = 30;
        this.press_scale = 0.7;
        this.hover_scale = 0;

        this.x = 0;
        this.y = 0;
        this.scale = 1;
        this.target_x = 0;
        this.target_y = 0;
        this.target_scale = 1;
        this.visible = false;
        this.pressed = false;
        this.hovered = false;
        this.frame = 0;
        this.last_time = 0;

        document.addEventListener("pointermove", (event) => this.onMove(event), { passive: true });
        document.addEventListener("pointerdown", (event) => this.onDown(event), { passive: true });
        document.addEventListener("pointerup", () => this.setPressed(false), { passive: true });
        document.addEventListener("pointercancel", () => this.setPressed(false), { passive: true });
        document.addEventListener("pointerover", (event) => this.onOver(event), { passive: true });
        document.addEventListener("pointerout", (event) => this.onOut(event), { passive: true });
        document.addEventListener("dragstart", (event) => event.preventDefault());
        window.addEventListener("blur", () => this.setPressed(false));
    }

    onMove(event)
    {
        if (event.pointerType !== "mouse")
        {
            return;
        }

        this.target_x = event.clientX;
        this.target_y = event.clientY;

        if (this.pressed && event.buttons === 0)
        {
            this.setPressed(false);
        }

        if (!this.visible)
        {
            this.x = this.target_x;
            this.y = this.target_y;
            this.visible = true;
            this.element.classList.remove("is-hidden");
        }

        this.wake();
    }

    onDown(event)
    {
        if (event.pointerType === "mouse")
        {
            this.setPressed(true);
        }
    }

    onOver(event)
    {
        const hovered = event.target instanceof Element && event.target.closest("a, button, .logo") !== null;
        if (hovered !== this.hovered)
        {
            this.hovered = hovered;
            this.updateScale();
        }
    }

    onOut(event)
    {
        if (event.relatedTarget === null && event.pointerType === "mouse")
        {
            this.visible = false;
            this.element.classList.add("is-hidden");
        }
    }

    setPressed(pressed)
    {
        if (pressed !== this.pressed)
        {
            this.pressed = pressed;
            this.updateScale();
        }
    }

    updateScale()
    {
        this.target_scale = this.hovered ? this.hover_scale : (this.pressed ? this.press_scale : 1);
        this.wake();
    }

    wake()
    {
        if (this.frame === 0)
        {
            this.frame = requestAnimationFrame(this.tick);
        }
    }

    tick = (time) =>
    {
        const dt = this.last_time ? Math.min((time - this.last_time) / 1000, 0.05) : 1 / 60;
        this.last_time = time;

        const k = 1 - Math.exp(-this.sharpness * dt);
        this.x += (this.target_x - this.x) * k;
        this.y += (this.target_y - this.y) * k;
        this.scale += (this.target_scale - this.scale) * k;

        const settled =
            Math.abs(this.target_x - this.x) < 0.1 &&
            Math.abs(this.target_y - this.y) < 0.1 &&
            Math.abs(this.target_scale - this.scale) < 0.005;

        if (settled)
        {
            this.x = this.target_x;
            this.y = this.target_y;
            this.scale = this.target_scale;
        }

        this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) scale(${this.scale})`;

        if (settled)
        {
            this.frame = 0;
            this.last_time = 0;
            return;
        }

        this.frame = requestAnimationFrame(this.tick);
    };
}

buildHeader();
buildFooter();
buildDecor();
bindCopyButtons();

if (window.matchMedia("(hover: hover)").matches)
{
    new CursorFollower();
}
