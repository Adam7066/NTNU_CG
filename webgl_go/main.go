package main

import (
	"fmt"

	"github.com/gowebapi/webapi"
	"github.com/gowebapi/webapi/core/js"
	"github.com/gowebapi/webapi/core/jsconv"
	"github.com/gowebapi/webapi/graphics/webgl"
	"github.com/gowebapi/webapi/html/canvas"
)

var gl *webgl.RenderingContext
var prog *webgl.Program

var robotMove = []float32{0.0, 0.0}

func main() {
	c := make(chan struct{})
	fmt.Println("GO/WASM Loaded")
	addCanvas()
	<-c
}

func addCanvas() {
	doc := webapi.GetWindow().Document()
	app := doc.GetElementById("app")

	canvasE := doc.CreateElement("canvas", &webapi.Union{js.ValueOf("dom.Node")})
	canvasE.SetId("canvas")
	app.AppendChild(&canvasE.Node)
	canvasHTML := canvas.HTMLCanvasElementFromWrapper(canvasE)
	canvasHTML.SetWidth(uint(600))
	canvasHTML.SetHeight(uint(600))

	contextU := canvasHTML.GetContext("webgl", nil)
	gl = webgl.RenderingContextFromWrapper(contextU)
	prog = setupShaders(gl)
	gl.UseProgram(prog)

	js.Global().Call("requestAnimationFrame", js.FuncOf(drawScene))
}

func setupShaders(gl *webgl.RenderingContext) *webgl.Program {
	vertCode := `
		attribute vec4 a_Position;
		attribute vec4 a_Color;
		varying vec4 v_Color;
		void main(){
			gl_Position = a_Position;
			gl_PointSize = 10.0;
			v_Color = a_Color;
		}
	`
	fragCode := `
		precision mediump float;
		varying vec4 v_Color;
		void main(){
			gl_FragColor = v_Color;
		}
	`

	vShader := gl.CreateShader(webgl.VERTEX_SHADER)
	gl.ShaderSource(vShader, vertCode)
	gl.CompileShader(vShader)

	fShader := gl.CreateShader(webgl.FRAGMENT_SHADER)
	gl.ShaderSource(fShader, fragCode)
	gl.CompileShader(fShader)

	prog := gl.CreateProgram()
	gl.AttachShader(prog, vShader)
	gl.AttachShader(prog, fShader)
	gl.LinkProgram(prog)
	return prog
}

func drawScene(this js.Value, p []js.Value) any {
	gl.ClearColor(0, 0, 0, 1)
	gl.Clear(webgl.COLOR_BUFFER_BIT)

	vertices := jsconv.Float32ToJs([]float32{
		0.5, 0, 1, 0, 0,
		0, 0.5, 0, 1, 0,
		-0.5, 0, 0, 0, 1,
	})

	vBuf := gl.CreateBuffer()
	gl.BindBuffer(webgl.ARRAY_BUFFER, vBuf)
	gl.BufferData2(webgl.ARRAY_BUFFER, webgl.UnionFromJS(vertices), webgl.STATIC_DRAW)

	FSize := 4
	aPosition := gl.GetAttribLocation(prog, "a_Position")
	gl.VertexAttribPointer(uint(aPosition), 2, webgl.FLOAT, false, FSize*5, 0)
	gl.EnableVertexAttribArray(uint(aPosition))
	aColor := gl.GetAttribLocation(prog, "a_Color")
	gl.VertexAttribPointer(uint(aColor), 3, webgl.FLOAT, false, FSize*5, FSize*2)
	gl.EnableVertexAttribArray(uint(aColor))

	gl.DrawArrays(webgl.TRIANGLES, 0, vertices.Length()/5)
	return nil
}
