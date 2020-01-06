package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strconv"

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

type datasourceQuery struct {
	req   *datasource.DatasourceRequest
	query *datasource.Query
	data  *datasourceQueryData
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

		parsedQuery := datasourceQuery{
			data:  &data,
			req:   req,
			query: q,
		}

		result, err := ds.doQuery(ctx, &parsedQuery, &akipsConfig)
		if err != nil {
			return nil, fmt.Errorf("akips-datasource: %v", err)
		}

		result.RefId = q.RefId
		response.Results = append(response.Results, result)
	}

	return &response, nil
}

func (ds *AKIPSDatasource) doQuery(ctx context.Context, query *datasourceQuery, clientConfig *akips.Config) (*datasource.QueryResult, error) {
	client := clientConfig.Client()

	var values url.Values
	if query.data.Query != "" {
		values = url.Values{"cmds": []string{query.data.Query}}
	}
	akipsReq, err := clientConfig.NewRequest(ctx, "GET", "/api-db", values)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(akipsReq)
	if err != nil {
		// The front end will get 500
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		// Pass the message to the front end
		return &datasource.QueryResult{
			Error: res.Status,
		}, nil
	}

	if values == nil {
		// No commands was issued, just a test
		var akipsResponse akips.TestResponse
		if err := akipsResponse.ParseResponse(res.Body); err != nil {
			// Pass the message to the front end
			return &datasource.QueryResult{
				Error: err.Error(),
			}, nil
		}
		return &datasource.QueryResult{}, nil
	}

	var akipsResponse akips.GenericResponse
	if err := akipsResponse.ParseResponse(res.Body); err != nil {
		// Pass the message to the front end
		return &datasource.QueryResult{
			Error: err.Error(),
		}, nil
	}

	switch query.data.Type {
	case queryTable:
		return ds.processTable(akipsResponse, query)

	default:
		return ds.processTimeSeries(akipsResponse, query)
	}
}

func (ds *AKIPSDatasource) processTimeSeries(response akips.GenericResponse, query *datasourceQuery) (*datasource.QueryResult, error) {
	series := make([]*datasource.TimeSeries, len(response))
	for tsCnt, elem := range response {
		var name string
		switch {
		case elem.Attribute != "":
			name = elem.Attribute
		case elem.Child != "":
			name = elem.Child
		default:
			name = elem.Parent
		}

		points := make([]*datasource.Point, len(elem.Values))
		if len(elem.Values) != 0 {
			d := len(elem.Values) - 1
			if d == 0 {
				d = 1
			}
			delta := float64(query.req.TimeRange.ToEpochMs-query.req.TimeRange.FromEpochMs) / float64(d)
			timestamp := float64(query.req.TimeRange.FromEpochMs)
			for i, v := range elem.Values {
				fv, err := strconv.ParseFloat(v, 64)
				if err != nil {
					fv = math.NaN()
				}
				points[i] = &datasource.Point{
					Timestamp: int64(timestamp),
					Value:     fv,
				}
				timestamp += delta
			}
		}

		series[tsCnt] = &datasource.TimeSeries{
			Name:   name,
			Points: points,
		}
	}

	return &datasource.QueryResult{
		Series: series,
	}, nil
}

func (ds *AKIPSDatasource) processTable(response akips.GenericResponse, query *datasourceQuery) (*datasource.QueryResult, error) {
	var (
		children  bool
		attrs     bool
		valuesNum int
	)
	rows := make([]*datasource.TableRow, len(response))
	for i, elem := range response {
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
			Name: fmt.Sprintf("Value[%d]", i),
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
