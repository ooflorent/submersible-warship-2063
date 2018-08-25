import { rand, choice } from './utils';

const _window = window;
const _document = document;
const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

// GAMEPLAY VARIABLES

const TITLE_SCREEN = 0;
const GAME_SCREEN = 1;
const END_SCREEN = 2;
let screen = TITLE_SCREEN;

let countdown; // in seconds
let hero;
let entities;

function Input() {
  this.left = this.right = this.up = this.down = 0;
}

function ArtificialInput(time) {
  this.nextChange = this.remaining = time;
}

function Velocity(speed) {
  this.dx = this.dy = this.dr = 0;
  this.speed = speed;
}

// RENDER VARIABLES

const RATIO = 1.6; // 16:10
const CTX = c.getContext('2d');         // visible canvas
const BUFFER = c.cloneNode();           // visible portion of map
const BUFFER_CTX = BUFFER.getContext('2d');
const TILESET = c.cloneNode();
const TILESET_CTX = TILESET.getContext('2d');

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789.:!-%,/';
const ALIGN_LEFT = 0;
const ALIGN_CENTER = 1;
const ALIGN_RIGHT = 2;

const CHARSET_SIZE = 8; // in px
const DASH_FRAME_DURATION = 0.1; // duration of 1 animation frame, in seconds
let charset = '';   // alphabet sprite, filled in by build script, overwritten at runtime

// LOOP VARIABLES

let currentTime;
let elapsedTime;
let lastTime;
let requestId;
let running = true;

// GAMEPLAY HANDLERS

function startGame() {
  konamiIndex = 0;
  countdown = 60;
  hero = createEntity('player', BUFFER.width / 2, BUFFER.height / 2, {
    input: new Input(),
    velocity: new Velocity(40),
  });
  entities = [
    hero,
    createEntity('sub1', 100, 100, { velocity: new Velocity(20), artificialInput: new ArtificialInput(5) }),
    createEntity('sub1', 100, BUFFER.height - 100, { velocity: new Velocity(20), artificialInput: new ArtificialInput(10) }),
    createEntity('sub1', BUFFER.width - 100, 100, { velocity: new Velocity(20), artificialInput: new ArtificialInput(2.5) }),
    createEntity('sub1', BUFFER.width - 100, BUFFER.height - 100, { velocity: new Velocity(20), artificialInput: new ArtificialInput(7.5) }),
  ];
  screen = GAME_SCREEN;
};

function testCircleCollision(entity1, entity2) {
  return Math.pow(entity1.radius + entity2.radius, 2) > Math.pow(entity1.x - entity2.x, 2) + Math.pow(entity1.y - entity2.y, 2);
};

function constrainToViewport(entity) {
  if (entity.x < 0) {
    entity.x = 0;
  } else if (entity.x > BUFFER.width - entity.radius) {
    entity.x = BUFFER.width - entity.radius;
  }
  if (entity.y < 0) {
    entity.y = 0;
  } else if (entity.y > BUFFER.height - entity.radius) {
    entity.y = BUFFER.height - entity.radius;
  }
};

function createEntity(type, x = 0, y = 0, { artificialInput, input, velocity }) {
  return {
    artificialInput,
    input,
    velocity,
    online: true,
    radius: 6,
    type,
    x,
    y,
  };
};

function updateVisiblePosition(entity, shouldUpdate) {
  if (shouldUpdate) {
    entity.visibleX = entity.x;
    entity.visibleY = entity.y;
    entity.visibleAngle = entity.angle;
  }
};

function killEntity(entity) {
  // mark entity for removal at end of update() loop
  entity.dead = true;
  // TODO add debris in place of entity
};

// if both dx & dy = 1, then diagonal vector should have length 1
// therefore 1^2 = r^2 + r^2
// therefore r = sqrt(1 / 2);
const DIAGONAL_VELOCITY = Math.sqrt(1 / 2);

function applyInputToVelocity({ input, velocity }) {
  if (input) {
    velocity.dx = input.left + input.right;
    velocity.dy = input.up + input.down;

    if (velocity.dx && velocity.dy) {
      velocity.dx *= DIAGONAL_VELOCITY;
      velocity.dy *= DIAGONAL_VELOCITY;
    }
  }
};

