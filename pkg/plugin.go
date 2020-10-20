package main

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func main() {
	backend.Logger.Debug("Running AKiPS backend datasource")
	backend.SetupPluginEnvironment("grafana-akips-datasource")

	ds := newDatasource()
	err := backend.Serve(backend.ServeOpts{
		QueryDataHandler:   ds,
		CheckHealthHandler: ds,
	})
	if err != nil {
		backend.Logger.Error(err.Error())
		os.Exit(1)
	}
}
