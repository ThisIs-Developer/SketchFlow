// SketchFlow - Professional Drawing Application
// Enhanced with Excalidraw-like features

// Application State
const state = {
    tool: 'select',
    strokeColor: '#000000',
    fillColor: '#a5d8ff',
    fillStyle: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    sloppiness: 0,
    opacity: 100,
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    isDrawing: false,
    isPanning: false,
    startX: 0,
    startY: 0,
    selectedElement: null,
    resizingHandle: null,
    elements: [],
    history: [],
    historyIndex: -1,
    clipboard: null,
    darkMode: false,
    showGrid: true
};

// Canvas Setup
let canvas, ctx;
let canvasWrapper;

// Initialize Application
document.addEventListener("DOMContentLoaded", function () {
    // Preloader
    setTimeout(function () {
        document.querySelector(".preloader").classList.add("fade-out");
    }, 1000);

    setTimeout(function () {
        document.querySelector(".app-container").style.display = "block";
        document.querySelector(".preloader").style.display = "none";
        initializeCanvas();
        // Mark grid button as active by default
        document.getElementById('gridBtn')?.classList.add('active');
    }, 1500);

    // Set default tool
    setTool('select');
});

// Canvas Initialization
function initializeCanvas() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    canvasWrapper = document.querySelector('.canvas-area');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Event Listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Mouse wheel zoom
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Prevent context menu
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Initial render
    render();
}

function resizeCanvas() {
    const container = document.querySelector('.canvas-area');
    // Make canvas much larger for infinite scrolling
    canvas.width = Math.max(10000, container.clientWidth * 5);
    canvas.height = Math.max(10000, container.clientHeight * 5);
    render();
}

