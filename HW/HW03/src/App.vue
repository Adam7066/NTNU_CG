<template>
    <div class="mx-4 my-2">
        <div class="font-semibold text-blue-500">操控說明：</div>
        <div>視角：滑鼠拖曳，回正 => R</div>
        <div>Robot: 移動 => WASD，旋轉手臂 => UJ / IK / OL</div>
        <div>Object: 旋轉手臂 => TY</div>
        <div>縮放：{{ zoom / 10 }}</div>
        <input type="range" v-model="zoom" min="5" max="15"/>
    </div>
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
import {onKeyStroke} from '@vueuse/core'
import {
    createProgram,
    getCubeNormalOnVertices,
    initVertexBufForLaterUse,
    initAttributeVariable,
    degToRad
} from './scripts/webglUtils'
import vertShaderSource from './shaders/main.vert'
import fragShaderSource from './shaders/main.frag'
import {mat4, vec4} from 'gl-matrix'
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

let camera = [0, 3, 7]
let light = [1, 1.5, 1.5]
let carX = 0.8, carZ = 0
let carAngle = [40, 50, 40]
let carAngleLimit = [60, 60, 60]
let itemAngle = [110, 110]
let itemXYZ = [-1, -0.75, 0]
let handPos: vec4
let itemPos: vec4
let isTouch = false
let isGrab = false

const zoom = ref(10)
watch(zoom, () => {
    draw()
})

onKeyStroke(['w', 'W'], () => {
    if (carZ >= -1.1) carZ -= 0.1
    draw()
})
onKeyStroke(['s', 'S'], () => {
    if (carZ <= 1.1) carZ += 0.1
    draw()
})
onKeyStroke(['a', 'A'], () => {
    if (carX >= -0.9) carX -= 0.1
    draw()
})
onKeyStroke(['d', 'D'], () => {
    if (carX <= 0.9) carX += 0.1
    draw()
})
onKeyStroke(['r', 'R'], () => {
    angleX = 0
    angleY = 0
    draw()
})
onKeyStroke(['u', 'U'], () => {
    if (carAngle[0] < carAngleLimit[0]) carAngle[0] += 10
    draw()
})
onKeyStroke(['j', 'J'], () => {
    if (carAngle[0] > -carAngleLimit[0]) carAngle[0] -= 10
    draw()
})
onKeyStroke(['i', 'I'], () => {
    if (carAngle[1] < carAngleLimit[1]) carAngle[1] += 10
    draw()
})
onKeyStroke(['k', 'K'], () => {
    if (carAngle[1] > -carAngleLimit[1]) carAngle[1] -= 10
    draw()
})
onKeyStroke(['o', 'O'], () => {
    if (carAngle[2] < carAngleLimit[2]) carAngle[2] += 10
    draw()
})
onKeyStroke(['l', 'L'], () => {
    if (carAngle[2] > -carAngleLimit[2]) carAngle[2] -= 10
    draw()
})
onKeyStroke(['t', 'T'], () => {
    itemAngle[0] -= 10
    if (itemAngle[0] == 0) itemAngle[0] = 360;
    draw()
})
onKeyStroke(['y', 'Y'], () => {
    itemAngle[1] -= 10
    if (itemAngle[1] == 0) itemAngle[1] = 360;
    draw()
})
onKeyStroke(['g', 'G'], () => {
    if (isTouch) isGrab = !isGrab
    draw()
})

