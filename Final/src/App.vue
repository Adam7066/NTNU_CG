<template>
    <div class="m-4 py-2 px-4 absolute bottom-0 bg-gray-500/80 rounded-xl font-extrabold text-blue-800 text-xl">
        <div>滑鼠可拖動場景</div>
        <div>操控角色：W / S</div>
        <div>切換視角：V</div>
    </div>
    <canvas ref="crosshairRef" :width="25" :height="25"
            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        Please use a browser that support "canvas"
    </canvas>
    <canvas ref="canvasRef" :width="width" :height="height"
            @mousedown="mouseDown($event)"
            @mouseup="mouseUp()"
            @mousemove="mouseMove($event)"
    >
        Please use a browser that support "canvas"
    </canvas>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useWindowSize, onKeyStroke, useRafFn} from '@vueuse/core'
import {
    createProgram,
    initAttributeVariable,
    initVertexBufForLaterUse,
    loadOBJtoCreateVBO,
    initCubeTexture,
    initFrameBufferForCubemapRendering,
    initFramebuffer,
    loadOBJModel
} from './scripts/webglUtils'
import {degToRad} from './scripts/utils'
import mainVert from './shaders/main.vert'
import mainFrag from './shaders/main.frag'
import texVert from './shaders/tex.vert'
import texFrag from './shaders/tex.frag'
import envCubeVert from './shaders/envCube.vert'
import envCubeFrag from './shaders/envCube.frag'
import texOnCubeVert from './shaders/texOnCube.vert'
import texOnCubeFrag from './shaders/texOnCube.frag'
import shadowVert from './shaders/shadow.vert'
import shadowFrag from './shaders/shadow.frag'
import {mat4, vec3} from 'gl-matrix'
import {FramebufferInfo, VertexInfo, ObjInfo} from './scripts/types'

const {width, height} = useWindowSize()

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
        u_MvpMatrixOfLight: WebGLUniformLocation | null
        u_Ka: WebGLUniformLocation | null
        u_Kd: WebGLUniformLocation | null
        u_Ks: WebGLUniformLocation | null
        u_shininess: WebGLUniformLocation | null
        u_Color: WebGLUniformLocation | null
        u_Sampler0: WebGLUniformLocation | null
        u_ShadowMap: WebGLUniformLocation | null
        u_envCubeMap: WebGLUniformLocation | null
        u_viewDirectionProjectionInverse: WebGLUniformLocation | null
    }
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const crosshairRef = ref<HTMLCanvasElement | null>(null)
let canvas: HTMLCanvasElement
let crosshairCanvas: HTMLCanvasElement
let gl: WebGLRenderingContext
let program: WebGLProgram
let texProgram: WebGLProgram
let envCubeProgram: WebGLProgram
let texOnCubeProgram: WebGLProgram
let shadowProgram: WebGLProgram
let fbo: FramebufferInfo
let shadowFbo: FramebufferInfo
let offScreenWidth = 2048
let offScreenHeight = 2048

let angleX = 0, angleY = 0
let cubeObj: VertexInfo[] = []
let quadObj: VertexInfo
let cubeMapTex: WebGLTexture | null
let paimon: ObjInfo
let slime: ObjInfo
let stone: ObjInfo

let cameraIdx = 1
let camera = [0, 0, 5]
let TPVOffset = [0, 0, 2]
let cameraDir = [0, 0, -1]
let light = [-5, 5, 8]
let playerPos = [0, 0, 5]
const slimePos = [[1, 0, 0], [0, 0.5, -1], [-1, -0.5, 0]]
const slimeFloatSpeed = 0.01
const slimeRotateCenter = [0, 0, 0]
let slimeRotateAngle = 0
let stoneRotateAngle = 0