// Tool Selection
function setTool(toolName) {
    state.tool = toolName;
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`[data-tool="${toolName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Update cursor
    updateCursor();
    
    // Deselect element when switching tools
    if (toolName !== 'select') {
        state.selectedElement = null;
        render();
    }
}

function updateCursor() {
    if (!canvas) return;
    const cursors = {
        select: 'default',
        pan: 'grab',
        rectangle: 'crosshair',
        circle: 'crosshair',
        diamond: 'crosshair',
        ellipse: 'crosshair',
        arrow: 'crosshair',
        line: 'crosshair',
        brush: 'crosshair',
        text: 'text',
        erase: 'crosshair'
    };
    canvas.style.cursor = cursors[state.tool] || 'default';
}

// Mouse Event Handlers
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom - state.panX;
    const y = (e.clientY - rect.top) / state.zoom - state.panY;

    state.startX = x;
    state.startY = y;
    state.isDrawing = true;

    if (state.tool === 'select') {
        // Check for resize handle on currently-selected element first
        if (state.selectedElement) {
            const handle = getHandleAtPoint(x, y, state.selectedElement);
            if (handle) {
                state.resizingHandle = handle;
                return;
            }
        }
        handleSelection(x, y);
    } else if (state.tool === 'pan') {
        state.isPanning = true;
        canvas.style.cursor = 'grabbing';
    } else if (state.tool === 'text') {
        state.isDrawing = false; // Text handled via overlay, not drawing loop
        if (!document.querySelector('.canvas-text-input')) {
            createTextElement(x, y);
        }
    } else if (state.tool === 'brush') {
        startFreehand(x, y);
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom - state.panX;
    const y = (e.clientY - rect.top) / state.zoom - state.panY;

    // Update cursor when hovering over resize handles (not during drag)
    if (!state.isDrawing && state.tool === 'select' && state.selectedElement) {
        const handle = getHandleAtPoint(x, y, state.selectedElement);
        canvas.style.cursor = handle ? getResizeCursor(handle) : 'default';
    }

    if (!state.isDrawing) return;

    if (state.tool === 'pan' && state.isPanning) {
        state.panX += (x - state.startX);
        state.panY += (y - state.startY);
        render();
    } else if (state.tool === 'brush') {
        continueFreehand(x, y);
    } else if (state.tool === 'select' && state.resizingHandle) {
        resizeElement(x, y);
    } else if (state.tool === 'select' && state.selectedElement) {
        moveElement(x, y);
    } else {
        drawPreview(x, y);
    }
}

function handleMouseUp(e) {
    if (!state.isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.zoom - state.panX;
    const y = (e.clientY - rect.top) / state.zoom - state.panY;

    if (state.tool === 'pan') {
        state.isPanning = false;
        canvas.style.cursor = 'grab';
    } else if (state.resizingHandle) {
        state.resizingHandle = null;
        saveHistory();
    } else if (state.tool !== 'select' && state.tool !== 'brush' && state.tool !== 'text') {
        createElement(x, y);
    } else if (state.tool === 'brush') {
        finishFreehand();
    }

    state.isDrawing = false;
}

// Touch Event Handlers
function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
}

// Element Creation
function createElement(endX, endY) {
    const element = {
        id: Date.now(),
        type: state.tool,
        x: Math.min(state.startX, endX),
        y: Math.min(state.startY, endY),
        width: Math.abs(endX - state.startX),
        height: Math.abs(endY - state.startY),
        startX: state.startX,
        startY: state.startY,
        endX: endX,
        endY: endY,
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        fillStyle: state.fillStyle,
        strokeWidth: state.strokeWidth,
        strokeStyle: state.strokeStyle,
        sloppiness: state.sloppiness,
        opacity: state.opacity / 100
    };

    if (element.width > 2 || element.height > 2) {
        state.elements.push(element);
        saveHistory();
        render();
    }
}

function createTextElement(x, y) {
    const textarea = document.createElement('textarea');
    textarea.className = 'canvas-text-input';
    textarea.style.left = ((x + state.panX) * state.zoom) + 'px';
    textarea.style.top = ((y + state.panY) * state.zoom) + 'px';
    const fontSize = Math.max(12, state.strokeWidth * 8);
    textarea.style.fontSize = (fontSize * state.zoom) + 'px';
    textarea.style.color = state.strokeColor;
    textarea.rows = 1;
    document.querySelector('.canvas-area').appendChild(textarea);
    textarea.focus();

    function commitText() {
        const text = textarea.value.trim();
        if (textarea.parentNode) textarea.remove();
        if (text) {
            const element = {
                id: Date.now(),
                type: 'text',
                x: x,
                y: y,
                text: text,
                strokeColor: state.strokeColor,
                fontSize: fontSize,
                opacity: state.opacity / 100
            };
            state.elements.push(element);
            saveHistory();
            render();
        }
    }

    textarea.addEventListener('keydown', function(e) {
        e.stopPropagation(); // Prevent canvas keyboard shortcuts while typing
        if (e.key === 'Escape') {
            if (textarea.parentNode) textarea.remove();
        } else if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commitText();
        }
    });

    textarea.addEventListener('blur', commitText);
}

// Freehand Drawing
let currentPath = [];

function startFreehand(x, y) {
    currentPath = [{x, y}];
}

function continueFreehand(x, y) {
    currentPath.push({x, y});
    render();
    drawPath(currentPath, state.strokeColor, state.strokeWidth, state.opacity / 100);
}

function finishFreehand() {
    if (currentPath.length > 1) {
        const element = {
            id: Date.now(),
            type: 'brush',
            path: [...currentPath],
            strokeColor: state.strokeColor,
            strokeWidth: state.strokeWidth,
            opacity: state.opacity / 100
        };
        state.elements.push(element);
        saveHistory();
        currentPath = [];
        render();
    }
}

// Selection and Moving
function handleSelection(x, y) {
    // Find element at position (reverse to get top element)
    for (let i = state.elements.length - 1; i >= 0; i--) {
        if (isPointInElement(x, y, state.elements[i])) {
            state.selectedElement = state.elements[i];
            state.startX = x;
            state.startY = y;
            render();
            return;
        }
    }
    state.selectedElement = null;
    render();
}

function isPointInElement(x, y, element) {
    if (element.type === 'text') {
        // Simple bounding box check for text
        return x >= element.x && x <= element.x + 100 && 
               y >= element.y - 20 && y <= element.y + 10;
    } else if (element.type === 'brush') {
        // Check if point is near any point in the path
        return element.path.some(p => 
            Math.abs(p.x - x) < element.strokeWidth * 2 && 
            Math.abs(p.y - y) < element.strokeWidth * 2
        );
    } else {
        return x >= element.x && x <= element.x + element.width &&
               y >= element.y && y <= element.y + element.height;
    }
}

function moveElement(x, y) {
    if (!state.selectedElement) return;
    
    const dx = x - state.startX;
    const dy = y - state.startY;

    if (state.selectedElement.type === 'brush') {
        state.selectedElement.path = state.selectedElement.path.map(p => ({
            x: p.x + dx,
            y: p.y + dy
        }));
    } else {
        state.selectedElement.x += dx;
        state.selectedElement.y += dy;
        if (state.selectedElement.startX !== undefined) {
            state.selectedElement.startX += dx;
            state.selectedElement.startY += dy;
            state.selectedElement.endX += dx;
            state.selectedElement.endY += dy;
        }
    }

    state.startX = x;
    state.startY = y;
    render();
}

// Rendering
function render() {
    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply transformations
    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(state.panX, state.panY);

    // Render all elements
    state.elements.forEach(element => {
        renderElement(element);
    });

    // Draw selection highlight
    if (state.selectedElement) {
        drawSelectionBox(state.selectedElement);
    }

    ctx.restore();
}

function renderElement(element) {
    ctx.save();
    ctx.globalAlpha = element.opacity;

    switch (element.type) {
        case 'rectangle':
            drawRectangle(element);
            break;
        case 'circle':
            drawCircle(element);
            break;
        case 'diamond':
            drawDiamond(element);
            break;
        case 'ellipse':
            drawEllipse(element);
            break;
        case 'arrow':
            drawArrow(element);
            break;
        case 'line':
            drawLine(element);
            break;
        case 'brush':
            drawPath(element.path, element.strokeColor, element.strokeWidth, element.opacity);
            break;
        case 'text':
            drawText(element);
            break;
    }

    ctx.restore();
}

function drawRectangle(el) {
    applyStrokeStyle(el);
    
    if (el.fillStyle !== 'transparent') {
        ctx.fillStyle = el.fillColor;
        if (el.sloppiness > 0) {
            drawRoughRect(el.x, el.y, el.width, el.height, el.sloppiness);
        } else {
            ctx.fillRect(el.x, el.y, el.width, el.height);
        }
    }
    
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    
    if (el.sloppiness > 0) {
        drawRoughRect(el.x, el.y, el.width, el.height, el.sloppiness);
    } else {
        ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
}

function drawCircle(el) {
    applyStrokeStyle(el);
    
    const radius = Math.min(el.width, el.height) / 2;
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    
    if (el.fillStyle !== 'transparent') {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
    }
    
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.stroke();
}

function drawEllipse(el) {
    applyStrokeStyle(el);
    
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;
    const radiusX = el.width / 2;
    const radiusY = el.height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    
    if (el.fillStyle !== 'transparent') {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
    }
    
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.stroke();
}

function drawDiamond(el) {
    applyStrokeStyle(el);
    
    const centerX = el.x + el.width / 2;
    const centerY = el.y + el.height / 2;

    ctx.beginPath();
    ctx.moveTo(centerX, el.y);
    ctx.lineTo(el.x + el.width, centerY);
    ctx.lineTo(centerX, el.y + el.height);
    ctx.lineTo(el.x, centerY);
    ctx.closePath();
    
    if (el.fillStyle !== 'transparent') {
        ctx.fillStyle = el.fillColor;
        ctx.fill();
    }
    
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.stroke();
}

function drawArrow(el) {
    applyStrokeStyle(el);
    
    ctx.strokeStyle = el.strokeColor;
    ctx.fillStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;

    // Draw line
    ctx.beginPath();
    ctx.moveTo(el.startX, el.startY);
    ctx.lineTo(el.endX, el.endY);
    ctx.stroke();

    // Draw arrowhead
    const angle = Math.atan2(el.endY - el.startY, el.endX - el.startX);
    const headLength = 15 + el.strokeWidth * 2;

    ctx.beginPath();
    ctx.moveTo(el.endX, el.endY);
    ctx.lineTo(
        el.endX - headLength * Math.cos(angle - Math.PI / 6),
        el.endY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        el.endX - headLength * Math.cos(angle + Math.PI / 6),
        el.endY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

function drawLine(el) {
    applyStrokeStyle(el);
    
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(el.startX, el.startY);
    ctx.lineTo(el.endX, el.endY);
    ctx.stroke();
}

function drawPath(path, color, width, opacity) {
    if (path.length < 2) return;
    
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    
    ctx.stroke();
    ctx.restore();
}

function drawText(el) {
    ctx.fillStyle = el.strokeColor;
    ctx.font = `${el.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.textBaseline = 'top';
    const lines = el.text.split('\n');
    lines.forEach((line, i) => {
        ctx.fillText(line, el.x, el.y + i * el.fontSize * 1.2);
    });
}

function drawSelectionBox(element) {
    ctx.save();
    ctx.strokeStyle = '#1971c2';
    ctx.lineWidth = 2 / state.zoom;
    ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
    
    if (element.type === 'brush') {
        // Draw bounding box for brush strokes
        const bounds = getPathBounds(element.path);
        ctx.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10);
    } else if (element.type === 'text') {
        ctx.strokeRect(element.x - 5, element.y - 5, 100, 30);
    } else {
        ctx.strokeRect(element.x - 5, element.y - 5, element.width + 10, element.height + 10);
    }

    // Draw resize handles for resizable shapes
    const handles = getResizeHandles(element);
    if (handles.length > 0) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#1971c2';
        ctx.lineWidth = 1.5 / state.zoom;
        const hs = 8 / state.zoom;
        handles.forEach(h => {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
            ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        });
    }
    
    ctx.restore();
}

