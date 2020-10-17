package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/reddercode/akips-grafana/pkg/akips"
)

const minInterval = 60 * time.Second

func newDatasource() *AKIPSDatasource {
	return &AKIPSDatasource{}
}

// AKIPSDatasource represents AKiPS datasource
type AKIPSDatasource struct {
}

type query struct {
	query *backend.DataQuery
	model *queryModel
}

type queryModel struct {
	Query        string `json:"query"`
	Device       string `json:"device"`
	Child        string `json:"child"`
	Attribute    string `json:"attribute"`
	SingleValue  bool   `json:"singleValue"`
	OmitParents  bool   `json:"omitParents"`
	LegendFormat string `json:"legendFormat"`
	LegendRegex  bool   `json:"legendRegex"`
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
	queryCSV        = "csv"
)

func (a *AKIPSDatasource) doQuery(ctx context.Context, clientConfig *akips.Config, dq *backend.DataQuery) (backend.DataResponse, error) {
	var model queryModel
	if err := json.Unmarshal(dq.JSON, &model); err != nil {
		return backend.DataResponse{}, err
	}
	query := query{
		query: dq,
		model: &model,
	}

	client := clientConfig.Client()

	queryStr := query.interpolateVariables()
	req, err := clientConfig.NewRequest(ctx, "GET", "/api-db", url.Values{"cmds": []string{queryStr}})
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

	meta := data.FrameMeta{ExecutedQueryString: queryStr}

	if query.query.QueryType == "csv" {
		var akipsResponse akips.CSVResponse
		if err := akipsResponse.ParseResponse(res.Body); err != nil {
			return backend.DataResponse{Error: err}, nil
		}
		return processCSV(akipsResponse, &query, &meta)
	}

	var akipsResponse akips.GenericResponse
	if err := akipsResponse.ParseResponse(res.Body); err != nil {
		return backend.DataResponse{Error: err}, nil
	}

	switch query.query.QueryType {
	case queryTable:
		return processTable(akipsResponse, &query, &meta)
	default:
		return processTimeSeries(akipsResponse, &query, &meta)
	}

}

func fieldName(e *akips.GenericResponseEntry) string {
	var n string
	switch {
	case e.Attribute != "":
		n = e.Attribute
	case e.Child != "":
		n = e.Child
	default:
		n = e.Parent
	}
	return n
}

func (qm *queryModel) formatLegend(str string) (string, error) {
	if qm.LegendFormat == "" {
		return str, nil
	}

	if qm.LegendRegex {
		r, err := regexp.Compile(qm.LegendFormat)
		if err != nil {
			return "", err
		}
		sub := r.FindStringSubmatch(str)
		if len(sub) == 0 {
			return str, nil
		}
		return sub[len(sub)-1], nil
	}
	return qm.LegendFormat, nil
}