function applyArtificialInputToVelocity({ artificialInput, velocity }) {
  if (artificialInput) {
    artificialInput.remaining -= elapsedTime;
    if (artificialInput.remaining < 0) {
      artificialInput.remaining += artificialInput.nextChange;

      velocity.dx = choice([-1, 0, 1]);
      velocity.dy = choice([-1, 0, 1]);
      if (velocity.dx && velocity.dy) {
        velocity.dx *= DIAGONAL_VELOCITY;
        velocity.dy *= DIAGONAL_VELOCITY;
      }
    }
  }
};

function applyVelocityToPosition(entity) {
  const { velocity } = entity;
  const distance = velocity.speed * elapsedTime;
  entity.x += distance * velocity.dx;
  entity.y += distance * velocity.dy;

  // TODO there is got to be a way to make this formula more sensible
  entity.angle =
    velocity.dx < 0 && velocity.dy < 0 ? -45 :
    velocity.dx < 0 && velocity.dy === 0 ? -90 :
    velocity.dx < 0 && velocity.dy > 0 ? -135 :
    velocity.dx === 0 && velocity.dy < 0 ? 0 :
    velocity.dx > 0 && velocity.dy < 0 ? 45 :
    velocity.dx > 0 && velocity.dy === 0 ? 90 :
    velocity.dx > 0 && velocity.dy > 0 ? 135 :
    velocity.dx === 0 && velocity.dy > 0 ? 180 : 0;

};


function update() {
  switch (screen) {
    case GAME_SCREEN:
      countdown -= elapsedTime;
      if (countdown < 0 || hero.dead) {
        screen = END_SCREEN;
      }
      entities.forEach((entity) => {
        applyInputToVelocity(entity);
        applyArtificialInputToVelocity(entity);
        applyVelocityToPosition(entity);
        if (entity !== hero) {
          if (testCircleCollision(hero, entity)) {
            killEntity(hero);
            killEntity(entity);
          }
        }
        constrainToViewport(entity);
        updateVisiblePosition(entity, hero.online && entity.online);
      });
      // remove dead entities
      entities = entities.filter(entity => !entity.dead);

      break;
  }
};

// RENDER HANDLERS

function blit() {
  // copy backbuffer onto visible canvas, scaling it to screen dimensions
  CTX.drawImage(
    BUFFER,
    0, 0, BUFFER.width, BUFFER.height,
    0, 0, c.width, c.height
  );
};

function render() {
  BUFFER_CTX.fillStyle = 'rgb(20,35,40)';
  BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);

  switch (screen) {
    case TITLE_SCREEN:
      renderText('subwar 2051', CHARSET_SIZE, CHARSET_SIZE);
      renderText('press any key', BUFFER.width / 2, BUFFER.height / 2, ALIGN_CENTER);
      if (konamiIndex === konamiCode.length) {
        renderText('konami mode on', BUFFER.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);
      }
      break;
    case GAME_SCREEN:
      // uncomment to debug mobile input handlers
      // renderDebugTouch();
      renderGrid();
      entities.forEach(renderRadar);
      entities.forEach(renderEntity);
      renderText(`sonar: ${hero.online ? 'on' : 'off'}line`, CHARSET_SIZE, CHARSET_SIZE);
      renderCountdown();
      break;
    case END_SCREEN:
      renderText('game over', CHARSET_SIZE, CHARSET_SIZE);
      break;
  }

  blit();
};

function initTileset() {
  TILESET.width = TILESET.height = 64;
  // cross for tactical grid
  TILESET_CTX.strokeStyle = 'rgb(40,55,50)';
  TILESET_CTX.beginPath();
  TILESET_CTX.moveTo(0, 4);
  TILESET_CTX.lineTo(8, 4);
  TILESET_CTX.stroke();
  TILESET_CTX.closePath();
  TILESET_CTX.beginPath();
  TILESET_CTX.moveTo(4, 0);
  TILESET_CTX.lineTo(4, 8);
  TILESET_CTX.stroke();
  TILESET_CTX.closePath();
};

function renderCountdown() {
  const minutes = Math.floor(Math.ceil(countdown) / 60);
  const seconds = Math.ceil(countdown) - minutes * 60;
  renderText(`${minutes}:${seconds <= 9 ? '0' : ''}${seconds}`, BUFFER.width - CHARSET_SIZE, CHARSET_SIZE, ALIGN_RIGHT);

};

