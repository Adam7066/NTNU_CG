<template>
    <canvas ref="canvasRef" width="800" height="800"
            @mousedown="mouseDown($event)"
            @mouseup="mouseUp()"
            @mousemove="mouseMove($event)"
    >
        Please use a browser that support "canvas"
    </canvas>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {
    createProgram,
    getCubeNormalOnVertices,
    initVertexBufForLaterUse,
    initAttributeVariable
} from './scripts/webglUtils'
import vertShaderSource from './shaders/main.vert'
import fragShaderSource from './shaders/main.frag'
import {mat4} from 'gl-matrix'
import {VertexInfo} from './scripts/types'

onMounted(() => {
    canvas = canvasRef.value as HTMLCanvasElement
    initDraw()
})

declare global {
    interface WebGLProgram {
        a_Position: number
        a_Normal: number
        u_MvpMatrix: WebGLUniformLocation | null
        u_modelMatrix: WebGLUniformLocation | null
        u_normalMatrix: WebGLUniformLocation | null
        u_LightPosition: WebGLUniformLocation | null
        u_ViewPosition: WebGLUniformLocation | null
        u_Ka: WebGLUniformLocation | null
        u_Kd: WebGLUniformLocation | null
        u_Ks: WebGLUniformLocation | null
        u_shininess: WebGLUniformLocation | null
        u_Color: WebGLUniformLocation | null
    }
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let canvas: HTMLCanvasElement
let gl: WebGLRenderingContext
let program: WebGLProgram

let cube: VertexInfo[] = []
let angleX = 0, angleY = 0

const initDraw = () => {
    gl = canvas.getContext('webgl') as WebGLRenderingContext
    gl.enable(gl.DEPTH_TEST)

    program = createProgram(gl, vertShaderSource, fragShaderSource)
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal');
    program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    program.u_normalMatrix = gl.getUniformLocation(program, 'u_normalMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka');
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');
    program.u_Color = gl.getUniformLocation(program, 'u_Color');

    let cubeVertices = [
        1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, //front
        1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, //right
        1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, //up
        -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, //left
        -1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, //bottom
        1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0 //back
    ]
    let cubeNormals = getCubeNormalOnVertices(cubeVertices)
    let o = initVertexBufForLaterUse(gl, cubeVertices, cubeNormals, null)
    cube.push(o)

    draw()
}

const draw = () => {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    let mdlMatrix = mat4.create()
    mat4.scale(mdlMatrix, mdlMatrix, [1.5, 0.1, 1.5])
    drawOneObject(cube, mdlMatrix, 1.0, 0.4, 0.4)
}

//obj: the object components
//mdlMatrix: the model matrix without mouse rotation
//colorR, G, B: object color
const drawOneObject = (obj: VertexInfo[], mdlMatrix: mat4, colorR: number, colorG: number, colorB: number) => {
    let cameraX = 0, cameraY = 3, cameraZ = 7

    //model Matrix (part of the mvp matrix)
    let modelMatrix = mat4.create()
    mat4.fromRotation(modelMatrix, angleToRadian(angleY), [1, 0, 0])
    mat4.rotate(modelMatrix, modelMatrix, angleToRadian(angleX), [0, 1, 0])
    mat4.multiply(modelMatrix, modelMatrix, mdlMatrix)

    //mvp: projection * view * model matrix
    let proMatrix = mat4.create()
    let viewMatrix = mat4.create()
    let mvpMatrix = mat4.create()
    mat4.perspective(proMatrix, angleToRadian(30), 1, 0.1, 100)
    mat4.lookAt(viewMatrix, [cameraX, cameraY, cameraZ], [0, 0, 0], [0, 1, 0])
    mat4.multiply(mvpMatrix, proMatrix, viewMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

    // normal matrix
    let normalMatrix = mat4.create()
    mat4.invert(normalMatrix, modelMatrix)
    mat4.transpose(normalMatrix, normalMatrix)

    gl.uniform3f(program.u_LightPosition, 0, 5, 3)
    gl.uniform3f(program.u_ViewPosition, cameraX, cameraY, cameraZ)
    gl.uniform1f(program.u_Ka, 0.2)
    gl.uniform1f(program.u_Kd, 0.7)
    gl.uniform1f(program.u_Ks, 1.0)
    gl.uniform1f(program.u_shininess, 10.0)
    gl.uniform3f(program.u_Color, colorR, colorG, colorB)

    gl.uniformMatrix4fv(program.u_MvpMatrix, false, mvpMatrix)
    gl.uniformMatrix4fv(program.u_modelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(program.u_normalMatrix, false, normalMatrix)

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer)
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer)
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices)
    }
}

let mouseLastX: number
let mouseLastY: number
let mouseDragging = false

const mouseDown = (ev: MouseEvent) => {
    let x = ev.clientX;
    let y = ev.clientY;
    let rect = (ev.target as HTMLElement).getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
        mouseLastX = x;
        mouseLastY = y;
        mouseDragging = true;
    }
}

const mouseUp = () => {
    mouseDragging = false;
}

function mouseMove(ev: MouseEvent) {
    let x = ev.clientX;
    let y = ev.clientY;
    if (mouseDragging) {
        const factor = 100 / canvas.height; //100 determine the speed you rotate the object
        const dx = factor * (x - mouseLastX);
        const dy = factor * (y - mouseLastY);

        angleX += dx; //yes, x for y, y for x, this is right
        angleY += dy;
    }
    mouseLastX = x;
    mouseLastY = y;
    draw();
}

const angleToRadian = (angle: number) => {
    return angle * Math.PI / 180
}
</script>
