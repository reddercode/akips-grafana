GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

BIN := dist/akips-plugin_$(GOOS)_$(GOARCH)
PLUGIN := dist/module.js

all: $(BIN) $(PLUGIN)

$(BIN): pkg/*.go
	go build -i -o $@ ./pkg

$(PLUGIN): src/*.ts src/*.tsx src/*.json
	npm run-script build