onMounted(async () => {
        crosshairCanvas = crosshairRef.value as HTMLCanvasElement
        const crosshairCtx = crosshairCanvas.getContext('2d') as CanvasRenderingContext2D
        const centerX = crosshairCanvas.width / 2
        const centerY = crosshairCanvas.height / 2
        const size = 50
        const color = 'red'
        crosshairCtx.beginPath();
        crosshairCtx.moveTo(centerX - size / 2, centerY);
        crosshairCtx.lineTo(centerX + size / 2, centerY);
        crosshairCtx.strokeStyle = color;
        crosshairCtx.stroke();
        crosshairCtx.beginPath();
        crosshairCtx.moveTo(centerX, centerY - size / 2);
        crosshairCtx.lineTo(centerX, centerY + size / 2);
        crosshairCtx.strokeStyle = color;
        crosshairCtx.stroke();


        canvas = canvasRef.value as HTMLCanvasElement
        gl = canvas.getContext('webgl') as WebGLRenderingContext
        gl.enable(gl.DEPTH_TEST)

        initProgram()

        fbo = initFrameBufferForCubemapRendering(gl, offScreenWidth, offScreenHeight)
        shadowFbo = initFramebuffer(gl, offScreenWidth, offScreenHeight)

        cubeMapTex = initCubeTexture(gl,
            "posx.jpg", "negx.jpg",
            "posy.jpg", "negy.jpg",
            "posz.jpg", "negz.jpg",
            2048, 2048
        )

        const cubeObjTxt = await (await fetch('cube.obj')).text()
        cubeObj = await loadOBJtoCreateVBO(gl, cubeObjTxt)

        const quad = [
            -1, -1, 1,
            1, -1, 1,
            -1, 1, 1,
            -1, 1, 1,
            1, -1, 1,
            1, 1, 1
        ]
        quadObj = initVertexBufForLaterUse(gl, quad, null, null)

        paimon = await loadOBJModel(gl, 'paimon', 'paimon/paimon.obj', 'paimon/paimon.mtl')
        slime = await loadOBJModel(gl, 'slime', 'slime/slime.obj', 'slime/slime.mtl')
        stone = await loadOBJModel(gl, 'stone', 'stone/stone.obj', 'stone/stone.mtl')

        draw()
    }
)

const initProgram = () => {
    program = createProgram(gl, mainVert, mainFrag)
    program.a_Position = gl.getAttribLocation(program, 'a_Position');
    program.a_Normal = gl.getAttribLocation(program, 'a_Normal');
    program.u_MvpMatrix = gl.getUniformLocation(program, 'u_MvpMatrix');
    program.u_modelMatrix = gl.getUniformLocation(program, 'u_modelMatrix');
    program.u_normalMatrix = gl.getUniformLocation(program, 'u_normalMatrix');
    program.u_LightPosition = gl.getUniformLocation(program, 'u_LightPosition');
    program.u_ViewPosition = gl.getUniformLocation(program, 'u_ViewPosition');
    program.u_MvpMatrixOfLight = gl.getUniformLocation(program, 'u_MvpMatrixOfLight');
    program.u_Ka = gl.getUniformLocation(program, 'u_Ka');
    program.u_Kd = gl.getUniformLocation(program, 'u_Kd');
    program.u_Ks = gl.getUniformLocation(program, 'u_Ks');
    program.u_shininess = gl.getUniformLocation(program, 'u_shininess');
    program.u_ShadowMap = gl.getUniformLocation(program, "u_ShadowMap");
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
    texProgram.u_MvpMatrixOfLight = gl.getUniformLocation(texProgram, 'u_MvpMatrixOfLight');
    texProgram.u_Ka = gl.getUniformLocation(texProgram, 'u_Ka');
    texProgram.u_Kd = gl.getUniformLocation(texProgram, 'u_Kd');
    texProgram.u_Ks = gl.getUniformLocation(texProgram, 'u_Ks');
    texProgram.u_shininess = gl.getUniformLocation(texProgram, 'u_shininess');
    texProgram.u_Sampler0 = gl.getUniformLocation(texProgram, "u_Sampler0")
    texProgram.u_ShadowMap = gl.getUniformLocation(texProgram, "u_ShadowMap");

    envCubeProgram = createProgram(gl, envCubeVert, envCubeFrag)
    envCubeProgram.a_Position = gl.getAttribLocation(envCubeProgram, 'a_Position');
    envCubeProgram.u_envCubeMap = gl.getUniformLocation(envCubeProgram, 'u_envCubeMap');
    envCubeProgram.u_viewDirectionProjectionInverse = gl.getUniformLocation(envCubeProgram, 'u_viewDirectionProjectionInverse');

    texOnCubeProgram = createProgram(gl, texOnCubeVert, texOnCubeFrag)
    texOnCubeProgram.a_Position = gl.getAttribLocation(texOnCubeProgram, 'a_Position');
    texOnCubeProgram.a_Normal = gl.getAttribLocation(texOnCubeProgram, 'a_Normal');
    texOnCubeProgram.u_MvpMatrix = gl.getUniformLocation(texOnCubeProgram, 'u_MvpMatrix');
    texOnCubeProgram.u_modelMatrix = gl.getUniformLocation(texOnCubeProgram, 'u_modelMatrix');
    texOnCubeProgram.u_normalMatrix = gl.getUniformLocation(texOnCubeProgram, 'u_normalMatrix');
    texOnCubeProgram.u_ViewPosition = gl.getUniformLocation(texOnCubeProgram, 'u_ViewPosition');
    texOnCubeProgram.u_envCubeMap = gl.getUniformLocation(texOnCubeProgram, 'u_envCubeMap');
    texOnCubeProgram.u_Color = gl.getUniformLocation(texOnCubeProgram, 'u_Color');

    shadowProgram = createProgram(gl, shadowVert, shadowFrag)
    shadowProgram.a_Position = gl.getAttribLocation(shadowProgram, 'a_Position');
    shadowProgram.u_MvpMatrix = gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');
}

