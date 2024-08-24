document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
        document.querySelector(".preloader").classList.add("fade-out");
    }, 1000);

    setTimeout(function () {
        document.querySelector(".container-fluid").style.display = "inherit";
        document.querySelector(".preloader").style.display = "none";
    }, 1500);

    setTool('brush');

    document.getElementById('hamburgerBtn').addEventListener('click', toggleMobileSidebar);
    document.getElementById('closeBtn').addEventListener('click', toggleMobileSidebar);
});

document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key === 'z') {
        undo();
        event.preventDefault();
    } else if (event.ctrlKey && event.key === 'y') {
        redo();
        event.preventDefault();
    }
});

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let tool = 'brush';
let brushSize = 3;
let color = '#000000';
let startX, startY;
const shapes = [];
const drawingHistory = [];
const redoHistory = [];

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function toggleMobileSidebar() {
    const mobileSidebar = document.getElementById('mobileSidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    if (mobileSidebar.style.left === '0px') {
        mobileSidebar.style.left = '-100%';
        setTimeout(() => hamburgerBtn.style.display = 'block', 100);
    } else {
        hamburgerBtn.style.display = 'none';
        mobileSidebar.style.left = '0';
    }
}

function setTool(selectedTool) {
    tool = selectedTool;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`.nav-link[onclick="setTool('${tool}')"]`).classList.add('active');
    if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
}

function setColor(selectedColor) {
    color = selectedColor;
}

function setBrushSize(value) {
    document.getElementById('brushSizeRange').value = value;
    document.getElementById('brushSizeNumber').value = value;
    brushSize = parseInt(value);
}

function startDrawing(e) {
    drawing = true;
    startX = e.offsetX;
    startY = e.offsetY;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    saveState();
    redoHistory.length = 0;
}

function draw(e) {
    if (!drawing) return;

    switch (tool) {
        case 'brush':
        case 'erase':
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.strokeStyle = tool === 'brush' ? color : '#ffffff';
            ctx.lineTo(e.offsetX, e.offsetY);
            ctx.stroke();
            break;
        case 'rectangle':
        case 'circle':
        case 'line':
            redrawShapes();
            drawShape(e);
            break;
    }
}

function drawShape(e) {
    const endX = e.offsetX;
    const endY = e.offsetY;
    const width = endX - startX;
    const height = endY - startY;

    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;

    switch (tool) {
        case 'rectangle':
            ctx.strokeRect(startX, startY, width, height);
            break;
        case 'circle':
            const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            break;
    }
}

function redrawShapes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach(shape => {
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.lineWidth;
        switch (shape.type) {
            case 'rectangle':
                ctx.strokeRect(shape.startX, shape.startY, shape.width, shape.height);
                break;
            case 'circle':
                ctx.beginPath();
                ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(shape.startX, shape.startY);
                ctx.lineTo(shape.endX, shape.endY);
                ctx.stroke();
                break;
        }
    });
}

function stopDrawing() {
    if (!drawing) return;
    drawing = false;

    switch (tool) {
        case 'rectangle':
        case 'circle':
        case 'line':
            const endX = event.offsetX;
            const endY = event.offsetY;
            const width = endX - startX;
            const height = endY - startY;

            let shapeColor = color;

            switch (tool) {
                case 'rectangle':
                    shapes.push({
                        type: 'rectangle',
                        color: shapeColor,
                        lineWidth: brushSize,
                        startX: startX,
                        startY: startY,
                        width: width,
                        height: height,
                    });
                    break;
                case 'circle':
                    const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
                    const centerX = startX + width / 2;
                    const centerY = startY + height / 2;
                    shapes.push({
                        type: 'circle',
                        color: shapeColor,
                        lineWidth: brushSize,
                        centerX: centerX,
                        centerY: centerY,
                        radius: radius,
                    });
                    break;
                case 'line':
                    shapes.push({
                        type: 'line',
                        color: shapeColor,
                        lineWidth: brushSize,
                        startX: startX,
                        startY: startY,
                        endX: endX,
                        endY: endY,
                    });
                    break;
            }
    }
    ctx.beginPath();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.length = 0;
    saveState();
    redoHistory.length = 0;
}

function saveCanvas() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);

    const dataURL = tempCanvas.toDataURL('image/jpeg');
    const link = document.createElement('a');
    link.download = 'canvas_image.jpg';
    link.href = dataURL;
    link.click();
}

function openGitHub() {
    window.open('https://github.com/ThisIs-Developer/SketchFlow', '_blank');
}

function saveState() {
    const canvasImage = canvas.toDataURL();
    drawingHistory.push(canvasImage);
}

function undo() {
    if (drawingHistory.length > 0) {
        redoHistory.push(drawingHistory.pop());
        if (drawingHistory.length > 0) {
            const previousState = drawingHistory[drawingHistory.length - 1];
            const img = new Image();
            img.src = previousState;
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        shapes.pop();
    }
}

function redo() {
    if (redoHistory.length > 0) {
        const nextState = redoHistory.pop();
        drawingHistory.push(nextState);
        const img = new Image();
        img.src = nextState;
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        };
    }
}
