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
    initAttributeVariable,
    initFramebuffer,
    loadOBJtoCreateVBO
} from './scripts/webglUtils'
import {degToRad} from './scripts/utils'
import mainVert from './shaders/main.vert'
import mainFrag from './shaders/main.frag'
import quadVert from './shaders/quad.vert'
import quadFrag from './shaders/quad.frag'
import {mat4, vec4} from 'gl-matrix'
import {VertexInfo, FramebufferInfo} from './scripts/types'

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
let quadProgram: WebGLProgram

let cubeObj: VertexInfo[] = []
let taroumaruObj: VertexInfo[] = []
let angleX = 0, angleY = 0
let textures = new Map<string, WebGLTexture>()
let objCompImgIndex: string[] = []
let imgNames: string[] = []

onMounted(async () => {
    canvas = canvasRef.value as HTMLCanvasElement
    gl = canvas.getContext('webgl') as WebGLRenderingContext
    gl.enable(gl.DEPTH_TEST)

    initProgram()

    cubeObj = await loadOBJtoCreateVBO(gl, 'cube.obj')

    taroumaruObj = await loadOBJtoCreateVBO(gl, 'taroumaru/taroumaru.obj')
    let taroumaruObjTxt = await (await fetch('taroumaru/taroumaru.obj')).text()
    let taroumaruMtlTxt = await (await fetch('taroumaru/taroumaru.mtl')).text()
    objCompImgIndex = parseTexture(taroumaruObjTxt, taroumaruMtlTxt)
    imgNames = Array.from(new Set(objCompImgIndex))
    for (let i = 0; i < imgNames.length; i++) {
        let img = new Image()
        img.onload = function () {
            initTexture(gl, img, imgNames[i])
        }
        img.src = 'taroumaru/' + imgNames[i]
    }

    draw()
})

const initTexture = (gl: WebGLRenderingContext, img: HTMLImageElement, imgName: string) => {
    let tex = gl.createTexture()
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    if (tex) textures.set(imgName, tex)
}

const parseTexture = (objContent: string, mtlContent: string): string[] => {
    const usemtls: string[] = []
    const objLines = objContent.split('\n')
    objLines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'usemtl') {
            usemtls.push(parts[1]);
        }
    });

    const mtlLines = mtlContent.split('\n')
    const textureMap = new Map<string, string>()
    let currentMtl = ''
    mtlLines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'newmtl') {
            currentMtl = parts[1]
        } else if (parts[0] === 'map_Kd' && currentMtl !== '') {
            textureMap.set(currentMtl, parts[1])
        }
    });

    const result: string[] = []
    usemtls.forEach(usemtl => {
        const texture = textureMap.get(usemtl)
        if (texture) {
            result.push(texture)
        }
    })
    return result
}

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

    quadProgram = createProgram(gl, quadVert, quadFrag)
    quadProgram.a_Position = gl.getAttribLocation(quadProgram, 'a_Position');
    quadProgram.a_TexCoord = gl.getAttribLocation(quadProgram, 'a_TexCoord');
    quadProgram.a_Normal = gl.getAttribLocation(quadProgram, 'a_Normal');
    quadProgram.u_MvpMatrix = gl.getUniformLocation(quadProgram, 'u_MvpMatrix');
    quadProgram.u_modelMatrix = gl.getUniformLocation(quadProgram, 'u_modelMatrix');
    quadProgram.u_normalMatrix = gl.getUniformLocation(quadProgram, 'u_normalMatrix');
    quadProgram.u_LightPosition = gl.getUniformLocation(quadProgram, 'u_LightPosition');
    quadProgram.u_ViewPosition = gl.getUniformLocation(quadProgram, 'u_ViewPosition');
    quadProgram.u_Ka = gl.getUniformLocation(quadProgram, 'u_Ka');
    quadProgram.u_Kd = gl.getUniformLocation(quadProgram, 'u_Kd');
    quadProgram.u_Ks = gl.getUniformLocation(quadProgram, 'u_Ks');
    quadProgram.u_shininess = gl.getUniformLocation(quadProgram, 'u_shininess');
    quadProgram.u_Sampler0 = gl.getUniformLocation(quadProgram, "u_Sampler0")
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

const draw = () => {
    let fbo = initFramebuffer(gl, 512, 512)

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
    gl.viewport(0, 0, 512, 512)
    camera = [7, 3, 7]
    drawAll()
    camera = [0, 3, 7]

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    drawAll()

    drawQuad(fbo)
}

