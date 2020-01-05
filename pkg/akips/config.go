package akips

import (
	"context"
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

	if method == "PUT" || method == "POST" {
		data := values.Encode()
		req, err := http.NewRequestWithContext(ctx, method, u.String(), strings.NewReader(data))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		return req, nil
	}

	q := u.Query()
	for k, v := range values {
		q[k] = v
	}
	u.RawQuery = q.Encode()
	return http.NewRequestWithContext(ctx, method, u.String(), nil)
}
