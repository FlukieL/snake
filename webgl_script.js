// WebGL porting logic

const canvas = document.getElementById('gameCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
  alert('Unable to initialize WebGL. Your browser or machine may not support it.');
}

// Vertex shader source code
const vsSource = `
  attribute vec4 aVertexPosition;
  uniform vec2 u_translation; // Add uniform for translation

  void main() {
    vec4 translatedPosition = aVertexPosition;
    translatedPosition.xy += u_translation; // Apply translation
    gl_Position = translatedPosition;
  }
`;

// Fragment shader source code
const fsSource = `
  void main() {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
  }
`;

// Function to initialize shaders
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

// Function to load a single shader
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

// Collect all the info needed to use the shader program.
const programInfo = {
  program: shaderProgram,
  attribLocations: {
    vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
  },
};

// Function to create buffer data for a triangle representing the snake
function createSnakeBuffer(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Define the snake triangle's vertices (replace with actual snake geometry later)
  const positions = [
    -0.1, -0.1, 0.0, // First vertex
     0.1, -0.1, 0.0, // Second vertex
     0.0,  0.1, 0.0  // Third vertex
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  return positionBuffer;
}

// Function to create buffer data for a triangle representing the food
function createFoodBuffer(gl) {
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Define the food square's vertices
  const positions = [
     0.2,  0.2, 0.0, // Top right
     0.2,  0.3, 0.0, // Bottom right
     0.3,  0.2, 0.0, // Top left
     0.3,  0.3, 0.0  // Bottom left
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  return positionBuffer;
}

// Function to draw a shape
function drawShape(gl, programInfo, buffer, numComponents, primitiveType, vertexCount, x, y, gridSize) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    numComponents, // Number of components per iteration
    gl.FLOAT,
    false,
    0,
    0
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

  gl.useProgram(programInfo.program);

  // Calculate the translation based on grid position and grid size
  const translationX = (x * 2.0 / gl.canvas.width) - 1.0; // Normalize to -1 to +1 range
  const translationY = 1.0 - (y * 2.0 / gl.canvas.height); // Normalize and invert Y

  // Apply the translation (assuming you have a uniform for translation in your shader)
  const translationUniformLocation = gl.getUniformLocation(programInfo.program, 'u_translation');
  gl.uniform2f(translationUniformLocation, translationX, translationY);

  gl.drawArrays(primitiveType, 0, vertexCount); 
}

const snakeBuffer = createSnakeBuffer(gl);
const foodBuffer = createFoodBuffer(gl);

// Draw the scene repeatedly
function render() {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black
  gl.clearDepth(1.0); // Clear everything
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Assuming snake[0] is the head
  const gridSize = 20;
  drawShape(gl, programInfo, snakeBuffer, 3, gl.TRIANGLES, 3, snake[0].x, snake[0].y, gridSize); // Draw the snake
  drawShape(gl, programInfo, foodBuffer, 3, gl.TRIANGLE_STRIP, 4, food.x, food.y, gridSize); // Draw the food
}

requestAnimationFrame(render);