package akips

import "net/http"

// AuthMethod represents an authentication method
type AuthMethod interface {
	AuthenticateRequest(r *http.Request)
}

// PasswordAuth authorizes and authenticates the request with a given password
type PasswordAuth string

// AuthenticateRequest add a password to request's URL
func (p PasswordAuth) AuthenticateRequest(r *http.Request) {
	if p == "" {
		return
	}
	q := r.URL.Query()
	q.Set("password", string(p))
	r.URL.RawQuery = q.Encode()
}

// Transport is an http.RoundTripper that makes authenticated AKiPS API requests
type Transport struct {
	// Method adds credentials to outgoing requests
	AuthMethod AuthMethod

	// Base is the base RoundTripper used to make HTTP requests.
	// If nil, http.DefaultTransport is used.
	Base http.RoundTripper
}

func (t *Transport) base() http.RoundTripper {
	if t.Base != nil {
		return t.Base
	}
	return http.DefaultTransport
}

// RoundTrip authorizes and authenticates the request
func (t *Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	req2 := *req
	req2.Header = make(http.Header, len(req.Header))
	for k, s := range req.Header {
		req2.Header[k] = append([]string(nil), s...)
	}

	if t.AuthMethod != nil {
		t.AuthMethod.AuthenticateRequest(&req2)
	}
	return t.base().RoundTrip(&req2)
}

var _ http.RoundTripper = &Transport{}
