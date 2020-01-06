package akips

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

const (
	timestampLayout = "2006-01-02 15:04"
	errPrefx        = "ERROR: "
)

type ResponseParser interface {
	ParseResponse(io.Reader) error
}

const (
	flowSource        = "Source"
	flowDestination   = "Destination"
	flowProtocol      = "Protocol"
	flowPackets       = "Packets"
	flowBytes         = "Bytes"
	flowFlows         = "Flows"
	flowConversations = "Conversations"
	flowFilter        = "Filter"
	flowURL           = "URL"
)

type NetflowEntry struct {
	Source        string `json:"src,omitempty"`
	Destination   string `json:"dst,omitempty"`
	Protocol      string `json:"pro,omitempty"`
	Packets       *int64 `json:"pkt,omitempty"`
	Bytes         *int64 `json:"oct,omitempty"`
	Flows         *int64 `json:"flo,omitempty"`
	Conversations *int64 `json:"con,omitempty"`
	Filter        string `json:"tsf,omitempty"`
	URL           string `json:"url,omitempty"`
}

var (
	ErrFields = errors.New("akips: incorrect number of fields")
)

func splitCSV(s string) ([]string, error) {
	ret := make([]string, 0)
	for i := 0; i < len(s); {
		if s[i] == '"' {
			var token strings.Builder
			i++
			for {
				start := i
				for ; i < len(s) && s[i] != '"'; i++ {
				}
				token.WriteString(s[start:i])
				if i < len(s) {
					i++
				}
				if i < len(s) && s[i] == '"' {
					i++
					token.WriteByte('"')
				} else {
					break
				}
			}
			ret = append(ret, token.String())
			if i < len(s) {
				if s[i] != ',' {
					return ret, fmt.Errorf("akips: unexpected character at position %d: '%c'", i, s[i])
				}
				i++
				if i == len(s) {
					// Last empty token
					ret = append(ret, "")
				}
			}
		} else {
			start := i
			for ; i < len(s) && s[i] != ','; i++ {
			}
			ret = append(ret, s[start:i])
			if i < len(s) {
				i++
				if i == len(s) {
					// Last empty token
					ret = append(ret, "")
				}
			}
		}
	}
	return ret, nil
}

func isError(s string) (string, bool) {
	if strings.HasPrefix(s, errPrefx) {
		return s[len(errPrefx):], true
	}
	return "", false
}

func (f *NetflowEntry) setField(name, value string) error {
	switch name {
	case flowSource:
		f.Source = value

	case flowDestination:
		f.Destination = value

	case flowProtocol:
		f.Protocol = value

	case flowFilter:
		f.Filter = value

	case flowURL:
		f.URL = value

	case flowPackets, flowBytes, flowFlows, flowConversations:
		iv, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return err
		}

		switch name {
		case flowPackets:
			f.Packets = &iv

		case flowBytes:
			f.Bytes = &iv

		case flowFlows:
			f.Flows = &iv

		case flowConversations:
			f.Conversations = &iv
		}
	}

	return nil
}

var flowDefaultMapping = []string{
	flowSource,
	flowDestination,
	"",
	flowProtocol,
	flowPackets,
	flowBytes,
	flowFlows,
	flowConversations,
	flowFilter,
	flowURL,
}

type NetflowResponse []*NetflowEntry

func (f *NetflowResponse) ParseResponse(rd io.Reader) error {
	res := NetflowResponse{}
	mapping := flowDefaultMapping

	sc := bufio.NewScanner(rd)

	var gotHeader bool
	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}
		rec, err := splitCSV(sc.Text())
		if err != nil {
			return err
		}

		if len(rec) != 0 && len(rec[0]) != 0 && rec[0][0] == '#' {
			// Got header
			if !gotHeader {
				mapping = append([]string{rec[0][1:]}, rec[1:]...)
				gotHeader = true
			}
		} else {
			var e NetflowEntry
			l := len(rec)
			if l > len(mapping) {
				l = len(mapping) // Unlikely
			}
			for i := 0; i < l; i++ {
				if err := e.setField(mapping[i], rec[i]); err != nil {
					return err
				}
			}
			res = append(res, &e)
		}
	}

	if err := sc.Err(); err != nil {
		return err
	}

	*f = res

	return nil
}

