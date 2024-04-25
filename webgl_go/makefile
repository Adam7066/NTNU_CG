all:
	#tinygo build -o ./public/main.wasm -target=wasm -no-debug ./main.go
	tinygo build -o ./public/main.wasm -target=wasm ./main.go
	go run ./http-server.go