function getPathBounds(path) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    path.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Returns 8 resize handle positions for resizable shapes
function getResizeHandles(element) {
    if (!['rectangle', 'diamond', 'ellipse', 'circle'].includes(element.type)) return [];
    const { x, y, width: w, height: h } = element;
    return [
        { id: 'nw', x: x,         y: y },
        { id: 'n',  x: x + w / 2, y: y },
        { id: 'ne', x: x + w,     y: y },
        { id: 'e',  x: x + w,     y: y + h / 2 },
        { id: 'se', x: x + w,     y: y + h },
        { id: 's',  x: x + w / 2, y: y + h },
        { id: 'sw', x: x,         y: y + h },
        { id: 'w',  x: x,         y: y + h / 2 }
    ];
}

// Returns the handle id if (x, y) is within hit distance of any handle
function getHandleAtPoint(x, y, element) {
    const handles = getResizeHandles(element);
    const hitRadius = 8 / state.zoom;
    for (const handle of handles) {
        if (Math.abs(handle.x - x) <= hitRadius && Math.abs(handle.y - y) <= hitRadius) {
            return handle.id;
        }
    }
    return null;
}

function getResizeCursor(handleId) {
    const map = {
        nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize',
        e: 'e-resize', se: 'se-resize', s: 's-resize',
        sw: 'sw-resize', w: 'w-resize'
    };
    return map[handleId] || 'default';
}

