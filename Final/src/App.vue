<template>
    <canvas ref="canvasRef" width="600" height="600"
            @mousedown="mouseDown($event)"
            @mouseup="mouseUp()"
            @mousemove="mouseMove($event)"
    >
        Please use a browser that support "canvas"
    </canvas>
</template>

<script setup lang="ts">
import {onMounted, ref, watch} from 'vue'
import {
    createProgram,
    initAttributeVariable,
    loadOBJtoCreateVBO
} from './scripts/webglUtils'
import {degToRad} from './scripts/utils'
import mainVert from './shaders/main.vert'
import mainFrag from './shaders/main.frag'
import texVert from './shaders/tex.vert'
import texFrag from './shaders/tex.frag'
import {mat4} from 'gl-matrix'
import {VertexInfo} from './scripts/types'

declare global {
    interface WebGLProgram {
        a_Position: number
        a_TexCoord: number
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
        u_Sampler0: WebGLUniformLocation | null
    }
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let canvas: HTMLCanvasElement
let gl: WebGLRenderingContext
let program: WebGLProgram
let texProgram: WebGLProgram

let angleX = 0, angleY = 0
let cubeObj: VertexInfo[] = []

onMounted(async () => {
    canvas = canvasRef.value as HTMLCanvasElement
    gl = canvas.getContext('webgl') as WebGLRenderingContext
    gl.enable(gl.DEPTH_TEST)

    initProgram()

    cubeObj = await loadOBJtoCreateVBO(gl, 'cube.obj')

    draw()
})

const initProgram = () => {
    program = createProgram(gl, mainVert, mainFrag)
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

    texProgram = createProgram(gl, texVert, texFrag)
    texProgram.a_Position = gl.getAttribLocation(texProgram, 'a_Position');
    texProgram.a_TexCoord = gl.getAttribLocation(texProgram, 'a_TexCoord');
    texProgram.a_Normal = gl.getAttribLocation(texProgram, 'a_Normal');
    texProgram.u_MvpMatrix = gl.getUniformLocation(texProgram, 'u_MvpMatrix');
    texProgram.u_modelMatrix = gl.getUniformLocation(texProgram, 'u_modelMatrix');
    texProgram.u_normalMatrix = gl.getUniformLocation(texProgram, 'u_normalMatrix');
    texProgram.u_LightPosition = gl.getUniformLocation(texProgram, 'u_LightPosition');
    texProgram.u_ViewPosition = gl.getUniformLocation(texProgram, 'u_ViewPosition');
    texProgram.u_Ka = gl.getUniformLocation(texProgram, 'u_Ka');
    texProgram.u_Kd = gl.getUniformLocation(texProgram, 'u_Kd');
    texProgram.u_Ks = gl.getUniformLocation(texProgram, 'u_Ks');
    texProgram.u_shininess = gl.getUniformLocation(texProgram, 'u_shininess');
    texProgram.u_Sampler0 = gl.getUniformLocation(texProgram, "u_Sampler0")
}

let camera = [0, 3, 7]
let light = [1, 1.5, 1.5]
const zoom = ref(10)
watch(zoom, () => {
    draw()
})

const draw = () => {
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    let mdlMatrix = mat4.create()
    mat4.translate(mdlMatrix, mdlMatrix, [0, 0, 0])
    drawOneObject(cubeObj, mdlMatrix, 1, 0, 0, true)
}

const drawOneObject = (obj: VertexInfo[], mdlMatrix: mat4, colorR: number, colorG: number, colorB: number, mouseRotation: boolean) => {
    gl.useProgram(program)

    // model Matrix (part of the mvp matrix)
    let modelMatrix = mat4.create()

    if (mouseRotation) {
        mat4.fromRotation(modelMatrix, degToRad(angleY), [1, 0, 0])
        mat4.rotate(modelMatrix, modelMatrix, degToRad(angleX), [0, 1, 0])
    }

    let zoomVal = zoom.value / 10
    mat4.scale(modelMatrix, modelMatrix, [zoomVal, zoomVal, zoomVal])

    mat4.multiply(modelMatrix, modelMatrix, mdlMatrix)

    // mvp: projection * view * model matrix
    let proMatrix = mat4.create()
    let viewMatrix = mat4.create()
    let mvpMatrix = mat4.create()
    mat4.perspective(proMatrix, degToRad(30), 1, 0.1, 100)
    mat4.lookAt(viewMatrix, new Float32Array(camera), [0, 0, 0], [0, 1, 0])
    mat4.multiply(mvpMatrix, proMatrix, viewMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

    // normal matrix
    let normalMatrix = mat4.create()
    mat4.invert(normalMatrix, modelMatrix)
    mat4.transpose(normalMatrix, normalMatrix)

    gl.uniform3f(program.u_LightPosition, light[0], light[1], light[2])
    gl.uniform3f(program.u_ViewPosition, camera[0], camera[1], camera[2])
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

const drawWithTexture = (obj: VertexInfo[], mdlMatrix: mat4, textures: WebGLTexture[], mouseRotation: boolean) => {
    gl.useProgram(texProgram)

    // model Matrix (part of the mvp matrix)
    let modelMatrix = mat4.create()

    if (mouseRotation) {
        mat4.fromRotation(modelMatrix, degToRad(angleY), [1, 0, 0])
        mat4.rotate(modelMatrix, modelMatrix, degToRad(angleX), [0, 1, 0])
    }

    let zoomVal = zoom.value / 10
    mat4.scale(modelMatrix, modelMatrix, [zoomVal, zoomVal, zoomVal])

    mat4.multiply(modelMatrix, modelMatrix, mdlMatrix)

    // mvp: projection * view * model matrix
    let proMatrix = mat4.create()
    let viewMatrix = mat4.create()
    let mvpMatrix = mat4.create()
    mat4.perspective(proMatrix, degToRad(30), 1, 0.1, 100)
    mat4.lookAt(viewMatrix, new Float32Array(camera), [0, 0, 0], [0, 1, 0])
    mat4.multiply(mvpMatrix, proMatrix, viewMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

    // normal matrix
    let normalMatrix = mat4.create()
    mat4.invert(normalMatrix, modelMatrix)
    mat4.transpose(normalMatrix, normalMatrix)

    gl.uniform3f(texProgram.u_LightPosition, light[0], light[1], light[2])
    gl.uniform3f(texProgram.u_ViewPosition, camera[0], camera[1], camera[2])
    gl.uniform1f(texProgram.u_Ka, 0.2)
    gl.uniform1f(texProgram.u_Kd, 0.7)
    gl.uniform1f(texProgram.u_Ks, 1.0)
    gl.uniform1f(texProgram.u_shininess, 10.0)

    gl.uniformMatrix4fv(texProgram.u_MvpMatrix, false, mvpMatrix)
    gl.uniformMatrix4fv(texProgram.u_modelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(texProgram.u_normalMatrix, false, normalMatrix)

    for (let i = 0; i < obj.length; i++) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, textures[i])
        gl.uniform1i(texProgram.u_Sampler0, 0);

        initAttributeVariable(gl, texProgram.a_Position, obj[i].vertexBuffer)
        initAttributeVariable(gl, texProgram.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, texProgram.a_Normal, obj[i].normalBuffer)
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
        const factor = 100 / canvas.height; // 100 determine the speed you rotate the object
        const dx = factor * (x - mouseLastX);
        const dy = factor * (y - mouseLastY);
        angleX += dx;
        angleY += dy;
    }
    mouseLastX = x;
    mouseLastY = y;
    draw();
}
</script>
