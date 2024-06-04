attribute vec4 a_Position;
attribute vec4 a_Normal;
attribute vec2 a_TexCoord;
uniform mat4 u_MvpMatrix;
uniform mat4 u_modelMatrix;
uniform mat4 u_normalMatrix;
varying vec3 v_Normal;
varying vec3 v_PositionInWorld;
varying vec2 v_TexCoord;
uniform mat4 u_MvpMatrixOfLight;
varying vec4 v_PositionFromLight;

void main() {
    gl_Position = u_MvpMatrix * a_Position;
    v_PositionInWorld = (u_modelMatrix * a_Position).xyz;
    v_Normal = normalize(vec3(u_normalMatrix * a_Normal));
    v_TexCoord = a_TexCoord;
    v_PositionFromLight = u_MvpMatrixOfLight * a_Position;
}