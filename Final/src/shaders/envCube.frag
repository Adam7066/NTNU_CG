precision mediump float;
uniform samplerCube u_envCubeMap;
uniform mat4 u_viewDirectionProjectionInverse;
varying vec4 v_Position;

void main() {
    vec4 t = u_viewDirectionProjectionInverse * v_Position;
    gl_FragColor = textureCube(u_envCubeMap, normalize(t.xyz / t.w));
}