const draw = () => {
    gl.clearColor(0.2, 0.2, 0.2, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    let mdlMatrix = mat4.create()

    // draw the ground
    mat4.translate(mdlMatrix, mdlMatrix, [0, -1, 0])
    mat4.scale(mdlMatrix, mdlMatrix, [1.5, 0.1, 1.5])
    drawOneObject(cube, mdlMatrix, 1.0, 0.4, 0.4, true)

    // draw the cube on the light source
    mat4.identity(mdlMatrix)
    mat4.translate(mdlMatrix, mdlMatrix, new Float32Array(light))
    mat4.scale(mdlMatrix, mdlMatrix, [0.1, 0.1, 0.1])
    drawOneObject(cube, mdlMatrix, 0.9, 0.9, 0.3, false)

    drawCar()
    drawItem()
}

const drawCar = () => {
    let carMdlMatrix = mat4.create()
    mat4.identity(carMdlMatrix)
    // body
    mat4.translate(carMdlMatrix, carMdlMatrix, [carX, -0.6, carZ])
    let carBodyMdlMatrix = mat4.clone(carMdlMatrix)
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.4, 0.1, 0.2])
    drawOneObject(cube, carMdlMatrix, 0.4, 0.4, 1.0, true)
    // wheels
    for (let i = 0; i < 4; i++) {
        mat4.copy(carMdlMatrix, carBodyMdlMatrix)
        let x = i < 2 ? 0.3 : -0.3
        let z = i % 2 === 0 ? 0.15 : -0.15
        mat4.translate(carMdlMatrix, carMdlMatrix, [x, -0.2, z])
        mat4.scale(carMdlMatrix, carMdlMatrix, [0.1, 0.1, 0.05])
        drawOneObject(cube, carMdlMatrix, 1, 1, 1, true)
    }
    // arm1
    mat4.copy(carMdlMatrix, carBodyMdlMatrix)
    mat4.translate(carMdlMatrix, carMdlMatrix, [-0.35, 0.15, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[0]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cube, carMdlMatrix, 0.5, 1, 0, true)
    // arm2
    mat4.scale(carMdlMatrix, carMdlMatrix, [1 / 0.05, 1 / 0.2, 1 / 0.05])
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[1]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.2, 0])
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cube, carMdlMatrix, 0.5, 0, 1, true)
    // arm3
    mat4.scale(carMdlMatrix, carMdlMatrix, [1 / 0.05, 1 / 0.2, 1 / 0.05])
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.2, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[2]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])

    // calculate the hand position
    handPos = vec4.fromValues(0, 0.15, 0, 1)
    vec4.transformMat4(handPos, handPos, carMdlMatrix)

    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cube, carMdlMatrix, 1, 0.5, 0, true)
}

const drawItem = () => {
    let itemMdlMatrix = mat4.create()
    mat4.identity(itemMdlMatrix)
    mat4.translate(itemMdlMatrix, itemMdlMatrix, new Float32Array(itemXYZ))

    itemPos = vec4.fromValues(0, 0, 0, 1)
    vec4.transformMat4(itemPos, itemPos, itemMdlMatrix)

    let dist = vec4.distance(handPos, itemPos)
    let bodyColor = [0.5, 0.5, 0.5]
    if (isGrab) {
        for (let i = 0; i < 3; ++i)
            itemXYZ[i] = handPos[i]
        bodyColor = [0.9, 0.3, 0.9]
    } else if (dist < 0.2) {
        isTouch = true
        bodyColor = [0.9, 0.9, 0.3]
    } else {
        isTouch = false
    }

    mat4.identity(itemMdlMatrix)
    mat4.translate(itemMdlMatrix, itemMdlMatrix, new Float32Array(itemXYZ))
    let itemBodyMdlMatrix = mat4.clone(itemMdlMatrix)
    mat4.scale(itemMdlMatrix, itemMdlMatrix, [0.15, 0.15, 0.15])
    drawOneObject(cube, itemMdlMatrix, bodyColor[0], bodyColor[1], bodyColor[2], true)

    for (let i = 0; i < 2; ++i) {
        mat4.copy(itemMdlMatrix, itemBodyMdlMatrix)
        const z = i === 0 ? 0.2 : -0.2
        mat4.translate(itemMdlMatrix, itemMdlMatrix, [0, 0.15, z])
        mat4.rotateZ(itemMdlMatrix, itemMdlMatrix, degToRad(itemAngle[i]))
        mat4.translate(itemMdlMatrix, itemMdlMatrix, [0, 0.15, 0])
        mat4.scale(itemMdlMatrix, itemMdlMatrix, [0.05, 0.15, 0.05])
        drawOneObject(cube, itemMdlMatrix, 0.3, 1, 0.8, true)
    }
}

// obj: the object components
// mdlMatrix: the model matrix without mouse rotation
// colorR, G, B: object color
const drawOneObject = (obj: VertexInfo[], mdlMatrix: mat4, colorR: number, colorG: number, colorB: number, mouseRotation: boolean) => {
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