function renderGrid() {
  BUFFER_CTX.fillStyle = BUFFER_CTX.createPattern(TILESET, 'repeat');
  BUFFER_CTX.fillRect(0, 0, BUFFER.width, BUFFER.height);
};

function renderEntity(entity) {
  BUFFER_CTX.save();

  const { visibleX: x, visibleY: y, visibleAngle: angle } = entity;
  BUFFER_CTX.translate(Math.round(x), Math.round(y));
  BUFFER_CTX.rotate(angle /180 * Math.PI);

  if (entity.type === 'player') {
    renderPlayerSub();
  } else if (entity.type === 'sub1') {
    renderEnemySub(entity);
  } else if (entity.type === 'debris') {
    renderDebris(entity);
  }

  BUFFER_CTX.restore();
};

function renderPlayerSub() {
  BUFFER_CTX.shadowBlur = 10;
  BUFFER_CTX.fillStyle = 'rgb(75,190,250)';
  BUFFER_CTX.shadowColor = BUFFER_CTX.fillStyle;
  BUFFER_CTX.beginPath();
  BUFFER_CTX.arc(0, 0, 5, 0, Math.PI+Math.PI);
  BUFFER_CTX.fillRect(-2, -12, 4, 12);
  BUFFER_CTX.fill()
  BUFFER_CTX.closePath();
};

function renderEnemySub() {
  BUFFER_CTX.beginPath();
  BUFFER_CTX.shadowBlur = 10;
  BUFFER_CTX.fillStyle = hero.online ? 'rgb(230,90,100)' : 'rgb(55,40,35)';
  BUFFER_CTX.shadowColor = BUFFER_CTX.fillStyle;
  BUFFER_CTX.fillRect(-5, -5, 10, 10);
  BUFFER_CTX.fillRect(-2, -12, 4, 12);
  BUFFER_CTX.fill()
  BUFFER_CTX.closePath();
};

function renderRadar(entity) {
  BUFFER_CTX.save();

  const { visibleX: x, visibleY: y, dashOffset = 0, dashTime = 0 } = entity;
  BUFFER_CTX.translate(Math.round(x), Math.round(y));

  if (entity.type === 'player') {
    renderPlayerRadar(dashOffset);
    // TODO should be done in update()
    entity.dashTime = dashTime + elapsedTime;
    if (entity.dashTime > DASH_FRAME_DURATION) {
      entity.dashTime -= DASH_FRAME_DURATION;
      entity.dashOffset = (dashOffset-1) % 12;  // next line dash: 4, 8, 12 <- offset
    }
  } else {
    renderEnemyRadar();
  }

  BUFFER_CTX.restore();
};

function renderPlayerRadar(dashOffset) {
  // radar
  BUFFER_CTX.shadowBlur = 10;
  BUFFER_CTX.strokeStyle = 'rgb(70,105,105)';
  BUFFER_CTX.shadowColor = BUFFER_CTX.strokeStyle;
  BUFFER_CTX.beginPath();
  BUFFER_CTX.arc(0, 0, 80, 0, Math.PI+Math.PI);
  BUFFER_CTX.stroke();
  BUFFER_CTX.closePath();
  // proximity alert
  BUFFER_CTX.beginPath();
  BUFFER_CTX.lineDashOffset = dashOffset;
  BUFFER_CTX.setLineDash([4, 8]);
  BUFFER_CTX.arc(0, 0, 40, 0, Math.PI+Math.PI);
  BUFFER_CTX.stroke();
  BUFFER_CTX.closePath();
};

function renderEnemyRadar() {
  // radar
  BUFFER_CTX.shadowBlur = 10;
  BUFFER_CTX.strokeStyle = 'rgb(55,40,35)';
  BUFFER_CTX.shadowColor = BUFFER_CTX.strokeStyle;
  BUFFER_CTX.beginPath();
  BUFFER_CTX.arc(0, 0, 80, 0, Math.PI+Math.PI);
  BUFFER_CTX.stroke();
  BUFFER_CTX.closePath();
};

