package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http/httputil"
	"net/url"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-model/go/datasource"
	hclog "github.com/hashicorp/go-hclog"
	plugin "github.com/hashicorp/go-plugin"
	"github.com/reddercode/akips-grafana/pkg/akips"
	"golang.org/x/net/context"
)

const (
	queryTestDatasource = "testDatasource"
	queryAnnotation     = "annotationQuery"
	queryTable          = "tableQuery"
	queryTimeSeries     = "timeSeriesQuery"
)

type datasourceQueryData struct {
	Hide         bool   `json:"hide"`
	Key          string `json:"key"`
	Type         string `json:"type"`
	DataSourceID int    `json:"datasourceId"`
	RawQuery     string `json:"rawQuery"`
	Query        string `json:"query"`
}

type AKIPSDatasource struct {
	plugin.NetRPCUnsupportedPlugin
	logger hclog.Logger
}

func (ds *AKIPSDatasource) Query(ctx context.Context, req *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
	ds.logger.Debug(spew.Sdump(req))

	akipsConfig := akips.Config{
		URL:        req.Datasource.Url,
		AuthMethod: akips.PasswordAuth(req.Datasource.DecryptedSecureJsonData["password"]),
	}

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
		switch data.Type {
		case queryTestDatasource:
			result, err = ds.queryTestDatasource(ctx, req, q, &data, &akipsConfig)

		case queryAnnotation:
			result, err = ds.queryAnnotation(ctx, req, q, &data, &akipsConfig)

		case queryTable:
			result, err = ds.queryTable(ctx, req, q, &data, &akipsConfig)

		default:
			result, err = ds.queryTimeSeries(ctx, req, q, &data, &akipsConfig)
		}
		if err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}

		result.RefId = q.RefId
		response.Results = append(response.Results, result)
	}

	return &response, nil
}

func (ds *AKIPSDatasource) queryTestDatasource(ctx context.Context,
	req *datasource.DatasourceRequest,
	query *datasource.Query,
	data *datasourceQueryData,
	clientConfig *akips.Config) (*datasource.QueryResult, error) {

	// Mock
	return &datasource.QueryResult{
		Error: "some wired shit",
	}, nil
}

func (ds *AKIPSDatasource) queryTimeSeries(ctx context.Context,
	req *datasource.DatasourceRequest,
	query *datasource.Query,
	data *datasourceQueryData,
	clientConfig *akips.Config) (*datasource.QueryResult, error) {

	start := req.TimeRange.FromEpochMs
	end := req.TimeRange.ToEpochMs
	interval := query.IntervalMs

	pointsNum := (end - start) / query.IntervalMs
	if pointsNum > query.MaxDataPoints {
		pointsNum = query.MaxDataPoints
		interval = (end - start) / pointsNum
	}

	points := make([]*datasource.Point, pointsNum)
	for i := range points {
		points[i] = &datasource.Point{
			Timestamp: start,
			Value:     float64(i),
		}
		start += interval
	}

	ret := &datasource.QueryResult{
		Series: []*datasource.TimeSeries{
			&datasource.TimeSeries{
				Name: "timeseries0Octets",
				Tags: map[string]string{
					"name0": "value0",
				},
				Points: points,
			},
			&datasource.TimeSeries{
				Name: "timeseries1Pkts",
				Tags: map[string]string{
					"name0": "value0",
				},
				Points: points,
			},
		},
	}
	return ret, nil
}

func (ds *AKIPSDatasource) queryAnnotation(ctx context.Context,
	req *datasource.DatasourceRequest,
	query *datasource.Query,
	data *datasourceQueryData,
	clientConfig *akips.Config) (*datasource.QueryResult, error) {
	return &datasource.QueryResult{}, nil
}

func (ds *AKIPSDatasource) queryTable(ctx context.Context,
	req *datasource.DatasourceRequest,
	query *datasource.Query,
	data *datasourceQueryData,
	clientConfig *akips.Config) (*datasource.QueryResult, error) {

	client := clientConfig.Client()
	akipsReq, err := clientConfig.NewRequest(ctx, "GET", "/api-db", url.Values{
		"cmds": []string{data.Query},
	})
	if err != nil {
		return nil, err
	}

	res, err := client.Do(akipsReq)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	dump, err := httputil.DumpResponse(res, true)
	if err != nil {
		log.Fatal(err)
	}
	ds.logger.Debug(string(dump))

	if res.StatusCode/100 != 2 {
		err = fmt.Errorf("akips-datasource: %s", res.Status)
		ds.logger.Error("API error", "status", res.Status)
		return nil, err
	}

	var akipsResponse akips.GenericResponse
	if err := akipsResponse.ParseResponse(res.Body); err != nil {
		return nil, err
	}

	ds.logger.Debug(spew.Sdump(akipsResponse))

	var (
		children  bool
		attrs     bool
		valuesNum int
	)
	rows := make([]*datasource.TableRow, len(akipsResponse))
	for i, elem := range akipsResponse {
		values := []*datasource.RowValue{
			&datasource.RowValue{
				Kind:        datasource.RowValue_TYPE_STRING,
				StringValue: elem.Parent,
			},
		}
		if elem.Child != "" {
			children = true
			values = append(values, &datasource.RowValue{
				Kind:        datasource.RowValue_TYPE_STRING,
				StringValue: elem.Child,
			})
		}
		if elem.Attribute != "" {
			attrs = true
			values = append(values, &datasource.RowValue{
				Kind:        datasource.RowValue_TYPE_STRING,
				StringValue: elem.Attribute,
			})
		}
		for _, v := range elem.Values {
			values = append(values, &datasource.RowValue{
				Kind:        datasource.RowValue_TYPE_STRING,
				StringValue: v,
			})
		}
		if len(elem.Values) > valuesNum {
			valuesNum = len(elem.Values)
		}
		rows[i] = &datasource.TableRow{
			Values: values,
		}
	}

	columns := []*datasource.TableColumn{
		&datasource.TableColumn{
			Name: "Parent",
		},
	}
	if children {
		columns = append(columns, &datasource.TableColumn{
			Name: "Child",
		})
	}
	if attrs {
		columns = append(columns, &datasource.TableColumn{
			Name: "Attribute",
		})
	}
	for i := 0; i < valuesNum; i++ {
		columns = append(columns, &datasource.TableColumn{
			Name: fmt.Sprintf("Value %d", i),
		})
	}

	return &datasource.QueryResult{
		Tables: []*datasource.Table{
			&datasource.Table{
				Columns: columns,
				Rows:    rows,
			},
		},
	}, nil
}