const drawAll = () => {
    gl.clearColor(0.6, 0.6, 0.6, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    let mdlMatrix = mat4.create()

    // draw the ground
    mat4.translate(mdlMatrix, mdlMatrix, [0, -1, 0])
    mat4.scale(mdlMatrix, mdlMatrix, [1.5, 0.1, 1.5])
    drawOneObject(cubeObj, mdlMatrix, 1.0, 0.4, 0.4, true)

    // draw the cube on the light source
    mat4.identity(mdlMatrix)
    mat4.translate(mdlMatrix, mdlMatrix, new Float32Array(light))
    mat4.scale(mdlMatrix, mdlMatrix, [0.1, 0.1, 0.1])
    drawOneObject(cubeObj, mdlMatrix, 0.9, 0.9, 0.3, false)

    drawCar()
    drawItem()
    drawTaroumaru()
}

const drawCar = () => {
    let carMdlMatrix = mat4.create()
    mat4.identity(carMdlMatrix)
    // body
    mat4.translate(carMdlMatrix, carMdlMatrix, [carX, -0.6, carZ])
    let carBodyMdlMatrix = mat4.clone(carMdlMatrix)
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.4, 0.1, 0.2])
    drawOneObject(cubeObj, carMdlMatrix, 0.4, 0.4, 1.0, true)
    // wheels
    for (let i = 0; i < 4; i++) {
        mat4.copy(carMdlMatrix, carBodyMdlMatrix)
        let x = i < 2 ? 0.3 : -0.3
        let z = i % 2 === 0 ? 0.15 : -0.15
        mat4.translate(carMdlMatrix, carMdlMatrix, [x, -0.2, z])
        mat4.scale(carMdlMatrix, carMdlMatrix, [0.1, 0.1, 0.05])
        drawOneObject(cubeObj, carMdlMatrix, 1, 1, 1, true)
    }
    // arm1
    mat4.copy(carMdlMatrix, carBodyMdlMatrix)
    mat4.translate(carMdlMatrix, carMdlMatrix, [-0.35, 0.15, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[0]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cubeObj, carMdlMatrix, 0.5, 1, 0, true)
    // arm2
    mat4.scale(carMdlMatrix, carMdlMatrix, [1 / 0.05, 1 / 0.2, 1 / 0.05])
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[1]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.2, 0])
    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cubeObj, carMdlMatrix, 0.5, 0, 1, true)
    // arm3
    mat4.scale(carMdlMatrix, carMdlMatrix, [1 / 0.05, 1 / 0.2, 1 / 0.05])
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.2, 0])
    mat4.rotateZ(carMdlMatrix, carMdlMatrix, degToRad(carAngle[2]))
    mat4.translate(carMdlMatrix, carMdlMatrix, [0, 0.15, 0])

    // calculate the hand position
    handPos = vec4.fromValues(0, 0.15, 0, 1)
    vec4.transformMat4(handPos, handPos, carMdlMatrix)

    mat4.scale(carMdlMatrix, carMdlMatrix, [0.05, 0.2, 0.05])
    drawOneObject(cubeObj, carMdlMatrix, 1, 0.5, 0, true)
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
    drawOneObject(cubeObj, itemMdlMatrix, bodyColor[0], bodyColor[1], bodyColor[2], true)

    for (let i = 0; i < 2; ++i) {
        mat4.copy(itemMdlMatrix, itemBodyMdlMatrix)
        const z = i === 0 ? 0.2 : -0.2
        mat4.translate(itemMdlMatrix, itemMdlMatrix, [0, 0.15, z])
        mat4.rotateZ(itemMdlMatrix, itemMdlMatrix, degToRad(itemAngle[i]))
        mat4.translate(itemMdlMatrix, itemMdlMatrix, [0, 0.15, 0])
        mat4.scale(itemMdlMatrix, itemMdlMatrix, [0.05, 0.15, 0.05])
        drawOneObject(cubeObj, itemMdlMatrix, 0.3, 1, 0.8, true)
    }
}

const drawTaroumaru = () => {
    gl.useProgram(quadProgram)

    let mdlMatrix = mat4.create()
    mat4.translate(mdlMatrix, mdlMatrix, [1, -0.9, 1])
    mat4.rotateY(mdlMatrix, mdlMatrix, degToRad(-30))

    drawWithTexture(
        taroumaruObj,
        mdlMatrix,
        taroumaruObj.map((_, i) => textures.get(objCompImgIndex[i]) as WebGLTexture),
        true
    )
}

const drawQuad = (fbo: FramebufferInfo) => {
    let mdlMatrix = mat4.create()
    mat4.translate(mdlMatrix, mdlMatrix, [0, 0, -1.5])
    mat4.scale(mdlMatrix, mdlMatrix, [1.5, 1, 0.01])
    drawWithTexture(cubeObj, mdlMatrix, new Array(fbo.texture), true)
}

// obj: the object components
// mdlMatrix: the model matrix without mouse rotation
// colorR, G, B: object color
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
    gl.useProgram(quadProgram)
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

    gl.uniform3f(quadProgram.u_LightPosition, light[0], light[1], light[2])
    gl.uniform3f(quadProgram.u_ViewPosition, camera[0], camera[1], camera[2])
    gl.uniform1f(quadProgram.u_Ka, 0.2)
    gl.uniform1f(quadProgram.u_Kd, 0.7)
    gl.uniform1f(quadProgram.u_Ks, 1.0)
    gl.uniform1f(quadProgram.u_shininess, 10.0)

    gl.uniformMatrix4fv(quadProgram.u_MvpMatrix, false, mvpMatrix)
    gl.uniformMatrix4fv(quadProgram.u_modelMatrix, false, modelMatrix)
    gl.uniformMatrix4fv(quadProgram.u_normalMatrix, false, normalMatrix)

    for (let i = 0; i < obj.length; i++) {
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, textures[i])
        gl.uniform1i(quadProgram.u_Sampler0, 0);

        initAttributeVariable(gl, quadProgram.a_Position, obj[i].vertexBuffer)
        initAttributeVariable(gl, quadProgram.a_TexCoord, obj[i].texCoordBuffer);
        initAttributeVariable(gl, quadProgram.a_Normal, obj[i].normalBuffer)
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
</script>
