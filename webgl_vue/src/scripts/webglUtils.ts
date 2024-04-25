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
    gl.useProgram(program)
    return program
}