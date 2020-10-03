package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/reddercode/akips-grafana/pkg/akips"
)

func newDatasource() *AKIPSDatasource {
	return &AKIPSDatasource{}
}

// AKIPSDatasource represents AKiPS datasource
type AKIPSDatasource struct {
}

type queryModel struct {
	Query       string `json:"query"`
	Format      string `json:"format"`
	SingleValue bool   `json:"singleValue"`
	OmitParents bool   `json:"omitParents"`
}

func akipsConfig(pc *backend.PluginContext) *akips.Config {
	is := pc.DataSourceInstanceSettings
	return &akips.Config{
		URL:        is.URL,
		AuthMethod: akips.PasswordAuth(is.DecryptedSecureJSONData["password"]),
	}
}

// QueryData is the primary method called by grafana-server
func (a *AKIPSDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	cfg := akipsConfig(&req.PluginContext)
	res := backend.NewQueryDataResponse()
	for _, q := range req.Queries {
		r, err := a.doQuery(ctx, cfg, &q)
		if err != nil {
			return nil, err
		}
		res.Responses[q.RefID] = r
	}

	return res, nil
}

const (
	queryTable      = "table"
	queryTimeSeries = "time_series"
	fmtFrames       = "frames"
)

func (a *AKIPSDatasource) doQuery(ctx context.Context, clientConfig *akips.Config, query *backend.DataQuery) (backend.DataResponse, error) {
	var q queryModel
	if err := json.Unmarshal(query.JSON, &q); err != nil {
		return backend.DataResponse{}, err
	}
	client := clientConfig.Client()

	req, err := clientConfig.NewRequest(ctx, "GET", "/api-db", url.Values{"cmds": []string{q.Query}})
	if err != nil {
		return backend.DataResponse{}, err
	}

	res, err := client.Do(req)
	if err != nil {
		return backend.DataResponse{Error: err}, nil
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		return backend.DataResponse{Error: err}, nil
	}

	var akipsResponse akips.GenericResponse
	if err := akipsResponse.ParseResponse(res.Body); err != nil {
		return backend.DataResponse{Error: err}, nil
	}

	switch query.QueryType {
	case queryTable:
		return processTable(akipsResponse, query, &q)
	default:
		return processTimeSeries(akipsResponse, query, &q)
	}
}

func fieldName(e *akips.GenericResponseEntry) string {
	switch {
	case e.Attribute != "":
		return e.Attribute
	case e.Child != "":
		return e.Child
	default:
		return e.Parent
	}
}

func fieldLabels(e *akips.GenericResponseEntry) (l data.Labels) {
	l = make(data.Labels, 3)
	if e.Parent != "" {
		l["parent"] = e.Parent
	}
	if e.Child != "" {
		l["child"] = e.Child
	}
	if e.Attribute != "" {
		l["attribute"] = e.Attribute
	}
	return
}

func mkTimestampField(query *backend.DataQuery, qm *queryModel, n int) *data.Field {
	var ts []time.Time
	if qm.SingleValue {
		ts = []time.Time{query.TimeRange.To}
	} else {
		ts = make([]time.Time, n)

		d := n - 1
		if d == 0 {
			d = 1
		}

		dur := query.TimeRange.Duration()
		for i := range ts {
			ts[i] = query.TimeRange.From.Add(dur * time.Duration(i) / time.Duration(d))
		}
	}
	return data.NewField("Timestamp", nil, ts)
}

func processTimeSeries(akipsResponse akips.GenericResponse, query *backend.DataQuery, qm *queryModel) (res backend.DataResponse, err error) {
	if len(akipsResponse) == 0 {
		return
	}

	var (
		tsField    *data.Field
		dataFields []*data.Field
	)

	frameMeta := data.FrameMeta{ExecutedQueryString: qm.Query}

	for _, line := range akipsResponse {
		if len(line.Values) == 0 {
			// unlikely
			continue
		}

		if tsField == nil {
			tsField = mkTimestampField(query, qm, len(line.Values))
		}

		var datapoints []*int64 // nullable
		if qm.SingleValue {
			vv, _ := strconv.ParseInt(line.Values[0], 10, 64)
			datapoints = []*int64{&vv}
		} else {
			datapoints := make([]*int64, len(line.Values))
			for i, v := range line.Values {
				if vv, err := strconv.ParseInt(v, 10, 64); err == nil {
					datapoints[i] = &vv
				}
			}
		}

		df := data.NewField(fieldName(line), fieldLabels(line), datapoints)

		if qm.Format != fmtFrames {
			dataFields = append(dataFields, df)
		} else {
			// Frame per line
			res.Frames = append(res.Frames, &data.Frame{
				Name:   fieldName(line),
				Fields: []*data.Field{tsField, df},
				Meta:   &frameMeta,
				RefID:  query.RefID,
			})
		}
	}

	if qm.Format != fmtFrames && tsField != nil {
		// Single frame
		res.Frames = data.Frames{
			&data.Frame{
				Name:   "Response",
				Fields: append([]*data.Field{tsField}, dataFields...),
				Meta:   &frameMeta,
				RefID:  query.RefID,
			},
		}
	}

	return
}

func processTable(akipsResponse akips.GenericResponse, query *backend.DataQuery, qm *queryModel) (res backend.DataResponse, err error) {
	if len(akipsResponse) == 0 {
		return
	}

	// transpose the result
	pca := struct {
		parent    []string
		child     []string
		attribute []string
	}{
		parent:    make([]string, len(akipsResponse)),
		child:     make([]string, len(akipsResponse)),
		attribute: make([]string, len(akipsResponse)),
	}

	vlen := 0 // just a percaution
	for _, line := range akipsResponse {
		if len(line.Values) > vlen {
			vlen = len(line.Values)
		}
	}

	values := make([][]string, vlen)
	for i := range values {
		values[i] = make([]string, len(akipsResponse))
	}

	for i, line := range akipsResponse {
		pca.parent[i] = line.Parent
		pca.child[i] = line.Child
		pca.attribute[i] = line.Attribute
		for vi, v := range line.Values {
			values[vi][i] = v
		}
	}

	fields := make([]*data.Field, 0, len(values)+3)
	if !qm.OmitParents {
		fields = append(fields,
			data.NewField("Parent", nil, pca.parent),
			data.NewField("Child", nil, pca.child))
	}
	fields = append(fields, data.NewField("Attribute", nil, pca.attribute))

	if len(values) != 0 {
		if qm.SingleValue {
			fields = append(fields, data.NewField("Value", nil, values[0]))
		} else {
			for i, v := range values {
				fields = append(fields, data.NewField(fmt.Sprintf("Value #%d", i), nil, v))
			}
		}
	}

	res.Frames = data.Frames{
		&data.Frame{
			Name:   "Response",
			Fields: fields,
			Meta:   &data.FrameMeta{ExecutedQueryString: qm.Query},
			RefID:  query.RefID,
		},
	}

	return
}

// CheckHealth handles health checks
func (a *AKIPSDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	cfg := akipsConfig(&req.PluginContext)
	client := cfg.Client()

	akipsReq, err := cfg.NewRequest(ctx, "GET", "/api-db", nil)
	if err != nil {
		return nil, err
	}

	res, err := client.Do(akipsReq)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}
	defer res.Body.Close()

	if res.StatusCode/100 != 2 {
		// Pass the message to the front end
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: res.Status,
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Success",
	}, nil
}
