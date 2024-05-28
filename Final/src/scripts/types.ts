export interface BufferInfo {
    buffer: WebGLBuffer
    num: number
    type: number
}

export interface VertexInfo {
    vertexBuffer: BufferInfo
    normalBuffer: BufferInfo
    texCoordBuffer: BufferInfo
    numVertices: number
}

export interface FramebufferInfo {
    framebuffer: WebGLFramebuffer
    texture: WebGLTexture
}
