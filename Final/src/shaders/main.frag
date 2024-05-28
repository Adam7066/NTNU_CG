precision mediump float;
uniform vec3 u_LightPosition;
uniform vec3 u_ViewPosition;
uniform float u_Ka;
uniform float u_Kd;
uniform float u_Ks;
uniform float u_shininess;
uniform vec3 u_Color;
varying vec3 v_Normal;
varying vec3 v_PositionInWorld;

void main() {
    vec3 ambientLightColor = u_Color;
    vec3 diffuseLightColor = u_Color;
    vec3 specularLightColor = vec3(1.0, 1.0, 1.0);
    vec3 ambient = ambientLightColor * u_Ka;
    vec3 normal = normalize(v_Normal);
    vec3 lightDirection = normalize(u_LightPosition - v_PositionInWorld);
    float nDotL = max(dot(lightDirection, normal), 0.0);
    vec3 diffuse = diffuseLightColor * u_Kd * nDotL;
    vec3 specular = vec3(0.0, 0.0, 0.0);

    if (nDotL > 0.0) {
        vec3 R = reflect(-lightDirection, normal);
        // V: the vector, point to viewer
        vec3 V = normalize(u_ViewPosition - v_PositionInWorld);
        float specAngle = clamp(dot(R, V), 0.0, 1.0);
        specular = u_Ks * pow(specAngle, u_shininess) * specularLightColor;
    }
    gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
}