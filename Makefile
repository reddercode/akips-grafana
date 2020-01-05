GOOS = $(shell go env GOOS)
GOARCH = $(shell go env GOARCH)
TARGET = build

GOSRC := $(shell find . -name '*.go')

BIN := dist/akips-plugin_$(GOOS)_$(GOARCH)
PLUGIN := dist/module.js
TARGETS = \
	build \
	test  \
	dev   \
	watch \

.PHONY: all $(TARGETS)

all: $(PLUGIN) $(BIN)

$(BIN): $(GOSRC)
	go build -i -o $@ ./pkg

$(PLUGIN): src/*.ts src/*.tsx src/*.json
	npm run-script $(TARGET)

$(TARGETS):
	$(MAKE) TARGET=$@


