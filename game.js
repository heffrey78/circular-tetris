const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
canvas.width = 600;
canvas.height = 600;

// Game constants
const CENTER_X = canvas.width / 2;
const CENTER_Y = canvas.height / 2;
const OUTER_RADIUS = 240;
const INNER_RADIUS = 80;
const CELL_SIZE = 20;
const GRID_RINGS = Math.floor((OUTER_RADIUS - INNER_RADIUS) / CELL_SIZE);
const SEGMENTS_PER_RING = 32;
const OUTER_RING_THRESHOLD = 1; // How close to outer edge before game over

// Game state
let gameBoard = [];
let currentPiece = null;
let gameLoop = null;
let score = 0;
let lastMoveTime = 0;
const MOVE_INTERVAL = 1000;

// Initialize the donut grid
function initializeGrid() {
    gameBoard = [];
    for (let ring = 0; ring < GRID_RINGS; ring++) {
        gameBoard[ring] = new Array(SEGMENTS_PER_RING).fill(null);
    }
}

// Piece shapes (using radial coordinates [ring, segment])
const PIECES = [
    // L shape
    [[[0,0], [0,1], [0,2], [1,2]], '#FF0000'],
    // Reverse L
    [[[0,0], [0,1], [0,2], [1,0]], '#00FF00'],
    // Square
    [[[0,0], [0,1], [1,0], [1,1]], '#0000FF'],
    // Line
    [[[0,0], [0,1], [0,2], [0,3]], '#FFFF00'],
    // T shape
    [[[0,0], [0,1], [0,2], [1,1]], '#FF00FF']
];

// Convert polar to cartesian coordinates
function polarToCartesian(ring, segment) {
    const radius = OUTER_RADIUS - (ring * CELL_SIZE);
    const angle = (segment * 2 * Math.PI) / SEGMENTS_PER_RING;
    return {
        x: CENTER_X + radius * Math.cos(angle),
        y: CENTER_Y + radius * Math.sin(angle)
    };
}

// Create new piece
function createPiece() {
    const pieceType = Math.floor(Math.random() * PIECES.length);
    const entryDirection = Math.floor(Math.random() * 4);
    const shape = PIECES[pieceType][0];
    const color = PIECES[pieceType][1];
    
    let startRing = 0;
    let startSegment;
    
    switch(entryDirection) {
        case 0: // top
            startSegment = 0;
            break;
        case 1: // right
            startSegment = Math.floor(SEGMENTS_PER_RING / 4);
            break;
        case 2: // bottom
            startSegment = Math.floor(SEGMENTS_PER_RING / 2);
            break;
        case 3: // left
            startSegment = Math.floor(3 * SEGMENTS_PER_RING / 4);
            break;
    }

    return {
        shape: shape,
        color: color,
        ring: startRing,
        segment: startSegment
    };
}

// Draw a single cell
function drawCell(ring, segment, color) {
    const angleStep = (2 * Math.PI) / SEGMENTS_PER_RING;
    const outerRadius = OUTER_RADIUS - (ring * CELL_SIZE);
    const innerRadius = outerRadius - CELL_SIZE;
    const startAngle = segment * angleStep;
    const endAngle = (segment + 1) * angleStep;
    
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, outerRadius, startAngle, endAngle);
    ctx.arc(CENTER_X, CENTER_Y, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.stroke();
}

// Draw the game board
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw donut background
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(CENTER_X, CENTER_Y, OUTER_RADIUS, 0, 2 * Math.PI);
    ctx.arc(CENTER_X, CENTER_Y, INNER_RADIUS, 0, 2 * Math.PI, true);
    ctx.fill();
    
    // Draw grid lines
    ctx.strokeStyle = '#333';
    
    // Draw rings
    for (let ring = 0; ring <= GRID_RINGS; ring++) {
        const radius = OUTER_RADIUS - (ring * CELL_SIZE);
        ctx.beginPath();
        ctx.arc(CENTER_X, CENTER_Y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
    
    // Draw segments
    for (let segment = 0; segment < SEGMENTS_PER_RING; segment++) {
        const angle = (segment * 2 * Math.PI) / SEGMENTS_PER_RING;
        ctx.beginPath();
        ctx.moveTo(
            CENTER_X + INNER_RADIUS * Math.cos(angle),
            CENTER_Y + INNER_RADIUS * Math.sin(angle)
        );
        ctx.lineTo(
            CENTER_X + OUTER_RADIUS * Math.cos(angle),
            CENTER_Y + OUTER_RADIUS * Math.sin(angle)
        );
        ctx.stroke();
    }
    
    // Draw placed pieces
    for (let ring = 0; ring < GRID_RINGS; ring++) {
        for (let segment = 0; segment < SEGMENTS_PER_RING; segment++) {
            if (gameBoard[ring][segment]) {
                drawCell(ring, segment, gameBoard[ring][segment]);
            }
        }
    }
    
    // Draw current piece
    if (currentPiece) {
        currentPiece.shape.forEach(([r, s]) => {
            const ring = currentPiece.ring + r;
            const segment = (currentPiece.segment + s + SEGMENTS_PER_RING) % SEGMENTS_PER_RING;
            if (ring >= 0 && ring < GRID_RINGS) {
                drawCell(ring, segment, currentPiece.color);
            }
        });
    }

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 30);
}

