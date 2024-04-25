var VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    varying vec4 v_Color;
    void main(){
        gl_Position = a_Position;
        gl_PointSize = 10.0;
        v_Color = a_Color;
    }
    `;

var FSHADER_SOURCE = `
    precision mediump float;
    varying vec4 v_Color;
    void main(){
        gl_FragColor = v_Color;
    }
    `;

function compileShader(gl, vShaderText, fShaderText) {
    //////Build vertex and fragment shader objects
    var vertexShader = gl.createShader(gl.VERTEX_SHADER)
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    //The way to  set up shader text source
    gl.shaderSource(vertexShader, vShaderText)
    gl.shaderSource(fragmentShader, fShaderText)
    //compile vertex shader
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.log('vertex shader ereror');
        var message = gl.getShaderInfoLog(vertexShader);
        console.log(message);//print shader compiling error message
    }
    //compile fragment shader
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.log('fragment shader ereror');
        var message = gl.getShaderInfoLog(fragmentShader);
        console.log(message);//print shader compiling error message
    }

    /////link shader to program (by a self-define function)
    var program = gl.createProgram();
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

g_points = [[], [], [], []];
nowColor = 0; // R, G, B
nowShape = 0; // 點、方、圓、三角形
circleSegment = 30;

function main() {
    var canvas = document.getElementById('webgl');
    var gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    let renderProgram = compileShader(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    gl.useProgram(renderProgram);


    canvas.onmousedown = function (ev) { click(ev, gl, canvas, renderProgram) }
    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'r' || ev.key === 'R') nowColor = 0;
        else if (ev.key === 'g' || ev.key === 'G') nowColor = 1;
        else if (ev.key === 'b' || ev.key === 'B') nowColor = 2;

        else if (ev.key === 'p' || ev.key === 'P') nowShape = 0;
        else if (ev.key === 'q' || ev.key === 'Q') nowShape = 1;
        else if (ev.key === 'c' || ev.key === 'C') nowShape = 2;
        else if (ev.key === 't' || ev.key === 'T') nowShape = 3;
    });

    // init the background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

function click(ev, gl, canvas, program) {
    let x = ev.clientX, y = ev.clientY;
    let rect = ev.target.getBoundingClientRect();
    x = ((x - rect.left) - canvas.width / 2) / (canvas.width / 2);
    y = (canvas.height / 2 - (y - rect.top)) / (canvas.height / 2);

    switch (nowShape) {
        case 0:
            if (g_points[nowShape].length === 3) g_points[nowShape].shift();
            if (nowColor === 0) g_points[nowShape].push([x, y, 1.0, 0.0, 0.0]);
            else if (nowColor === 1) g_points[nowShape].push([x, y, 0.0, 1.0, 0.0]);
            else g_points[nowShape].push([x, y, 0.0, 0.0, 1.0]);
            break;
        case 1:
            if (g_points[nowShape].length === 18) {
                for (let i = 0; i < 6; i++)
                    g_points[nowShape].shift();
            }
            let xy1 = [[0.05, 0.05], [0.05, -0.05], [-0.05, 0.05], [-0.05, -0.05]];
            for (let i = 0; i < 3; i++) {
                if (nowColor === 0) g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 0.0, 0.0, 1.0]);
            }
            for (let i = 1; i < 4; i++) {
                if (nowColor === 0) g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x + xy1[i][0], y + xy1[i][1], 0.0, 0.0, 1.0]);
            }
            break;
        case 2:
            if (g_points[nowShape].length === circleSegment * 9) {
                for (let i = 0; i < circleSegment * 3; i++)
                    g_points[nowShape].shift();
            }
            let r = 0.05;
            for (let i = 0; i < circleSegment; i++) {
                if (nowColor === 0) g_points[nowShape].push([x, y, 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x, y, 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x, y, 0.0, 0.0, 1.0]);

                let x2 = x + r * Math.cos(2 * Math.PI * i / circleSegment);
                let y2 = y + r * Math.sin(2 * Math.PI * i / circleSegment);
                if (nowColor === 0) g_points[nowShape].push([x2, y2, 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x2, y2, 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x2, y2, 0.0, 0.0, 1.0]);

                let x3 = x + r * Math.cos(2 * Math.PI * (i + 1) / circleSegment);
                let y3 = y + r * Math.sin(2 * Math.PI * (i + 1) / circleSegment);
                if (nowColor === 0) g_points[nowShape].push([x3, y3, 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x3, y3, 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x3, y3, 0.0, 0.0, 1.0]);
            }
            break;
        case 3:
            if (g_points[nowShape].length === 9) {
                for (let i = 0; i < 3; i++)
                    g_points[nowShape].shift();
            }
            let xy3 = [[0, 0.05], [0.05, -0.05], [-0.05, -0.05]];
            for (let i = 0; i < 3; i++) {
                if (nowColor === 0) g_points[nowShape].push([x + xy3[i][0], y + xy3[i][1], 1.0, 0.0, 0.0]);
                else if (nowColor === 1) g_points[nowShape].push([x + xy3[i][0], y + xy3[i][1], 0.0, 1.0, 0.0]);
                else g_points[nowShape].push([x + xy3[i][0], y + xy3[i][1], 0.0, 0.0, 1.0]);
            }
            break;
    }

    // Draw the background
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let i = 0; i < g_points.length; i++) {
        let vertices = new Float32Array(g_points[i].flat());
        let vertexBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuf);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        let FSIZE = Float32Array.BYTES_PER_ELEMENT;
        let a_Position = gl.getAttribLocation(program, 'a_Position');
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 5, 0);
        gl.enableVertexAttribArray(a_Position);
        let a_Color = gl.getAttribLocation(program, 'a_Color');
        gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE * 5, FSIZE * 2);
        gl.enableVertexAttribArray(a_Color);

        if (i === 0) gl.drawArrays(gl.POINTS, 0, g_points[i].length);
        else if (i === 1) gl.drawArrays(gl.TRIANGLES, 0, g_points[i].length);
        else if (i === 2) gl.drawArrays(gl.TRIANGLES, 0, g_points[i].length);
        else if (i == 3) gl.drawArrays(gl.TRIANGLES, 0, g_points[i].length);
    }
}
