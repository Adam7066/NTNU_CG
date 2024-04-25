let VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        varying vec4 v_Color;
        uniform mat4 u_modelMatrix;
        void main(){
            gl_Position = u_modelMatrix * a_Position;
            gl_PointSize = 10.0;
            v_Color = a_Color;
        }    
    `;

let FSHADER_SOURCE = `
        precision mediump float;
        varying vec4 v_Color;
        void main(){
            gl_FragColor = v_Color;
        }
    `;

function compileShader(gl, vShaderText, fShaderText) {
    //Build vertex and fragment shader objects
    let vertexShader = gl.createShader(gl.VERTEX_SHADER)
    let fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    // The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    // compile vertex shader
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log('vertex shader ereror');
        let message = gl.getShaderInfoLog(vertexShader);
        console.log(message);//print shader compiling error message
    }
    // compile fragment shader
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log('fragment shader ereror');
        let message = gl.getShaderInfoLog(fragmentShader);
        console.log(message); //print shader compiling error message
    }
    // link shader to program (by a self-define function)
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    //if not success, log the program info, and delete it.
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert(gl.getProgramInfoLog(program) + "");
        gl.deleteProgram(program);
    }
    return program;
}

function initAttributeVariable(gl, a_attribute, buffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, buffer.num, buffer.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initArrayBufferForLaterUse(gl, data, num, type) {
    // Create a buffer object
    let buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    // Store the necessary information to assign the object to the attribute variable later
    buffer.num = num;
    buffer.type = type;
    return buffer;
}

function initVertexBufferForLaterUse(gl, vertices, colors) {
    let nVertices = vertices.length / 3;

    let o = {};
    o.vertexBuffer = initArrayBufferForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT);
    o.colorBuffer = initArrayBufferForLaterUse(gl, new Float32Array(colors), 3, gl.FLOAT);
    if (!o.vertexBuffer || !o.colorBuffer)
        console.log("Error: in initVertexBufferForLaterUse(gl, vertices, colors)");
    o.numVertices = nVertices;
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return o;
}

let moveStep = 0.05;
let robotMove = [0.0, 0.0];
let robotAngle = [-120.0, 40.0, 0.0];
let isTouch = false;
let isGrab = false;
let itemXY = [-0.5, -0.15];
let itemAngle = 0.0;
let zoom = 1.0;

function main() {
    // Get the canvas context
    let canvas = document.getElementById('webgl');
    let gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }
    // Compile shader and use it
    program = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    gl.useProgram(program);
    // Prepare attribute reference of the shader
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Color = gl.getAttribLocation(program, 'a_Color');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    if (program.a_Position < 0 || program.a_Color < 0 || program.u_modelMatrix < 0)
        console.log('Error: f(program.a_Position<0 || program.a_Color<0 || .....');

    let verticesA = [
        0.01, 0.1, 0.0,
        -0.01, 0.1, 0.0,
        -0.01, -0.1, 0.0,
        -0.01, -0.1, 0.0,
        0.01, -0.1, 0.0,
        0.01, 0.1, 0.0
    ];
    let vAColor1 = [], vAColor2 = [];
    for (let i = 0; i < verticesA.length / 3; i++) {
        vAColor1.push(1.0, 0.0, 0.0)
        vAColor2.push(0.0, 1.0, 0.0)
    }

    let verticesB = [
        0.05, 0.05, 0.0,
        -0.05, 0.05, 0.0,
        -0.05, -0.05, 0.0,
        -0.05, -0.05, 0.0,
        0.05, -0.05, 0.0,
        0.05, 0.05, 0.0
    ];
    let itemColor = [], itemColorTouch = [], itemColorGrab = [];
    for (let i = 0; i < verticesB.length / 3; i++) {
        itemColor.push(0.0, 0.0, 1.0);
        itemColorTouch.push(1.0, 1.0, 0.0);
        itemColorGrab.push(1.0, 0.0, 1.0);
    }

    let circleVertices = [];
    let circleColor = [];
    let n = 100;
    let r = 0.07;
    for (let i = 0; i < n; i++) {
        let x = r * Math.cos(2 * Math.PI * i / n);
        let y = r * Math.sin(2 * Math.PI * i / n);
        let x1 = r * Math.cos(2 * Math.PI * (i + 1) / n);
        let y1 = r * Math.sin(2 * Math.PI * (i + 1) / n);
        circleVertices.push(0.0, 0.0, 0.0);
        circleVertices.push(x, y, 0.0);
        circleVertices.push(x1, y1, 0.0);
        for (let j = 0; j < 3; j++) {
            circleColor.push(1.0, 0.0, 0.0);
        }
    }

    // square
    modelA1 = initVertexBufferForLaterUse(gl, verticesA, vAColor1);
    modelA2 = initVertexBufferForLaterUse(gl, verticesA, vAColor2);
    // circle
    modelC = initVertexBufferForLaterUse(gl, circleVertices, circleColor);
    // triangle
    modelItem = initVertexBufferForLaterUse(gl, verticesB, itemColor);
    modelTouch = initVertexBufferForLaterUse(gl, verticesB, itemColorTouch);
    modelGrab = initVertexBufferForLaterUse(gl, verticesB, itemColorGrab);

    draw(gl);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'w' || event.key === 'W') {
            robotMove[1] += moveStep;
        } else if (event.key === 'a' || event.key === 'A') {
            robotMove[0] -= moveStep;
        } else if (event.key === 's' || event.key === 'S') {
            robotMove[1] -= moveStep;
        } else if (event.key === 'd' || event.key === 'D') {
            robotMove[0] += moveStep;
        } else if (event.key === 'u' || event.key === 'U') {
            robotAngle[0] += 10;
        } else if (event.key === 'j' || event.key === 'J') {
            robotAngle[0] -= 10;
        } else if (event.key === 'i' || event.key === 'I') {
            robotAngle[1] += 10;
        } else if (event.key === 'k' || event.key === 'K') {
            robotAngle[1] -= 10;
        } else if (event.key === 'o' || event.key === 'O') {
            if (isGrab) robotAngle[2] += 10;
        } else if (event.key === 'l' || event.key === 'L') {
            if (isGrab) robotAngle[2] -= 10;
        } else if (event.key === 'g' || event.key === 'G') {
            if (isTouch) isGrab = !isGrab;
        } else if (event.key === '+') {
            zoom += 0.1;
        } else if (event.key === '-') {
            zoom -= 0.1;
        } else if (event.key === '0') {
            zoom = 1.0;
        }
        zoom = Math.max(0.5, Math.min(zoom, 1.5));
        draw(gl);
    });
}

function draw(gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let projMatrix = new Matrix4();
    projMatrix.setScale(zoom, zoom, 1.0);

    let transformMat = new Matrix4();
    transformMat.setIdentity();
    transformMat.multiply(projMatrix);

    // body
    transformMat.translate(robotMove[0], robotMove[1], 0.0);
    initAttributeVariable(gl, program.a_Position, modelA1.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA1.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA1.numVertices);
    let bodyMat = new Matrix4(transformMat);

    // head
    transformMat = new Matrix4(bodyMat);
    transformMat.translate(0.0, 0.15, 0.0);
    initAttributeVariable(gl, program.a_Position, modelC.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelC.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, modelC.numVertices);

    // foot
    transformMat = new Matrix4(bodyMat);
    transformMat.translate(-0.05, -0.13, 0.0);
    transformMat.rotate(-50, 0, 0, 1);
    transformMat.scale(1.0, 0.7, 1.0);
    initAttributeVariable(gl, program.a_Position, modelA1.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA1.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA1.numVertices);

    transformMat = new Matrix4(bodyMat);
    transformMat.translate(0.05, -0.13, 0.0);
    transformMat.rotate(50, 0, 0, 1);
    transformMat.scale(1.0, 0.7, 1.0);
    initAttributeVariable(gl, program.a_Position, modelA1.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA1.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA1.numVertices);

    // right arm
    transformMat = new Matrix4(bodyMat);
    transformMat.translate(0.05, -0.02, 0.0);
    transformMat.rotate(50, 0, 0, 1);
    transformMat.scale(1.0, 0.7, 1.0);
    initAttributeVariable(gl, program.a_Position, modelA1.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA1.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA1.numVertices);

    // left arm
    transformMat = new Matrix4(bodyMat);
    transformMat.translate(0, 0.01, 0.0);
    transformMat.rotate(robotAngle[0], 0, 0, 1);
    transformMat.translate(0, -0.05, 0.0);
    transformMat.scale(1.0, 0.5, 1.0);
    initAttributeVariable(gl, program.a_Position, modelA2.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA2.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA2.numVertices);

    transformMat.scale(1, 1 / 0.5, 1);
    transformMat.translate(0, -0.05, 0.0);
    transformMat.rotate(robotAngle[1], 0, 0, 1);
    transformMat.translate(0, -0.045, 0.0);
    transformMat.scale(1.0, 0.5, 1.0);
    initAttributeVariable(gl, program.a_Position, modelA2.vertexBuffer);
    initAttributeVariable(gl, program.a_Color, modelA2.colorBuffer);
    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat.elements);
    gl.drawArrays(gl.TRIANGLES, 0, modelA2.numVertices);

    // item
    let transformMat2 = new Matrix4();
    transformMat2.setIdentity();

    transformMat2.translate(itemXY[0], itemXY[1], 0.0);
    initAttributeVariable(gl, program.a_Position, modelItem.vertexBuffer);

    let handPos = transformMat.multiplyVector4(new Vector4([0.0, -0.1, 0.0, 1.0]));
    let itemPos = transformMat2.multiplyVector4(new Vector4([0.0, 0.0, 0.0, 1.0]));
    let distance = Math.sqrt(
        Math.pow(handPos.elements[0] - itemPos.elements[0], 2) +
        Math.pow(handPos.elements[1] - itemPos.elements[1], 2)
    );

    if (isGrab) {
        canLetGo = true;
        initAttributeVariable(gl, program.a_Color, modelGrab.colorBuffer);
        itemXY[0] = handPos.elements[0];
        itemXY[1] = handPos.elements[1];
        itemAngle = robotAngle[2];
    } else if (distance < 0.05) {
        isTouch = true;
        initAttributeVariable(gl, program.a_Color, modelTouch.colorBuffer);
    } else {
        isTouch = false;
        initAttributeVariable(gl, program.a_Color, modelItem.colorBuffer);
    }
    transformMat2.setTranslate(itemXY[0], itemXY[1], 0.0);
    transformMat2.rotate(itemAngle, 0, 0, 1);
    transformMat2.multiply(projMatrix);

    gl.uniformMatrix4fv(program.u_modelMatrix, false, transformMat2.elements);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, modelItem.numVertices);
}
