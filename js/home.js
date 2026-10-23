const life = new GameOfLife(document.getElementById("life"), {
    density: 0.2,
    step_ms: 100,
    seed: GameOfLife.seedFromUrl()
});

life.start();

document.getElementById("logo").addEventListener("click", () => life.reset());
