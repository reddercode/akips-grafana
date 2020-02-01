GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

ifeq ($(GOOS),windows)
	EXT = .exe
endif

BUILD_MODE = build
DIST = ./dist

GO_SRC = \
	./pkg/plugin.go \
	./pkg/datasource.go \
	./pkg/akips/config.go \
	./pkg/akips/auth.go \
	./pkg/akips/response.go

PLUGIN_SRC = src/*.ts src/*.tsx src/*.json

PLUGIN_BUILD_MODES = build dev

DIST_BIN = \
	$(DIST)/akips-plugin_linux_amd64 \
	$(DIST)/akips-plugin_darwin_amd64 \
	$(DIST)/akips-plugin_windows_amd64.exe

BIN = $(DIST)/akips-plugin_$(GOOS)_$(GOARCH)$(EXT)
PLUGIN = $(DIST)/module.js

.PHONY: all $(PLUGIN_BUILD_MODES) backend backend-plugin-ci

all: $(PLUGIN) $(BIN)

$(DIST)/akips-plugin_%: $(GO_SRC)
	GOOS=$(word 1,$(subst _, ,$(*:.exe=))) GOARCH=$(word 2,$(subst _, ,$(*:.exe=))) go build -i -o $@ ./pkg

$(PLUGIN): $(PLUGIN_SRC)
	npx grafana-toolkit plugin:$(BUILD_MODE)

$(PLUGIN_BUILD_MODES):
	$(MAKE) BUILD_MODE=$@

backend-plugin-ci:
	$(MAKE) DIST=./ci/jobs/build_plugin/dist backend

backend: $(DIST_BIN)
