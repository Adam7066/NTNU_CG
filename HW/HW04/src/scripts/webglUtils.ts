import {BufferInfo, FramebufferInfo, VertexInfo} from './types'

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('shader 創建失敗')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
}

export function createProgram(gl: WebGLRenderingContext, vexShaderSource: string, fragShaderSource: string): WebGLProgram {
    const program = gl.createProgram()
    if (!program) throw new Error('program 創建失敗')
    const vexShader = createShader(gl, gl.VERTEX_SHADER, vexShaderSource)
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragShaderSource)
    gl.attachShader(program, vexShader)
    gl.attachShader(program, fragShader)
    gl.linkProgram(program)
    return program
}

export function initAttributeVariable(gl: WebGLRenderingContext, a_attribute: number, buf: BufferInfo): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer);
    gl.vertexAttribPointer(a_attribute, buf.num, buf.type, false, 0, 0);
    gl.enableVertexAttribArray(a_attribute);
}

function initArrBufForLaterUse(gl: WebGLRenderingContext, data: Float32Array, num: number, type: number): BufferInfo {
    let buf = gl.createBuffer()
    if (!buf) throw new Error('buffer 創建失敗')
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return {
        buffer: buf,
        num: num,
        type: type
    }
}

export function initVertexBufForLaterUse(gl: WebGLRenderingContext, vertices: Float32Array, normals: Float32Array | null, texCoords: Float32Array | null): VertexInfo {
    let nVertices = vertices.length / 3
    let o = {} as VertexInfo
    o.vertexBuffer = initArrBufForLaterUse(gl, vertices, 3, gl.FLOAT)
    if (normals != null) o.normalBuffer = initArrBufForLaterUse(gl, normals, 3, gl.FLOAT)
    if (texCoords != null) o.texCoordBuffer = initArrBufForLaterUse(gl, texCoords, 2, gl.FLOAT)
    o.numVertices = nVertices
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
    return o
}

export function getCubeNormalOnVertices(vertices: number[]): number[] {
    let normals = []
    let nTriangles = vertices.length / 9;
    for (let i = 0; i < nTriangles; i++) {
        let idx = i * 9;
        let p0x = vertices[idx], p0y = vertices[idx + 1], p0z = vertices[idx + 2];
        idx = i * 9 + 3;
        let p1x = vertices[idx], p1y = vertices[idx + 1], p1z = vertices[idx + 2];
        idx = i * 9 + 2 * 3;
        let p2x = vertices[idx], p2y = vertices[idx + 1], p2z = vertices[idx + 2];

        let ux = p1x - p0x, uy = p1y - p0y, uz = p1z - p0z;
        let vx = p2x - p0x, vy = p2y - p0y, vz = p2z - p0z;

        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;

        let norm = Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx = nx / norm;
        ny = ny / norm;
        nz = nz / norm;

        normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    }
    return normals
}

export function initFramebuffer(gl: WebGLRenderingContext, offScreenWidth: number, offScreenHeight: number): FramebufferInfo {
    let frameBuf = {} as FramebufferInfo

    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, offScreenWidth, offScreenHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    let depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, offScreenWidth, offScreenHeight);

    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    if (frameBuffer && texture) {
        frameBuf.framebuffer = frameBuffer
        frameBuf.texture = texture
    }
    return frameBuf
}

export function degToRad(angle: number): number {
    return angle * Math.PI / 180
}