const frames = ref(0)
const {} = useRafFn(() => {
    frames.value++
    slimeRotateAngle += 0.3
    stoneRotateAngle += 0.5
})

const draw = () => {

    // For Shadow
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFbo.framebuffer)
    gl.viewport(0, 0, offScreenWidth, offScreenHeight)
    gl.clearColor(0.4, 0.4, 0.4, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)

    let playerMvpFromLight = drawShadow(paimon.obj, getPlayerMdlMatrix())
    let cubeMvpFromLight = drawShadow(cubeObj, getCubeMdlMatrix())
    let stoneMvpFromLight = drawShadow(stone.obj, getStoneMdlMatrix())
    // slime
    let slimeMvpFromLight: mat4[] = []
    getSlimeMdlMatrix().forEach((mdlMatrix, _) => {
        slimeMvpFromLight.push(drawShadow(slime.obj, mdlMatrix))
    })

    //========================================//
    let mvpFromLight = [
        playerMvpFromLight,
        cubeMvpFromLight,
        stoneMvpFromLight,
        ...slimeMvpFromLight
    ]
    renderCubeMap(0, 0, 0, mvpFromLight)


    // For main scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.4, 0.4, 0.4, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)

    let vpMatrix = getVPMatrix(true)
    drawWithTexture(
        paimon.obj,
        getPlayerMdlMatrix(),
        vpMatrix,
        playerMvpFromLight,
        paimon.obj.map((_, i) => paimon.textures.get(paimon.objCompImgIdx[i]) as WebGLTexture)
    )
    vpMatrix = getVPMatrix(false)
    drawEnvCube(vpMatrix)
    drawOneObject(cubeObj, getCubeMdlMatrix(), vpMatrix, cubeMvpFromLight, 0.8, 0.5, 0.7)
    drawWithTexture(
        stone.obj,
        getStoneMdlMatrix(),
        vpMatrix,
        stoneMvpFromLight,
        stone.obj.map((_, i) => stone.textures.get(stone.objCompImgIdx[i]) as WebGLTexture)
    )
    // slime
    for (let i = 0; i < slimePos.length; i++) {
        drawWithTexture(
            slime.obj,
            getSlimeMdlMatrix()[i],
            vpMatrix,
            slimeMvpFromLight[i],
            slime.obj.map((_, j) => slime.textures.get(slime.objCompImgIdx[j]) as WebGLTexture)
        )
    }

    let drMdlMatrix = mat4.create()
    mat4.translate(drMdlMatrix, drMdlMatrix, new Float32Array(slimeRotateCenter))
    mat4.scale(drMdlMatrix, drMdlMatrix, [0.4, 0.4, 0.4])
    drawObjectWithDynamicReflection(cubeObj, drMdlMatrix, vpMatrix, 1, 1, 1)
}

