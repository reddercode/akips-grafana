package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"golang.org/x/net/context"
)

const (
	queryTestDatasource = "testDatasource"
	queryAnnotation     = "annotationQuery"
	queryMetricFind     = "metricFindQuery"
	queryTimeSeries     = "timeSeriesQuery"
)

type datasourceQueryData struct {
	Hide         bool   `json:"hide"`
	Key          string `json:"key"`
	Type         string `json:"type"`
	DataSourceID int    `json:"datasourceId"`
	DeviceID     string `json:"deviceId"`
	InterfaceID  string `json:"interfaceId"`
	Query        string `json:"query"`
}

type AKIPSDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

func (ds *AKIPSDatasource) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	ds.logger.Debug(spew.Sdump(req))

	var response datasource.DatasourceResponse

	for _, q := range req.Queries {
		var data datasourceQueryData
		if err := json.Unmarshal([]byte(q.ModelJson), &data); err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}

		var (
			result *datasource.QueryResult
			err    error
		)
		ds.logger.Debug("query", "type", data.Type)

		switch data.Type {
		case queryTestDatasource:
			result, err = ds.queryTestDatasource(ctx, req, q, &data)

		case queryAnnotation:
			result, err = ds.queryAnnotation(ctx, req, q, &data)

		case queryMetricFind:
			result, err = ds.queryMetricFind(ctx, req, q, &data)

		default:
			result, err = ds.queryTimeSeries(ctx, req, q, &data)
		}
		if err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}

		result.RefId = q.RefId
		response.Results = append(response.Results, result)
	}

	return &response, nil
}

func (ds *AKIPSDatasource) queryTestDatasource(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, data *datasourceQueryData) (*datasource.QueryResult, error) {
	// Mock
	return &datasource.QueryResult{
		Error: "some wired shit",
	}, nil
}

func (ds *AKIPSDatasource) queryTimeSeries(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, data *datasourceQueryData) (*datasource.QueryResult, error) {
	return &datasource.QueryResult{}, nil
}

func (ds *AKIPSDatasource) queryAnnotation(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, data *datasourceQueryData) (*datasource.QueryResult, error) {
	return &datasource.QueryResult{}, nil
}

func (ds *AKIPSDatasource) queryMetricFind(ctx context.Context, req *datasource.DatasourceRequest, query *datasource.Query, data *datasourceQueryData) (*datasource.QueryResult, error) {
	// Mock
	if strings.Contains(data.Query, "device") {
		return &datasource.QueryResult{
			Tables: []*datasource.Table{
				&datasource.Table{
					Columns: []*datasource.TableColumn{
						&datasource.TableColumn{
							Name: "device",
						},
					},
					Rows: []*datasource.TableRow{
						&datasource.TableRow{
							Values: []*datasource.RowValue{
								&datasource.RowValue{
									Kind:        datasource.RowValue_TYPE_STRING,
									StringValue: "device0",
								},
							},
						},
						&datasource.TableRow{
							Values: []*datasource.RowValue{
								&datasource.RowValue{
									Kind:        datasource.RowValue_TYPE_STRING,
									StringValue: "device1",
								},
							},
						},
					},
				},
			},
		}, nil
	}

	return &datasource.QueryResult{
		Tables: []*datasource.Table{
			&datasource.Table{
				Columns: []*datasource.TableColumn{
					&datasource.TableColumn{
						Name: "interface",
					},
					&datasource.TableColumn{
						Name: "index",
					},
				},
				Rows: []*datasource.TableRow{
					&datasource.TableRow{
						Values: []*datasource.RowValue{
							&datasource.RowValue{
								Kind:        datasource.RowValue_TYPE_STRING,
								StringValue: "interface0",
							},
							&datasource.RowValue{
								Kind:       datasource.RowValue_TYPE_INT64,
								Int64Value: 0,
							},
						},
					},
					&datasource.TableRow{
						Values: []*datasource.RowValue{
							&datasource.RowValue{
								Kind:        datasource.RowValue_TYPE_STRING,
								StringValue: "interface1",
							},
							&datasource.RowValue{
								Kind:       datasource.RowValue_TYPE_INT64,
								Int64Value: 1,
							},
						},
					},
				},
			},
		},
	}, nil
}
