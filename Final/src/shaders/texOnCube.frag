precision mediump float;
varying vec4 v_TexCoord;
uniform vec3 u_ViewPosition;
uniform vec3 u_Color;
uniform samplerCube u_envCubeMap;
varying vec3 v_Normal;
varying vec3 v_PositionInWorld;

void main() {
    vec3 V = normalize(u_ViewPosition - v_PositionInWorld);
    vec3 normal = normalize(v_Normal);
    vec3 R = reflect(-V, normal);
    gl_FragColor = vec4(0.78 * textureCube(u_envCubeMap, R).rgb + 0.3 * u_Color, 1.0);
}