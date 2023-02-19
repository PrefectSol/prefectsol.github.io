var cursor = document.querySelector('.follow-cursor');

document.addEventListener('mousemove', function(e) {
    var x = e.clientX;
    var y = e.clientY;

    cursor.style.left = -13 + x + 'px';
    cursor.style.top = -13 + y + 'px';
});