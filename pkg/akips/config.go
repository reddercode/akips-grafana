package akips

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
)

// Config is the client configuration
type Config struct {
	AuthMethod AuthMethod
	URL        string
	Transport  http.RoundTripper
}

// Client creates an *http.Client
func (c *Config) Client() *http.Client {
	if c.AuthMethod == nil {
		return http.DefaultClient
	}
	return &http.Client{
		Transport: &Transport{
			Base:       c.Transport,
			AuthMethod: c.AuthMethod,
		},
	}
}

// NewRequest returns a new Request given a method, URL, and a contents
func (c *Config) NewRequest(ctx context.Context, method, endpointPath string, values url.Values) (*http.Request, error) {
	u, err := url.Parse(c.URL)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, endpointPath)

	var body io.Reader
	if len(values) != 0 {
		if method == "PUT" || method == "POST" {
			data := values.Encode()
			body = strings.NewReader(data)
		} else {
			q := u.Query()
			for k, v := range values {
				q[k] = v
			}
			u.RawQuery = q.Encode()
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), body)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}

	return req, nil
}
