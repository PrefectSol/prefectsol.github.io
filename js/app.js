var cursor = document.querySelector('.follow-cursor');

cursor.style.left = -100 + 'px';
cursor.style.top = -100 + 'px';

document.addEventListener('mousemove', function(e) {
    var x = e.clientX;
    var y = e.clientY;

    cursor.style.left = -13 + x + 'px';
    cursor.style.top = -13 + y + 'px';
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

    const image = document.getElementById("logo");

    image.addEventListener("click", function() {
        game.gameSetUp();
    });
}