function resizeElement(x, y) {
    const el = state.selectedElement;
    if (!el || !state.resizingHandle) return;

    const dx = x - state.startX;
    const dy = y - state.startY;
    const handle = state.resizingHandle;

    if (handle.includes('e')) {
        el.width = Math.max(10, el.width + dx);
    }
    if (handle.includes('s')) {
        el.height = Math.max(10, el.height + dy);
    }
    if (handle.includes('w')) {
        const newW = Math.max(10, el.width - dx);
        el.x += el.width - newW;
        el.width = newW;
    }
    if (handle.includes('n')) {
        const newH = Math.max(10, el.height - dy);
        el.y += el.height - newH;
        el.height = newH;
    }

    state.startX = x;
    state.startY = y;
    render();
}

// Mouse wheel zoom – zooms centred on the cursor position
function handleWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const oldZoom = state.zoom;
    const newZoom = Math.min(Math.max(oldZoom * zoomFactor, 0.1), 5);

    // Keep the world-space point under the cursor stable
    state.panX += mouseScreenX * (1 / newZoom - 1 / oldZoom);
    state.panY += mouseScreenY * (1 / newZoom - 1 / oldZoom);
    state.zoom = newZoom;

    updateZoomDisplay();
    render();
}

// Rough/Sketchy drawing for hand-drawn effect
function drawRoughRect(x, y, width, height, roughness) {
    const offset = roughness * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.random() * offset, y + Math.random() * offset);
    ctx.lineTo(x + width + Math.random() * offset, y + Math.random() * offset);
    ctx.lineTo(x + width + Math.random() * offset, y + height + Math.random() * offset);
    ctx.lineTo(x + Math.random() * offset, y + height + Math.random() * offset);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function applyStrokeStyle(element) {
    if (element.strokeStyle === 'dashed') {
        ctx.setLineDash([10, 5]);
    } else if (element.strokeStyle === 'dotted') {
        ctx.setLineDash([2, 3]);
    } else {
        ctx.setLineDash([]);
    }
}

