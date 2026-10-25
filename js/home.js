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

        this.value.textContent = `${gps_text}/${max_text}`;
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

function loadViewCount()
{
    const element = document.querySelector(".views-value");
    if (!element)
    {
        return;
    }

    fetch("https://prefect.goatcounter.com/counter/TOTAL.json")
        .then((response) => response.ok ? response.json() : Promise.reject())
        .then((data) =>
        {
            const digits = String(data.count).replace(/\D/g, "");
            element.textContent = digits
                ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
                : "—";
        })
        .catch(() => {});
}

loadViewCount();