function renderText(msg, x, y, align = ALIGN_LEFT, scale = 1) {
  const SCALED_SIZE = scale * CHARSET_SIZE;
  const MSG_WIDTH = msg.length * SCALED_SIZE;
  const ALIGN_OFFSET = align === ALIGN_RIGHT ? MSG_WIDTH :
                       align === ALIGN_CENTER ? MSG_WIDTH / 2 :
                       0;
  [...msg].forEach((c, i) => {
    BUFFER_CTX.drawImage(
      charset,
      // TODO could memoize the characters index or hardcode a lookup table
      ALPHABET.indexOf(c)*CHARSET_SIZE, 0, CHARSET_SIZE, CHARSET_SIZE,
      x + i*SCALED_SIZE - ALIGN_OFFSET, y, SCALED_SIZE, SCALED_SIZE
    );
  });
};

// LOOP HANDLERS

function loop() {
  if (running) {
    requestId = requestAnimationFrame(loop);
    render();
    currentTime = Date.now();
    elapsedTime = (currentTime - lastTime) / 1000;
    update();
    lastTime = currentTime;
  }
};

function toggleLoop(value) {
  running = value;
  if (running) {
    lastTime = Date.now();
    loop();
  } else {
    cancelAnimationFrame(requestId);
  }
};

// EVENT HANDLERS

onload = async (e) => {
  // the real "main" of the game
  _document.title = 'Subwar 2051';

  onresize();
  initTileset();

  charset = await loadImg(charset);
  toggleLoop(true);
};

onresize = _window.onrotate = function() {
  // fit canvas in screen while maintaining aspect ratio
  c.width = BUFFER.width = innerWidth > innerHeight * RATIO ? innerHeight * RATIO : innerWidth;
  c.height = BUFFER.height = innerWidth > innerHeight * RATIO ? innerHeight : innerWidth / RATIO;

  // disable smoothing on image scaling
  CTX.imageSmoothingEnabled = BUFFER_CTX.imageSmoothingEnabled = false;
};

// UTILS

_document.onvisibilitychange = function(e) {
  // pause loop and game timer when switching tabs
  toggleLoop(!e.target.hidden);
};

function loadImg(dataUri) {
  return new Promise(function(resolve) {
    var img = new Image();
    img.onload = function() {
      resolve(img);
    };
    img.src = dataUri;
  });
};

// INPUT HANDLERS

onkeydown = function(e) {
  // prevent itch.io from scrolling the page up/down
  e.preventDefault();

  if (!e.repeat) {
    switch (screen) {
      case GAME_SCREEN:
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            hero.input.left = -1;
            break;
          case 'ArrowUp':
          case 'KeyW':
            hero.input.up = -1;
            break;
          case 'ArrowRight':
          case 'KeyD':
            hero.input.right = 1;
            break;
          case 'ArrowDown':
          case 'KeyS':
            hero.input.down = 1;
            break;
          case 'KeyP':
            // Pause game as soon as key is pressed
            toggleLoop(!running);
            break;
        }
        break;
    }
  }
};

onkeyup = function(e) {
  switch (screen) {
    case TITLE_SCREEN:
      if (e.which !== konamiCode[konamiIndex] || konamiIndex === konamiCode.length) {
        startGame();
      } else {
        konamiIndex++;
      }
      break;
    case GAME_SCREEN:
      switch (e.code) {
        case 'ArrowLeft':
        case 'KeyA':
          hero.input.left = 0;
          break;
        case 'ArrowRight':
        case 'KeyD':
          hero.input.right = 0;
          break;
        case 'ArrowUp':
        case 'KeyW':
          hero.input.up = 0;
          break;
        case 'ArrowDown':
        case 'KeyS':
          hero.input.down = 0;
          break;
        case 'KeyO': // when playing with arrows
        case 'KeyF': // when playing with WASD
          hero.online = !hero.online;
          hero.switchModeTime = currentTime;
          break;
      }
      break;
    case END_SCREEN:
      switch (e.code) {
        case 'KeyT':
          open(`https://twitter.com/intent/tweet?text=viral%20marketing%20message%20https%3A%2F%2Fgoo.gl%2F${'some tiny Google url here'}`, '_blank');
          break;
        default:
          screen = TITLE_SCREEN;
          break;
      }
      break;
  }
};

// MOBILE INPUT HANDLERS

let minX = 0;
let minY = 0;
let maxX = 0;
let maxY = 0;
let MIN_DISTANCE = 44; // in px
let touches = [];

