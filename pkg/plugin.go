package main

import (
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
)

const logLevelEnv = "AKIPS_DATASOURCE_LOG"

var logger = hclog.New(&hclog.LoggerOptions{
	Name: "akips-backend-datasource",
	//Level: hclog.LevelFromString(os.Getenv(logLevelEnv)),
	Level: hclog.LevelFromString("DEBUG"),
})

func main() {
	logger.Debug("Running AKiPS backend datasource")

	plugin.Serve(&plugin.ServeConfig{
		HandshakeConfig: plugin.HandshakeConfig{
			ProtocolVersion:  1,
			MagicCookieKey:   "grafana_plugin_type",
			MagicCookieValue: "datasource",
		},
		Plugins: map[string]plugin.Plugin{
			"akips-backend-datasource": &datasource.DatasourcePluginImpl{Plugin: &AKIPSDatasource{
				logger: logger,
			}},
		},
		// A non-nil value here enables gRPC serving for this plugin...
		GRPCServer: plugin.DefaultGRPCServer,
	})
}