function drawPreview(endX, endY) {
    render();
    
    ctx.save();
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(state.panX, state.panY);
    ctx.globalAlpha = 0.7;

    const previewElement = {
        x: Math.min(state.startX, endX),
        y: Math.min(state.startY, endY),
        width: Math.abs(endX - state.startX),
        height: Math.abs(endY - state.startY),
        startX: state.startX,
        startY: state.startY,
        endX: endX,
        endY: endY,
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        fillStyle: state.fillStyle,
        strokeWidth: state.strokeWidth,
        strokeStyle: state.strokeStyle,
        sloppiness: state.sloppiness,
        opacity: 1,
        type: state.tool
    };

    renderElement(previewElement);
    ctx.restore();
}

// Property Setters
function setStrokeColor(color) {
    state.strokeColor = color;
    document.getElementById('strokeColor').value = color;
}

function setFillColor(color) {
    state.fillColor = color;
    document.getElementById('fillColor').value = color;
}

function setFillStyle(style) {
    state.fillStyle = style;
    document.querySelectorAll('.fill-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-fill="${style}"]`)?.classList.add('active');
}

function setStrokeWidth(width) {
    state.strokeWidth = width;
    document.querySelectorAll('.stroke-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-width="${width}"]`)?.classList.add('active');
}

function setStrokeStyle(style) {
    state.strokeStyle = style;
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-style="${style}"]`)?.classList.add('active');
}

function setSloppiness(value) {
    state.sloppiness = parseInt(value);
}

function setOpacity(value) {
    state.opacity = parseInt(value);
    document.getElementById('opacityValue').textContent = value + '%';
}

// Zoom Controls
function zoomIn() {
    state.zoom = Math.min(state.zoom * 1.2, 5);
    updateZoomDisplay();
    render();
}

function zoomOut() {
    state.zoom = Math.max(state.zoom / 1.2, 0.1);
    updateZoomDisplay();
    render();
}

function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    updateZoomDisplay();
    render();
}

function updateZoomDisplay() {
    const el = document.getElementById('zoomLevel');
    if (el) el.textContent = Math.round(state.zoom * 100) + '%';
}

// Sidebar toggle (for mobile / menu button)
function toggleSidebar() {
    document.getElementById('leftSidebar')?.classList.toggle('show');
}

// Sloppiness via icon buttons
function setSloppinessBtn(value) {
    state.sloppiness = parseInt(value);
    document.querySelectorAll('.slop-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-slop="${value}"]`)?.classList.add('active');
}

// History Management
function saveHistory() {
    // Remove any future history if we're not at the end
    state.history = state.history.slice(0, state.historyIndex + 1);
    
    // Add current state
    state.history.push(JSON.parse(JSON.stringify(state.elements)));
    state.historyIndex++;
    
    // Limit history to 50 steps
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
        state.selectedElement = null;
        render();
    } else if (state.historyIndex === 0) {
        state.elements = [];
        state.historyIndex = -1;
        state.selectedElement = null;
        render();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.elements = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
        state.selectedElement = null;
        render();
    }
}

