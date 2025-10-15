(function(){
  "use strict"
  const readyBtn = document.getElementById('ready');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  const numReadyTxt = document.getElementById('num-ready');
  const scoreContainer = document.getElementById('player-scores');
  const chatInput = document.getElementById('chat-input');
  const chatContainer = document.getElementById('chat-log');
  
  const socket = io();
  const pathParts = window.location.pathname.split('/');
  const roomId = pathParts[pathParts.length - 1];
  socket.emit('joinRoom', roomId);

  const numReadyStyle = `
    color: #666;
    font-size: 0.9em;
    display: block;
    margin-bottom: 10px;
  `

  const showError = (message) => {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        background: #111;
        border: 2px solid #00ff00;
        color: #c33;
        padding: 10px;
        margin: 10px 0;
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 300px;
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
};

  const WIDTH = 600;
  const HEIGHT = 600;
  const CELLS = 20;
  const SIZE = WIDTH / CELLS;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const lastScores = {};
  let direction = 0;

  const sanitizeInput = (input) => {
      if (typeof input !== 'string') return '';
      return input.trim().replace(/[<>'"&]/g, '');
  };

  readyBtn.addEventListener("click", ()=>{
    socket.emit('ready', readyBtn.checked);
  })


  window.addEventListener('keydown', function(e) {
    // arrow keys
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && document.activeElement !== chatInput) {
      e.preventDefault();
    }
  }, false);

  window.addEventListener("keydown", (event)=>{
    if(document.activeElement === chatInput) return;
    switch(event.code){
      case "KeyA":
      case "ArrowLeft":
        direction = -1;
        socket.emit('input', direction);
        break;
      case "KeyW":
      case "ArrowUp":
        direction = 2;
        socket.emit('input', direction);
        break;
      case "KeyS":
      case "ArrowDown":
        direction = -2;
        socket.emit('input', direction);
        break;
      case "KeyD":
      case "ArrowRight":
        direction = 1;
        socket.emit('input', direction);
        break;
    }
  })



  socket.on('start', ()=>{
    readyBtn.disabled = true;
    while(scoreContainer.firstChild){
      scoreContainer.removeChild(scoreContainer.firstChild);
    }
  });

  socket.on('updateGame', (data)=>{
    const { players, gameState } = data;
    context.fillStyle = "#111";
    context.clearRect(0,0,WIDTH,HEIGHT);
    players.forEach((player)=>{drawPlayer(player)});
    gameState.apples.forEach((apple)=>{drawApple(apple)})
  });

  socket.on('gameOver', (gameState) => {
    updateReadyUI(gameState);
    context.fillStyle = "#00ff00";
    context.font = "16px courier new";
    context.fillText("Game Over...", SIZE, SIZE);
    readyBtn.disabled = false;
    readyBtn.checked = false;
  })

  socket.on('lobby', (gameState)=> {
    updateReadyUI(gameState);

    context.fillStyle = "#00ff00";
    context.font = "16px courier new";
    context.fillText("Waiting for both players to start...", SIZE, SIZE);
    return;
  })

  socket.on('ui', (gameState) => {
    updateReadyUI(gameState);
  })

  socket.on('error', (errorMsg) => {
    alert('Error: ' + errorMsg);
    window.location.href = '/';
  });


  function drawPlayer(player) {
    const score = player.segments.length;
    const isSelf = player.id === socket.id;
    const elemId = `${player.id}-score`;
    let scoreHtml = document.getElementById(elemId);

    if (!scoreHtml) {
      scoreHtml = document.createElement('p');
      scoreHtml.id = elemId;
      scoreContainer.appendChild(scoreHtml);
    }

    if (score !== lastScores[player.id]) {
      scoreHtml.textContent = `${isSelf ? 'Your' : 'Opponent'} Score: ${score}`;
      lastScores[player.id] = score;
    }

    const color = isSelf ? '#00ff00' : '#0000ff';
    player.segments.forEach(seg => {
      context.fillStyle   = color;
      context.fillRect(seg.x * SIZE, seg.y * SIZE, SIZE, SIZE);

      context.strokeStyle = '#111';
      context.lineWidth   = 1;
      context.strokeRect(seg.x *  SIZE, seg.y * SIZE, SIZE, SIZE);
    });
  }

  function drawApple(apple){
    let color = "red"
    context.fillStyle = color;
    context.fillRect(apple.x * SIZE, apple.y * SIZE, SIZE,SIZE);
  }

  function updateReadyUI(gameState){
    numReadyTxt.innerText = `${gameState.numReady}/2 players ready`;
    numReadyTxt.style.cssText = numReadyStyle;
  }

  chatInput.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    let input = sanitizeInput(e.target.value);
    if(!input){
      showError("Please enter a valid message");
      return;
    }

    if(input.length < 100) {
      socket.emit("message", input);
      e.target.value = "";
    }else{
      showError("Message must be less than 100 chars");
    };
  });
  
  socket.on('recieved', (data) => {
    const { player, content } = data;
    const newChat = document.createElement('p');
    newChat.innerText = content;
    if(player.id === socket.id) {
      newChat.className = 'chat-message user'
    }else{
      newChat.className = 'chat-message other'
    }
    
    chatContainer.appendChild(newChat);
    chatContainer.scrollTop = chatContainer.scrollHeight; 
  })

  socket.on('sysMessage', (message) => {
    const newChat = document.createElement('p');
    newChat.innerText = message;
    newChat.className = 'chat-message system';
    chatContainer.appendChild(newChat);
    chatContainer.scrollTop = chatContainer.scrollHeight; 
  })

})();