const getPlayerMdlMatrix = (): mat4 => {
    let playerMdlMatrix = mat4.create()
    mat4.translate(playerMdlMatrix, playerMdlMatrix, [playerPos[0], playerPos[1] - 1, playerPos[2]])
    mat4.rotateY(playerMdlMatrix, playerMdlMatrix, degToRad(180))
    return playerMdlMatrix
}

const getCubeMdlMatrix = (): mat4 => {
    let cubeMdlMatrix = mat4.create()
    mat4.translate(cubeMdlMatrix, cubeMdlMatrix, [0, -3, 0])
    mat4.scale(cubeMdlMatrix, cubeMdlMatrix, [2, 0.1, 2])
    return cubeMdlMatrix
}

const getStoneMdlMatrix = (): mat4 => {
    let stoneMdlMatrix = mat4.create()
    mat4.translate(stoneMdlMatrix, stoneMdlMatrix, [0, -2.5, 1])
    mat4.rotateY(stoneMdlMatrix, stoneMdlMatrix, degToRad(stoneRotateAngle))
    mat4.scale(stoneMdlMatrix, stoneMdlMatrix, [3, 4, 3])
    return stoneMdlMatrix
}

const getSlimeMdlMatrix = (): mat4[] => {
    let slimeMdlMatrix: mat4[] = []
    for (let i = 0; i < slimePos.length; i++) {
        let mdlMatrix = mat4.create()
        mat4.translate(mdlMatrix, mdlMatrix, [slimeRotateCenter[0], slimeRotateCenter[1], slimeRotateCenter[2]])
        mat4.rotateY(mdlMatrix, mdlMatrix, degToRad(slimeRotateAngle))
        mat4.translate(mdlMatrix, mdlMatrix, [-slimeRotateCenter[0], -slimeRotateCenter[1], -slimeRotateCenter[2]])
        slimePos[i][1] = Math.sin(frames.value * slimeFloatSpeed) * 0.5
        mat4.translate(mdlMatrix, mdlMatrix, new Float32Array(slimePos[i]))
        mat4.scale(mdlMatrix, mdlMatrix, [0.2, 0.2, 0.2])
        slimeMdlMatrix.push(mdlMatrix)
    }
    return slimeMdlMatrix
}

const getVPMatrix = (isPlayer: boolean) => {
    let rotateMatrix = mat4.create()
    mat4.fromRotation(rotateMatrix, degToRad(angleY), [1, 0, 0])
    mat4.rotate(rotateMatrix, rotateMatrix, degToRad(angleX), [0, 1, 0])
    let viewDir = vec3.fromValues(cameraDir[0], cameraDir[1], cameraDir[2])
    let newViewDir = vec3.create()
    vec3.transformMat4(newViewDir, viewDir, rotateMatrix)
    let vpMatrix = mat4.create()
    mat4.perspective(vpMatrix, degToRad(60), 1, 0.1, 100)
    let viewMatrix = mat4.create()

    let eye = []
    for (let i = 0; i < 3; i++) {
        if (isPlayer) {
            if (cameraIdx === 1) eye.push(camera[i] + TPVOffset[i])
        } else eye.push(camera[i])
    }
    let focalPoint = []
    for (let i = 0; i < 3; i++) {
        if (isPlayer) focalPoint.push(playerPos[i])
        else focalPoint.push(camera[i] + newViewDir[i])
    }

    mat4.lookAt(
        viewMatrix,
        new Float32Array(eye),
        new Float32Array(focalPoint),
        [0, 1, 0]
    )
    mat4.multiply(vpMatrix, vpMatrix, viewMatrix)
    return vpMatrix
}

const drawEnvCube = (vpMatrix: mat4) => {
    let vpInverse = mat4.create()
    mat4.invert(vpInverse, vpMatrix)

    gl.useProgram(envCubeProgram);
    gl.depthFunc(gl.LEQUAL);
    gl.uniformMatrix4fv(envCubeProgram.u_viewDirectionProjectionInverse, false, vpInverse);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMapTex);
    gl.uniform1i(envCubeProgram.u_envCubeMap, 0);
    initAttributeVariable(gl, envCubeProgram.a_Position, quadObj.vertexBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, quadObj.numVertices);
}