// adding onmousedown/move/up triggers a MouseEvent and a PointerEvent
// on platform that support both (duplicate event, pointer > mouse || touch)
_window.ontouchstart = _window.onpointerdown = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      [maxX, maxY] = [minX, minY] = pointerLocation(e);
      break;
  }
};

_window.ontouchmove = _window.onpointermove = function(e) {
  e.preventDefault();
  switch (screen) {
    case GAME_SCREEN:
      if (minX && minY) {
        setTouchPosition(pointerLocation(e));
      }
      break;
  }
}

_window.ontouchend = _window.onpointerup = function(e) {
  e.preventDefault();
  switch (screen) {
    case TITLE_SCREEN:
      startGame();
      break;
    case GAME_SCREEN:
      // stop hero
      hero.input.left = hero.input.right = hero.input.up = hero.input.down = 0;
      // end touch
      minX = minY = maxX = maxY = 0;
      break;
    case END_SCREEN:
      screen = TITLE_SCREEN;
      break;
  }
};

// utilities
function pointerLocation(e) {
  return [e.pageX || e.changedTouches[0].pageX, e.pageY || e.changedTouches[0].pageY];
};

function setTouchPosition([x, y]) {
  // touch moving further right
  if (x > maxX) {
    maxX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.input.right = 1;
    }
  }
  // touch moving further left
  else if (x < minX) {
    minX = x;
    if (maxX - minX > MIN_DISTANCE) {
      hero.input.left = -1;
    }
  }
  // touch reversing left while hero moving right
  else if (x < maxX && hero.input.right) {
    minX = x;
    hero.input.right = 0;
  }
  // touch reversing right while hero moving left
  else if (minX < x && hero.input.left) {
    maxX = x;
    hero.input.left = 0;
  }

  // touch moving further down
  if (y > maxY) {
    maxY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.input.down = 1;
    }
  }
  // touch moving further up
  else if (y < minY) {
    minY = y;
    if (maxY - minY > MIN_DISTANCE) {
      hero.input.up = -1;
    }
  }
  // touch reversing up while hero moving down
  else if (y < maxY && hero.input.down) {
    minY = y;
    hero.input.down = 0;
  }
  // touch reversing down while hero moving up
  else if (minY < y && hero.input.up) {
    maxY = y;
    hero.input.up = 0;
  }

  // uncomment to debug mobile input handlers
  // addDebugTouch(x, y);
};

function addDebugTouch(x, y) {
  touches.push([x / innerWidth * BUFFER.width, y / innerHeight * BUFFER.height]);
  if (touches.length > 10) {
    touches = touches.slice(touches.length - 10);
  }
};

function renderDebugTouch() {
  let x = maxX / innerWidth * BUFFER.width;
  let y = maxY / innerHeight * BUFFER.height;
  renderDebugTouchBound(x, x, 0, BUFFER.height, '#f00');
  renderDebugTouchBound(0, BUFFER.width, y, y, '#f00');
  x = minX / innerWidth * BUFFER.width;
  y = minY / innerHeight * BUFFER.height;
  renderDebugTouchBound(x, x, 0, BUFFER.height, '#ff0');
  renderDebugTouchBound(0, BUFFER.width, y, y, '#ff0');

  if (touches.length) {
    BUFFER_CTX.strokeStyle = BUFFER_CTX.fillStyle =   '#02d';
    BUFFER_CTX.beginPath();
    [x, y] = touches[0];
    BUFFER_CTX.moveTo(x, y);
    touches.forEach(function([x, y]) {
      BUFFER_CTX.lineTo(x, y);
    });
    BUFFER_CTX.stroke();
    BUFFER_CTX.closePath();
    BUFFER_CTX.beginPath();
    [x, y] = touches[touches.length - 1];
    BUFFER_CTX.arc(x, y, 2, 0, 2 * Math.PI)
    BUFFER_CTX.fill();
    BUFFER_CTX.closePath();
  }
};

function renderDebugTouchBound(_minX, _maxX, _minY, _maxY, color) {
  BUFFER_CTX.strokeStyle = color;
  BUFFER_CTX.beginPath();
  BUFFER_CTX.moveTo(_minX, _minY);
  BUFFER_CTX.lineTo(_maxX, _maxY);
  BUFFER_CTX.stroke();
  BUFFER_CTX.closePath();
};