func appendInt64(dst **int64, src *int64) {
	if src == nil {
		return
	}
	if *dst == nil {
		*dst = src
	} else {
		**dst += *src
	}
}

func (a *NetflowResponse) Append(b NetflowResponse) {
	if *a == nil {
		*a = b
		return
	}

	index := make(map[string]*NetflowEntry, len(*a))
	for _, entry := range *a {
		index[entry.Source+entry.Destination+entry.Protocol] = entry
	}

	for _, entry := range b {
		key := entry.Source + entry.Destination + entry.Protocol

		if dst, ok := index[key]; ok {
			appendInt64(&dst.Packets, entry.Packets)
			appendInt64(&dst.Bytes, entry.Bytes)
			appendInt64(&dst.Flows, entry.Flows)
			appendInt64(&dst.Conversations, entry.Conversations)
		} else {
			*a = append(*a, entry)
		}
	}
}

type MsgEntry struct {
	Timestamp time.Time `json:"ts"`
	Type      string    `json:"type"`
	IPVer     int       `json:"ipver"`
	Addr      string    `json:"addr"`
	Msg       []string  `json:"msg"`
}

type MsgResponse []*MsgEntry

func (m *MsgResponse) ParseResponse(rd io.Reader) error {
	res := MsgResponse{}

	sc := bufio.NewScanner(rd)

	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}
		header := strings.Fields(sc.Text())
		if len(header) < 4 {
			return ErrFields
		}
		ts, err := strconv.ParseInt(header[0], 10, 64)
		if err != nil {
			return err
		}
		ipv, err := strconv.ParseInt(header[2], 10, 32)
		if err != nil {
			return err
		}
		// Message
		msg := make([]string, 0, 1)

		for sc.Scan() && sc.Text() != "" {
			msg = append(msg, sc.Text())
		}

		entry := MsgEntry{
			Timestamp: time.Unix(ts, 0).UTC(),
			Type:      header[1],
			IPVer:     int(ipv),
			Addr:      header[3],
			Msg:       msg,
		}

		res = append(res, &entry)
	}

	if err := sc.Err(); err != nil {
		return err
	}

	*m = res

	return nil
}

type NetflowTimeSeries struct {
	Source      string    `json:"src,omitempty"`
	Destination string    `json:"dst,omitempty"`
	Protocol    string    `json:"pro,omitempty"`
	Start       time.Time `json:"start"`
	Interval    int64     `json:"int"`
	Values      []int64   `json:"val"`
}

type NetflowTimeSeriesResponse map[string]*NetflowTimeSeries

func (t *NetflowTimeSeriesResponse) ParseResponse(rd io.Reader) error {
	res := make(NetflowTimeSeriesResponse, 4)

	sc := bufio.NewScanner(rd)

	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}
		rec, err := splitCSV(sc.Text())
		if err != nil {
			return err
		}
		if len(rec) < 8 {
			return ErrFields
		}

		ivalues := make([]int64, len(rec)-6)

		for i, v := range rec[6:] {
			if v != "" {
				iv, err := strconv.ParseInt(v, 10, 64)
				if err != nil {
					return err
				}
				ivalues[i] = iv
			}
		}

		entry := NetflowTimeSeries{
			Source:      rec[0],
			Destination: rec[1],
			Protocol:    rec[4],
			Start:       time.Unix(ivalues[0], 0).UTC(),
			Interval:    ivalues[1],
			Values:      ivalues[2:],
		}

		if name := rec[5]; name != "" {
			res[strings.ToLower(name)] = &entry
		}
	}

	if err := sc.Err(); err != nil {
		return err
	}
	*t = res

	return nil
}

