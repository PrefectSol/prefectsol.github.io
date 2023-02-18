var cursor = document.querySelector('.follow-cursor');

document.addEventListener('mousemove', function(e) {
    var x = e.clientX;
    var y = e.clientY;

    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
});

const canvas = document.querySelector("#gamefield")
const ctx = canvas.getContext("2d")

ctx.canvas.width  = window.innerWidth;
ctx.canvas.height = window.innerHeight;

const game = new GameOfLife()
game.gameSetUp()

window.onload = () => {
    window.setInterval(() => {
        game.runGame();
    }, 100)
}