// Check if any placed pieces are at the outer edge
function checkOuterRingViolation() {
    return gameBoard[OUTER_RING_THRESHOLD].some(cell => cell !== null);
}

// Check for collisions
function checkCollision(piece, ringOffset = 0, segmentOffset = 0) {
    return piece.shape.some(([r, s]) => {
        const ring = piece.ring + r + ringOffset;
        const segment = (piece.segment + s + segmentOffset + SEGMENTS_PER_RING) % SEGMENTS_PER_RING;
        
        return ring < 0 || ring >= GRID_RINGS || gameBoard[ring][segment] !== null;
    });
}

// Move piece inward
function movePieceIn() {
    if (!currentPiece) return;
    
    if (!checkCollision(currentPiece, 1)) {
        currentPiece.ring++;
        return true;
    } else {
        placePiece();
        return false;
    }
}

// Rotate piece
function rotatePiece() {
    if (!currentPiece) return;
    
    const newShape = currentPiece.shape.map(([r, s]) => {
        return [-s, r];
    });
    
    const rotatedPiece = {
        ...currentPiece,
        shape: newShape
    };
    
    if (!checkCollision(rotatedPiece)) {
        currentPiece.shape = newShape;
    }
}

// Place piece on board
function placePiece() {
    if (!currentPiece) return;
    
    currentPiece.shape.forEach(([r, s]) => {
        const ring = currentPiece.ring + r;
        const segment = (currentPiece.segment + s + SEGMENTS_PER_RING) % SEGMENTS_PER_RING;
        if (ring >= 0 && ring < GRID_RINGS) {
            gameBoard[ring][segment] = currentPiece.color;
        }
    });
    
    // Check if any pieces are at the outer edge
    if (checkOuterRingViolation()) {
        gameOver();
        return;
    }
    
    checkLines();
    currentPiece = createPiece();
    
    // Check if new piece can be placed
    if (checkCollision(currentPiece)) {
        gameOver();
    }
}

// Check for completed circular lines
function checkLines() {
    for (let ring = 0; ring < GRID_RINGS; ring++) {
        if (gameBoard[ring].every(cell => cell !== null)) {
            // Clear the ring
            gameBoard[ring] = new Array(SEGMENTS_PER_RING).fill(null);
            score += 100;
            
            // Move outer rings inward
            for (let r = ring - 1; r >= 0; r--) {
                gameBoard[r + 1] = [...gameBoard[r]];
            }
            gameBoard[0] = new Array(SEGMENTS_PER_RING).fill(null);
        }
    }
}

// Game over
function gameOver() {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2);
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText('Press Space to restart', canvas.width / 2, canvas.height / 2 + 80);
}

// Game loop
function update(timestamp) {
    if (timestamp - lastMoveTime >= MOVE_INTERVAL) {
        movePieceIn();
        lastMoveTime = timestamp;
    }
    
    drawBoard();
    gameLoop = requestAnimationFrame(update);
}

// Initialize game
function init() {
    initializeGrid();
    currentPiece = createPiece();
    score = 0;
    lastMoveTime = performance.now();
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    update(performance.now());
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (!currentPiece) {
        if (e.key === ' ') {
            init();
        }
        return;
    }
    
    switch(e.key) {
        case 'ArrowLeft':
            if (!checkCollision(currentPiece, 0, -1)) {
                currentPiece.segment = (currentPiece.segment - 1 + SEGMENTS_PER_RING) % SEGMENTS_PER_RING;
            }
            break;
        case 'ArrowRight':
            if (!checkCollision(currentPiece, 0, 1)) {
                currentPiece.segment = (currentPiece.segment + 1) % SEGMENTS_PER_RING;
            }
            break;
        case 'ArrowDown':
            movePieceIn();
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
    }
});

// Start the game
init();