func (a *NetflowTimeSeriesResponse) Append(b NetflowTimeSeriesResponse) {
	if *a == nil {
		*a = b
		return
	}

	for typ, src := range b {
		if dst, ok := (*a)[typ]; ok {
			ln := len(dst.Values)
			if len(src.Values) < ln {
				ln = len(src.Values)
			}
			for i := 0; i < ln; i++ {
				dst.Values[i] += src.Values[i]
			}
		} else {
			(*a)[typ] = src
		}
	}
}

type TimeSeriesResponse struct {
	Timestamp []time.Time                `json:"ts"`
	Entries   []*TimeSeriesResponseEntry `json:"entries"`
}

type TimeSeriesResponseEntry struct {
	Parent           string  `json:"parent,omitempty"`
	Child            string  `json:"child,omitempty"`
	ChildDescription string  `json:"childDesc,omitempty"`
	Attribute        string  `json:"attr,omitempty"`
	Values           []int64 `json:"val"`
}

func (t *TimeSeriesResponse) ParseResponse(rd io.Reader) error {
	res := TimeSeriesResponse{
		Entries: make([]*TimeSeriesResponseEntry, 0),
	}

	sc := bufio.NewScanner(rd)

	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}
		rec, err := splitCSV(sc.Text())
		if err != nil {
			return err
		}
		if len(rec) < 4 {
			return ErrFields
		}

		if res.Timestamp == nil {
			// Got header
			res.Timestamp = make([]time.Time, len(rec)-4)
			for i, v := range rec[4:] {
				t, err := time.Parse(timestampLayout, v)
				if err != nil {
					return err
				}
				res.Timestamp[i] = t.UTC()
			}
		} else {
			// Data line
			ivalues := make([]int64, len(rec)-4)

			for i, v := range rec[4:] {
				if v != "" {
					iv, err := strconv.ParseInt(v, 10, 64)
					if err != nil {
						return err
					}

					ivalues[i] = iv
				}
			}

			entry := TimeSeriesResponseEntry{
				Parent:           rec[0],
				Child:            rec[1],
				ChildDescription: rec[2],
				Attribute:        rec[3],
				Values:           ivalues,
			}

			res.Entries = append(res.Entries, &entry)
		}
	}

	if err := sc.Err(); err != nil {
		return err
	}
	*t = res

	return nil
}

// GenericResponse consists of a parent, a child, an attribute and a list of values
type GenericResponse []*GenericResponseEntry

type GenericResponseEntry struct {
	Parent    string   `json:"parent,omitempty"`
	Child     string   `json:"child,omitempty"`
	Attribute string   `json:"attr,omitempty"`
	Values    []string `json:"val,omitempty"`
}

func (p *GenericResponse) ParseResponse(rd io.Reader) error {
	res := GenericResponse{}

	sc := bufio.NewScanner(rd)

	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}

		var entry GenericResponseEntry
		kv := strings.SplitN(sc.Text(), "=", 2)
		pca := strings.Fields(kv[0])
		if len(pca) != 0 {
			entry.Parent = pca[0]
		}
		if len(pca) > 1 {
			entry.Child = pca[1]
		}
		if len(pca) > 2 {
			entry.Attribute = pca[2]
		}
		if len(kv) > 1 {
			v, err := splitCSV(strings.TrimSpace(kv[1]))
			if err != nil {
				return ErrFields
			}
			entry.Values = v
		}
		res = append(res, &entry)
	}

	if err := sc.Err(); err != nil {
		return err
	}
	*p = res

	return nil
}

type TestResponse struct{}

func (t TestResponse) ParseResponse(rd io.Reader) error {
	sc := bufio.NewScanner(rd)

	for sc.Scan() {
		if e, ok := isError(sc.Text()); ok {
			return fmt.Errorf("akips: %s", e)
		}
	}
	if err := sc.Err(); err != nil {
		return err
	}

	return nil
}
