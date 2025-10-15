const LEFT = -1;
const UP = 2;
const RIGHT = 1;
const DOWN = -2;
const INPUT_BUFFER_LENGTH = 8;

const GRID_SIZE = [20,20];

class CellGrid {
    constructor(width, height){
        this.cellSet = new Set();

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const key = `${x},${y}`;
                this.cellSet.add(key);
            }
        }
    }

    addCell(position){
        const { x, y } = position;
        const key = `${x},${y}`;

        if(this.cellSet.has(key)){
            return false;
        }

        this.cellSet.add(key);
        return true;
    }

    removeCell(position){
        const { x, y } = position;
        const key = `${x},${y}`;
        return this.cellSet.delete(key);
    }

    getRandomCell(){
        if(this.cellSet.size === 0) return null;

        const arr = Array.from(this.cellSet);
        const pos_key = arr[Math.floor(Math.random() * arr.length)];
        const position = pos_key.split(",");

        return {x: Number(position[0]), y:Number(position[1])};
    }
}


const changeDirection = (player, direction) => {
    const inputs = player.inputs;
    const len = inputs.length;

    if(len > INPUT_BUFFER_LENGTH){
        return false;
    }

    if(len === 0 && direction !== player.direction && direction !== -player.direction){
        inputs.push(direction);
        return true;
    }

    if(inputs[len-1] == direction || inputs[len -1] == -direction){
        return false;
    }

    inputs.push(direction);
    return true;
}

const move = (player, gameState) => {
    let dx, dy;

    const inputs = player.inputs;
    
    const dir = inputs.shift();

    if(dir && dir!== -player.direction){
        player.direction = dir;
    }

    const segments = player.segments;
    const head = segments[0];
    
    if(!head){
        return;
    }

    gameState.gridMap.removeCell(head);
    switch(player.direction){
        case RIGHT:
            dx = 1;
            dy = 0;
            break;
        case UP:
            dx = 0;
            dy = -1;
            break;
        case LEFT: 
            dx = -1;
            dy = 0;
            break;
        case DOWN: 
            dx = 0;
            dy = 1;
            break;
        default:
            dx = 0;
            dy = 0;
            break;
    }

    const newHead = {
        x: head.x + dx,
        y: head.y + dy,
    }


    segments.unshift(newHead);

    segments.forEach((seg)=>{
        gameState.gridMap.removeCell(seg);
    })
    const tail = segments.pop();
    gameState.gridMap.addCell(tail);

}

const checkCollision = (player, players, settings) => {
    const segments = player.segments;

    const head = segments[0];

    if(!head){
        player.alive = false;
        return true;
    }


    const wallCollision = (head.x < 0 || head.x >= GRID_SIZE[0] || head.y < 0 || head.y >= GRID_SIZE[1])

    if(settings.borders && wallCollision) {
        player.alive = false;
        return true;
    }else if (!settings.borders && wallCollision) {
        if(head.x < 0){
            head.x = GRID_SIZE[0] - 1
        }else if(head.x >= GRID_SIZE[0]) {
            head.x = 0;
        }else if(head.y < 0){
            head.y = GRID_SIZE[1] - 1
        }else if(head.y >= GRID_SIZE[1]) {
            head.y = 0
        }
    }

    segments.forEach((segment)=>{
        if(segment !== head && segment.x === head.x && segment.y === head.y){
            player.alive = false;
            return true;
        }
    });


    players.forEach((p)=>{
        if(p.id !== player.id){
            otherSegments = p.segments;
            otherSegments.forEach((segment)=>{
                if(segment.x === head.x && segment.y === head.y){
                    player.alive = false;
                    return true;
                }
            });            
        }
    })


    return false;
}

const initApples = (gameState) => {
    const apples = [];

    for(let i = 0; i< 6; i++){
        const apple = gameState.gridMap.getRandomCell();
        if(apple){
            apples.push(apple);
            gameState.gridMap.removeCell(apple);
        }
    }
    return apples;
}

const eat = (player, gameState) =>{
    const apples = gameState.apples;
    const segments = player.segments;
    const head = segments[0];

    if(!head || !player.alive){
        return;
    }


    apples.forEach((apple, idx)=>{
        if(apple.x === head.x && apple.y === head.y){
            //dont need to add it to available cells because the head is also there
            const len = segments.length;
            const tail = segments[len -1];
            segments.push(tail);
   
            const newApple = gameState.gridMap.getRandomCell();
            if(newApple){
                gameState.gridMap.removeCell(newApple);
                apples[idx] = newApple;
            }
        }
    });
}

const resetPlayer = (player, gameState) =>{
    player.ready = false;
    player.alive = true;

    const newHead = gameState.gridMap.getRandomCell();
    if(newHead){
        player.segments = [newHead];
    }
    player.direction = 0;
    player.inputs = [];
}

const resetMap = (gameState) =>{
    gameState.gridMap = new CellGrid(20,20);
    const apples = gameState.apples;

    for(let i = 0; i< apples.length; i++){
        apples[i] = gameState.gridMap.getRandomCell();
        if(apples[i]){
            gameState.gridMap.removeCell(apples[i]);
        }
    }
}

module.exports = {
    changeDirection,
    checkCollision,
    move,
    eat,
    initApples,
    resetPlayer,
    resetMap,
    CellGrid,
}