const drawShadow = (obj: VertexInfo[], modelMatrix: mat4) => {
    gl.useProgram(shadowProgram)

    let mvpFromLight = mat4.create()
    mat4.perspective(mvpFromLight, degToRad(60), offScreenWidth / offScreenHeight, 1, 15)
    let viewMatrix = mat4.create()
    mat4.lookAt(viewMatrix, [light[0], light[1], light[2]], [0, 0, 0], [0, 1, 0])
    mat4.multiply(mvpFromLight, mvpFromLight, viewMatrix)
    mat4.multiply(mvpFromLight, mvpFromLight, modelMatrix)

    gl.uniformMatrix4fv(shadowProgram.u_MvpMatrix, false, mvpFromLight)

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, shadowProgram.a_Position, obj[i].vertexBuffer)
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices)
    }
    return mvpFromLight
}

const drawOneObject = (obj: VertexInfo[], modelMatrix: mat4, vpMatrix: mat4, mvpFromLight: mat4, colorR: number, colorG: number, colorB: number) => {
    gl.useProgram(program)

    let mvpMatrix = mat4.clone(vpMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

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
    gl.uniformMatrix4fv(program.u_MvpMatrixOfLight, false, mvpFromLight)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, shadowFbo.texture)
    gl.uniform1i(program.u_ShadowMap, 0);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, program.a_Position, obj[i].vertexBuffer)
        initAttributeVariable(gl, program.a_Normal, obj[i].normalBuffer)
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices)
    }
}

const drawWithTexture = (obj: VertexInfo[], modelMatrix: mat4, vpMatrix: mat4, mvpFromLight: mat4, textures: WebGLTexture[]) => {
    gl.useProgram(texProgram)

    let mvpMatrix = mat4.clone(vpMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

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
    gl.uniformMatrix4fv(texProgram.u_MvpMatrixOfLight, false, mvpFromLight)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, shadowFbo.texture)
    gl.uniform1i(texProgram.u_ShadowMap, 1)

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

const drawObjectWithDynamicReflection = (obj: VertexInfo[], modelMatrix: mat4, vpMatrix: mat4, colorR: number, colorG: number, colorB: number) => {
    gl.useProgram(texOnCubeProgram);

    let mvpMatrix = mat4.clone(vpMatrix)
    mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix)

    let normalMatrix = mat4.create()
    mat4.invert(normalMatrix, modelMatrix)
    mat4.transpose(normalMatrix, normalMatrix)

    gl.uniform3f(texOnCubeProgram.u_ViewPosition, camera[0], camera[1], camera[2]);
    gl.uniform3f(texOnCubeProgram.u_Color, colorR, colorG, colorB);

    gl.uniformMatrix4fv(texOnCubeProgram.u_MvpMatrix, false, mvpMatrix);
    gl.uniformMatrix4fv(texOnCubeProgram.u_modelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(texOnCubeProgram.u_normalMatrix, false, normalMatrix);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, fbo.texture);
    gl.uniform1i(texOnCubeProgram.u_envCubeMap, 0);

    for (let i = 0; i < obj.length; i++) {
        initAttributeVariable(gl, texOnCubeProgram.a_Position, obj[i].vertexBuffer);
        initAttributeVariable(gl, texOnCubeProgram.a_Normal, obj[i].normalBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, obj[i].numVertices);
    }
}

