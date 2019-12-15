package main

import (
	"encoding/json"
	"fmt"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
)

const (
	qQuery  = "query"
	qSearch = "search"
	qTest   = "test"
)

type datasourceQueryModel struct {
	Hide         bool   `json:"hide"`
	Key          string `json:"key"`
	QueryType    string `json:"queryType"`
	DataSourceID int    `json:"datasourceId"`
	DeviceID     string `json:"deviceId"`
	InterfaceID  string `json:"interfaceId"`
}

type AKIPSDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

func (ds *AKIPSDatasource) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	ds.logger.Debug(spew.Sdump(req))

	var response datasource.DatasourceResponse

	for _, q := range req.Queries {
		var query datasourceQueryModel
		if err := json.Unmarshal([]byte(q.ModelJson), &query); err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}

		var (
			result *datasource.QueryResult
			err    error
		)
		ds.logger.Debug("query", "type", query.QueryType)

		switch query.QueryType {
		case qTest:
			result, err = ds.queryTest(ctx, req, q, &query)
		default:
			result, err = ds.queryTimeseries(ctx, req, q, &query)
		}
		if err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}
		result.RefId = q.RefId
		response.Results = append(response.Results, result)
	}

	return &response, nil
}

func (ds *AKIPSDatasource) queryTest(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, model *datasourceQueryModel) (*datasource.QueryResult, error) {
	return &datasource.QueryResult{
		Error: "some wired shit",
	}, nil
}

func (ds *AKIPSDatasource) queryTimeseries(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, model *datasourceQueryModel) (*datasource.QueryResult, error) {
	return &datasource.QueryResult{}, nil
}
