const life = new GameOfLife(document.getElementById("life"), {
    density: 0.2,
    step_ms: 100,
    seed: GameOfLife.seedFromUrl()
});

life.start();

document.getElementById("logo").addEventListener("click", () => life.reset());

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
        this.toggle.setAttribute("aria-label", "toggle generations meter");

        this.value = document.createElement("span");
        this.value.className = "meter-value";

        this.element.append(this.toggle, this.value);
        document.body.append(this.element);

        this.toggle.addEventListener("click", () => this.setCollapsed(!this.collapsed));

        this.render();
        requestAnimationFrame(this.tick);
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

        this.value.textContent = `GEN/s ${gps.toFixed(2)}/${max.toFixed(2)}`;
        this.value.style.color = `hsl(${hue}, 55%, 70%)`;
        this.toggle.textContent = this.collapsed ? "+" : "−";
    }

    tick = () =>
    {
        this.render();
        requestAnimationFrame(this.tick);
    };
}

new GpsMeter(life);