func (q *query) interpolateVariables() string {
	replace := func(s, name, val string) string {
		re := regexp.MustCompile(`\$(` + name + `(\W|$)|{` + name + `})`)
		return re.ReplaceAllString(s, val+"$2")
	}

	interval := int64(((q.query.Interval + minInterval - 1) / minInterval) * minInterval / time.Second)
	from := q.query.TimeRange.From.Unix()
	to := q.query.TimeRange.To.Unix()

	vars := [][2]string{
		{"__timeInterval", strconv.FormatInt(interval, 10)},
		{"__timeFrom", strconv.FormatInt(from, 10)},
		{"__timeTo", strconv.FormatInt(to, 10)},
		{"__device", q.model.Device},
		{"__child", q.model.Child},
		{"__attribute", q.model.Attribute},
	}

	qstr := q.model.Query
	for _, v := range vars {
		qstr = replace(qstr, v[0], v[1])
	}
	return qstr
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

func (q *query) mkTimestampField(n int) *data.Field {
	var ts []time.Time
	if q.model.SingleValue {
		ts = []time.Time{q.query.TimeRange.To}
	} else {
		ts = make([]time.Time, n)

		d := n - 1
		if d == 0 {
			d = 1
		}

		dur := q.query.TimeRange.Duration()
		for i := range ts {
			ts[i] = q.query.TimeRange.From.Add(dur * time.Duration(i) / time.Duration(d))
		}
	}
	return data.NewField("Timestamp", nil, ts)
}

func processTimeSeries(akipsResponse akips.GenericResponse, query *query, frameMeta *data.FrameMeta) (res backend.DataResponse, err error) {
	if len(akipsResponse) == 0 {
		return
	}

	var tsField *data.Field

	for _, line := range akipsResponse {
		if len(line.Values) == 0 {
			// unlikely
			continue
		}

		if tsField == nil {
			tsField = query.mkTimestampField(len(line.Values))
		}

		var datapoints []*int64 // nullable
		if query.model.SingleValue {
			vv, _ := strconv.ParseInt(line.Values[0], 10, 64)
			datapoints = []*int64{&vv}
		} else {
			datapoints = make([]*int64, len(line.Values))
			for i, v := range line.Values {
				if vv, err := strconv.ParseInt(v, 10, 64); err == nil {
					datapoints[i] = &vv
				}
			}
		}

		fn, err := query.model.formatLegend(fieldName(line))
		if err != nil {
			return backend.DataResponse{Error: err}, nil
		}

		df := data.NewField(fn, fieldLabels(line), datapoints)

		// Frame per line
		res.Frames = append(res.Frames, &data.Frame{
			// Name:   fn,
			Fields: []*data.Field{tsField, df},
			Meta:   frameMeta,
			RefID:  query.query.RefID,
		})
	}

	return
}

func processTable(akipsResponse akips.GenericResponse, query *query, frameMeta *data.FrameMeta) (res backend.DataResponse, err error) {
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
		if query.model.OmitParents {
			pca.attribute[i] = fieldName(line)
		} else {
			pca.parent[i] = line.Parent
			pca.child[i] = line.Child
			pca.attribute[i] = line.Attribute
		}

		for vi, v := range line.Values {
			values[vi][i] = v
		}
	}

	fields := make([]*data.Field, 0, len(values)+3)
	if query.model.OmitParents {
		fields = append(fields, data.NewField("Name", nil, pca.attribute))
	} else {
		fields = append(fields,
			data.NewField("Parent", nil, pca.parent),
			data.NewField("Child", nil, pca.child),
			data.NewField("Attribute", nil, pca.attribute))
	}

	if query.model.SingleValue && len(values) != 0 {
		fields = append(fields, data.NewField("Value", nil, values[0]))
	} else {
		for i, v := range values {
			fields = append(fields, data.NewField(fmt.Sprintf("Value #%d", i), nil, v))
		}
	}

	res.Frames = data.Frames{
		&data.Frame{
			// Name:   "Response",
			Fields: fields,
			Meta:   frameMeta,
			RefID:  query.query.RefID,
		},
	}

	return
}

func processCSV(akipsResponse akips.CSVResponse, query *query, frameMeta *data.FrameMeta) (res backend.DataResponse, err error) {
	if len(akipsResponse) == 0 {
		return
	}

	vlen := 0 // just a percaution
	for _, line := range akipsResponse {
		if len(line) > vlen {
			vlen = len(line)
		}
	}

	values := make([][]string, vlen)
	for i := range values {
		values[i] = make([]string, len(akipsResponse))
	}

	for i, line := range akipsResponse {
		for vi, v := range line {
			values[vi][i] = v
		}
	}

	var fields []*data.Field
	if query.model.SingleValue && len(values) != 0 {
		fields = []*data.Field{data.NewField("Value", nil, values[0])}
	} else {
		fields = make([]*data.Field, len(values))
		for i, v := range values {
			fields[i] = data.NewField(fmt.Sprintf("Value #%d", i), nil, v)
		}
	}

	res.Frames = data.Frames{
		&data.Frame{
			Fields: fields,
			Meta:   frameMeta,
			RefID:  query.query.RefID,
		},
	}

	return
}

// CheckHealth handles health checks
func (a *AKIPSDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	cfg := akipsConfig(&req.PluginContext)
	client := cfg.Client()

	akipsReq, err := cfg.NewRequest(ctx, "GET", "/api-db", url.Values{"cmds": []string{"mget device __dummy__"}})
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
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: res.Status,
		}, nil
	}

	var akipsResponse akips.GenericResponse
	if err := akipsResponse.ParseResponse(res.Body); err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: err.Error(),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "Success",
	}, nil
}