const renderCubeMap = (camX: number, camY: number, camZ: number, mvpFromLight: mat4[]) => {
    const ENV_CUBE_LOOK_DIR = [
        [1.0, 0.0, 0.0],
        [-1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, -1.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.0, 0.0, -1.0]
    ]
    const ENV_CUBE_LOOK_UP = [
        [0.0, -1.0, 0.0],
        [0.0, -1.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.0, 0.0, -1.0],
        [0.0, -1.0, 0.0],
        [0.0, -1.0, 0.0]
    ]

    gl.useProgram(program)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
    gl.viewport(0, 0, offScreenWidth, offScreenHeight)
    gl.clearColor(0, 0, 0, 1)
    for (let side = 0; side < 6; side++) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + side, fbo.texture, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        let vpMatrix = mat4.create()
        mat4.perspective(vpMatrix, degToRad(90), 1, 1, 100)
        let viewMatrix = mat4.create()
        mat4.lookAt(
            viewMatrix,
            [camX, camY, camZ],
            [
                camX + ENV_CUBE_LOOK_DIR[side][0],
                camY + ENV_CUBE_LOOK_DIR[side][1],
                camZ + ENV_CUBE_LOOK_DIR[side][2]
            ],
            [
                ENV_CUBE_LOOK_UP[side][0],
                ENV_CUBE_LOOK_UP[side][1],
                ENV_CUBE_LOOK_UP[side][2]
            ]
        )
        mat4.multiply(vpMatrix, vpMatrix, viewMatrix)

        drawEnvCube(vpMatrix)
        drawWithTexture(
            paimon.obj,
            getPlayerMdlMatrix(),
            vpMatrix,
            mvpFromLight[0],
            paimon.obj.map((_, i) => paimon.textures.get(paimon.objCompImgIdx[i]) as WebGLTexture)
        )
        drawOneObject(cubeObj, getCubeMdlMatrix(), vpMatrix, mvpFromLight[1], 0.8, 0.5, 0.7)
        drawWithTexture(
            stone.obj,
            getStoneMdlMatrix(),
            vpMatrix,
            mvpFromLight[2],
            stone.obj.map((_, i) => stone.textures.get(stone.objCompImgIdx[i]) as WebGLTexture)
        )
        getSlimeMdlMatrix().forEach((mdlMatrix, i) => {
            drawWithTexture(
                slime.obj,
                mdlMatrix,
                vpMatrix,
                mvpFromLight[3 + i],
                slime.obj.map((_, j) => slime.textures.get(slime.objCompImgIdx[j]) as WebGLTexture)
            )
        })
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

let mouseLastX: number
let mouseLastY: number
let mouseDragging = false

const mouseDown = (ev: MouseEvent) => {
    let x = ev.clientX
    let y = ev.clientY
    let rect = (ev.target as HTMLElement).getBoundingClientRect()
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
        mouseLastX = x
        mouseLastY = y
        mouseDragging = true
    }
}

const mouseUp = () => {
    mouseDragging = false
}

const mouseMove = (ev: MouseEvent) => {
    let x = ev.clientX
    let y = ev.clientY
    if (mouseDragging) {
        const factor = 100 / canvas.height // 100 determine the speed you rotate the object
        const dx = factor * (x - mouseLastX)
        const dy = factor * (y - mouseLastY)
        angleX += dx
        angleY += dy
    }
    mouseLastX = x
    mouseLastY = y
    draw()
}

onKeyStroke(['v', 'V'], () => {
    cameraIdx = (cameraIdx + 1) % 2
    draw()
})
onKeyStroke(['w', 'W', 's', 'S'], (e) => {
    let rotateMatrix = mat4.create()
    mat4.fromRotation(rotateMatrix, degToRad(angleY), [1, 0, 0])
    mat4.rotate(rotateMatrix, rotateMatrix, degToRad(angleX), [0, 1, 0])
    let viewDir = vec3.fromValues(cameraDir[0], cameraDir[1], cameraDir[2])
    let newViewDir = vec3.create()
    vec3.transformMat4(newViewDir, viewDir, rotateMatrix)

    if (e.key === 'w' || e.key === 'W') {
        camera[0] += newViewDir[0] * 0.1
        camera[1] += newViewDir[1] * 0.1
        camera[2] += newViewDir[2] * 0.1
        playerPos[0] += newViewDir[0] * 0.1
        playerPos[1] += newViewDir[1] * 0.1
        playerPos[2] += newViewDir[2] * 0.1
    } else if (e.key === 's' || e.key === 'S') {
        camera[0] -= newViewDir[0] * 0.1
        camera[1] -= newViewDir[1] * 0.1
        camera[2] -= newViewDir[2] * 0.1
        playerPos[0] -= newViewDir[0] * 0.1
        playerPos[1] -= newViewDir[1] * 0.1
        playerPos[2] -= newViewDir[2] * 0.1
    }
    draw()
})
</script>
