import {BufferInfo, FramebufferInfo, VertexInfo, ObjInfo} from './types'

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

export function initVertexBufForLaterUse(gl: WebGLRenderingContext, vertices: number[], normals: number[] | null, texCoords: number[] | null): VertexInfo {
    let nVertices = vertices.length / 3
    let o = {} as VertexInfo
    o.vertexBuffer = initArrBufForLaterUse(gl, new Float32Array(vertices), 3, gl.FLOAT)
    if (normals != null) o.normalBuffer = initArrBufForLaterUse(gl, new Float32Array(normals), 3, gl.FLOAT)
    if (texCoords != null) o.texCoordBuffer = initArrBufForLaterUse(gl, new Float32Array(texCoords), 2, gl.FLOAT)
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

export async function loadOBJtoCreateVBO(gl: WebGLRenderingContext, objTxt: string): Promise<VertexInfo[]> {
    let objComponents: VertexInfo[] = [];
    let obj = parseOBJ(objTxt);
    for (let i = 0; i < obj.geometries.length; i++) {
        let o = initVertexBufForLaterUse(
            gl,
            obj.geometries[i].data.position,
            obj.geometries[i].data.normal,
            obj.geometries[i].data.texcoord
        );
        objComponents.push(o);
    }
    return objComponents;
}

function parseOBJ(text: string) {
    // because indices are base 1 let's just fill in the 0th data
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];

    // same order as `f` indices
    const objVertexData = [
        objPositions,
        objTexcoords,
        objNormals,
    ];

    // same order as `f` indices
    let webglVertexData = [
        [],   // positions
        [],   // texcoords
        [],   // normals
    ];

    const materialLibs = [];
    const geometries = [];
    let geometry;
    let groups = ['default'];
    let material = 'default';
    let object = 'default';

    const noop = () => {
    };

    function newGeometry() {
        // If there is an existing geometry and it's
        // not empty then start a new one.
        if (geometry && geometry.data.position.length) {
            geometry = undefined;
        }
    }

    function setGeometry() {
        if (!geometry) {
            const position = [];
            const texcoord = [];
            const normal = [];
            webglVertexData = [
                position,
                texcoord,
                normal,
            ];
            geometry = {
                object,
                groups,
                material,
                data: {
                    position,
                    texcoord,
                    normal,
                },
            };
            geometries.push(geometry);
        }
    }

    function addVertex(vert) {
        const ptn = vert.split('/');
        ptn.forEach((objIndexStr, i) => {
            if (!objIndexStr) {
                return;
            }
            const objIndex = parseInt(objIndexStr);
            const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
            webglVertexData[i].push(...objVertexData[i][index]);
        });
    }

    const keywords = {
        v(parts) {
            objPositions.push(parts.map(parseFloat));
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        vt(parts) {
            // should check for missing v and extra w?
            objTexcoords.push(parts.map(parseFloat));
        },
        f(parts) {
            setGeometry();
            const numTriangles = parts.length - 2;
            for (let tri = 0; tri < numTriangles; ++tri) {
                addVertex(parts[0]);
                addVertex(parts[tri + 1]);
                addVertex(parts[tri + 2]);
            }
        },
        s: noop,    // smoothing group
        mtllib(parts, unparsedArgs) {
            // the spec says there can be multiple filenames here
            // but many exist with spaces in a single filename
            materialLibs.push(unparsedArgs);
        },
        usemtl(parts, unparsedArgs) {
            material = unparsedArgs;
            newGeometry();
        },
        g(parts) {
            groups = parts;
            newGeometry();
        },
        o(parts, unparsedArgs) {
            object = unparsedArgs;
            newGeometry();
        },
    };

    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split('\n');
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
        const line = lines[lineNo].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const m = keywordRE.exec(line);
        if (!m) {
            continue;
        }
        const [, keyword, unparsedArgs] = m;
        const parts = line.split(/\s+/).slice(1);
        const handler = keywords[keyword];
        if (!handler) {
            console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
            continue;
        }
        handler(parts, unparsedArgs);
    }

    // remove any arrays that have no entries.
    for (const geometry of geometries) {
        geometry.data = Object.fromEntries(
            Object.entries(geometry.data).filter(([, array]) => array.length > 0));
    }

    return {
        geometries,
        materialLibs,
    };
}

export function initCubeTexture(
    gl: WebGLRenderingContext,
    posXName: string, negXName: string,
    posYName: string, negYName: string,
    posZName: string, negZName: string,
    imgWidth: number, imgHeight: number
) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const faceInfos = [
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
            fName: posXName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
            fName: negXName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
            fName: posYName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            fName: negYName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
            fName: posZName,
        },
        {
            target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            fName: negZName,
        },
    ];
    faceInfos.forEach((faceInfo) => {
        const {target, fName} = faceInfo;
        gl.texImage2D(target, 0, gl.RGBA, imgWidth, imgHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        let image = new Image();
        image.onload = function () {
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        };
        image.src = fName;
    });
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

    return texture;
}

function initTexture(gl: WebGLRenderingContext, img: HTMLImageElement) {
    let tex = gl.createTexture()
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    return tex
}

function parseTexture(objContent: string, mtlContent: string): string[] {
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

export function initFrameBufferForCubemapRendering(gl: WebGLRenderingContext, offScreenWidth: number, offScreenHeight: number) {
    let frameBuf = {} as FramebufferInfo

    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    for (let i = 0; i < 6; i++) {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, offScreenWidth, offScreenHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    let depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, offScreenWidth, offScreenHeight);
    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

    if (frameBuffer && texture) {
        frameBuf.framebuffer = frameBuffer
        frameBuf.texture = texture
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return frameBuf;
}

export async function loadOBJModel(gl: WebGLRenderingContext, modelName: string, objPath: string, mtlPath: string): Promise<ObjInfo> {
    const textures = new Map<string, WebGLTexture>()
    const objTxt = await (await fetch(objPath)).text()
    const mtlTxt = await (await fetch(mtlPath)).text()
    const obj = await loadOBJtoCreateVBO(gl, objTxt)
    const objCompImgIdx = parseTexture(objTxt, mtlTxt)
    const imgNames = Array.from(new Set(objCompImgIdx))
    for (let i = 0; i < imgNames.length; i++) {
        let img = new Image()
        img.src = `${modelName}/${imgNames[i]}`
        img.onload = () => {
            let tex = initTexture(gl, img)
            if (tex) textures.set(imgNames[i], tex)
        }
    }
    return {obj, textures, objCompImgIdx, imgNames}
}
