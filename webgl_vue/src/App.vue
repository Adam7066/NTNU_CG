<template>
  <canvas ref="canvasRef" width="600" height="600">
    Please use a browser that support "canvas"
  </canvas>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {createProgram} from './scripts/webglUtils'
import vertShaderSource from './shaders/main.vert'
import fragShaderSource from './shaders/main.frag'

onMounted(() => {
  canvas = canvasRef.value as HTMLCanvasElement
  draw()
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let canvas: HTMLCanvasElement
let gl: WebGLRenderingContext
let program: WebGLProgram

const draw = () => {
  gl = canvas.getContext('webgl') as WebGLRenderingContext
  program = createProgram(gl, vertShaderSource, fragShaderSource)

  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)

  let vertex = new Float32Array([
    0, 0.5, 1, 0, 0,
    0.5, 0, 0, 1, 0,
    -0.5, 0, 0, 0, 1
  ])

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertex, gl.STATIC_DRAW)
  let FSIZE = vertex.BYTES_PER_ELEMENT
  let a_Position = gl.getAttribLocation(program, 'a_Position')
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 5, 0)
  gl.enableVertexAttribArray(a_Position)
  let a_Color = gl.getAttribLocation(program, 'a_Color')
  gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, FSIZE * 5, FSIZE * 2)
  gl.enableVertexAttribArray(a_Color)

  gl.drawArrays(gl.TRIANGLES, 0, 3)
}
</script>