// Canvas Actions
function clearCanvas() {
    if (confirm('Are you sure you want to clear the canvas?')) {
        state.elements = [];
        state.selectedElement = null;
        saveHistory();
        render();
    }
}

// Export Functions
function showExportMenu() {
    document.getElementById('exportModal').classList.add('show');
}

function closeExportMenu() {
    document.getElementById('exportModal').classList.remove('show');
}

function exportAsPNG() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // White background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw current canvas
    tempCtx.drawImage(canvas, 0, 0);

    // Download
    const dataURL = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `sketchflow-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    
    closeExportMenu();
}

function exportAsSVG() {
    alert('SVG export coming soon!');
    closeExportMenu();
}

function exportAsJSON() {
    const data = JSON.stringify({
        version: '1.0',
        elements: state.elements
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `sketchflow-${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    
    closeExportMenu();
}

function copyToClipboard() {
    canvas.toBlob(blob => {
        navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
            alert('Image copied to clipboard!');
            closeExportMenu();
        }).catch(err => {
            alert('Failed to copy to clipboard');
            closeExportMenu();
        });
    });
}

// Keyboard Shortcuts
function handleKeyDown(e) {
    // Tool shortcuts
    if (e.key === 'v') setTool('select');
    else if (e.key === 'h') setTool('pan');
    else if (e.key === 'r') setTool('rectangle');
    else if (e.key === 'c' && !e.ctrlKey) setTool('circle');
    else if (e.key === 'd' && !e.ctrlKey) setTool('diamond');
    else if (e.key === 'e' && !e.ctrlKey) setTool('ellipse');
    else if (e.key === 'a' && !e.ctrlKey) setTool('arrow');
    else if (e.key === 'l') setTool('line');
    else if (e.key === 'p') setTool('brush');
    else if (e.key === 't') setTool('text');
    
    // Action shortcuts
    else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    else if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        copySelected();
    }
    else if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        pasteFromClipboard();
    }
    else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
    }
    else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAll();
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
    }
    
    // Zoom shortcuts
    else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
    }
    else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
    }
    else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
    }
}

function copySelected() {
    if (state.selectedElement) {
        state.clipboard = JSON.parse(JSON.stringify(state.selectedElement));
    }
}

function pasteFromClipboard() {
    if (state.clipboard) {
        const newElement = JSON.parse(JSON.stringify(state.clipboard));
        newElement.id = Date.now();
        newElement.x += 20;
        newElement.y += 20;
        state.elements.push(newElement);
        state.selectedElement = newElement;
        saveHistory();
        render();
    }
}

function duplicateSelected() {
    if (state.selectedElement) {
        copySelected();
        pasteFromClipboard();
    }
}

function deleteSelected() {
    if (state.selectedElement) {
        state.elements = state.elements.filter(el => el.id !== state.selectedElement.id);
        state.selectedElement = null;
        saveHistory();
        render();
    }
}

function selectAll() {
    // Future implementation for multi-select
    alert('Select all coming soon!');
}

// UI Functions
function toggleShortcuts() {
    const modal = document.getElementById('shortcutsModal');
    modal.classList.toggle('show');
}

function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.body.classList.toggle('dark-mode');
}

function toggleGrid() {
    state.showGrid = !state.showGrid;
    const canvasArea = document.querySelector('.canvas-area');
    if (state.showGrid) {
        canvasArea.classList.remove('no-grid');
    } else {
        canvasArea.classList.add('no-grid');
    }
    
    // Update button state
    const gridBtn = document.getElementById('gridBtn');
    if (gridBtn) {
        if (state.showGrid) {
            gridBtn.classList.add('active');
        } else {
            gridBtn.classList.remove('active');
        }
    }
}

function openGitHub() {
    window.open('https://github.com/ThisIs-Developer/SketchFlow', '_blank');
}
