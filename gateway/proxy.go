package gateway

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// GatewayHeader marks a response the gateway made itself, so the app can tell
// "Tailscale can't reach the server" apart from an answer from Aurral.
const GatewayHeader = "X-Pocket-Gateway"

type dialFunc func(ctx context.Context, network, address string) (net.Conn, error)

type logFunc func(format string, args ...any)

// A request waits this long for the tailnet to come up and the server to
// answer the dial, so a phone that never connects fails like a server that's
// down instead of hanging the player.
const dialTimeout = 60 * time.Second

// newProxy forwards every request to upstream, and only to upstream, so the
// gateway never becomes a way into the rest of the tailnet.
func newProxy(upstream *url.URL, dial dialFunc, logf logFunc) http.Handler {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			ctx, cancel := context.WithTimeout(ctx, dialTimeout)
			defer cancel()
			return dial(ctx, network, address)
		},
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          32,
		MaxIdleConnsPerHost:   16,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
	proxy := &httputil.ReverseProxy{
		// SetURL also points the Host header at upstream, which a
		// `tailscale serve` HTTPS front end needs.
		Rewrite: func(pr *httputil.ProxyRequest) { pr.SetURL(upstream) },
		ModifyResponse: func(res *http.Response) error {
			keepRedirectsHere(res, upstream)
			dropSecureFromCookies(res)
			return nil
		},
		// Audio and the live socket must not sit in a buffer.
		FlushInterval: -1,
		Transport:     transport,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			if errors.Is(err, context.Canceled) && r.Context().Err() != nil {
				// The player gave up on this request, as it does when it seeks.
				return
			}
			logf("%s %s: %v", r.Method, r.URL.Path, err)
			w.Header().Set(GatewayHeader, "unreachable")
			w.WriteHeader(http.StatusBadGateway)
		},
	}
	return logRequests(proxy, logf)
}

// keepRedirectsHere turns a redirect to the server's own address into one to
// the same path on the gateway. The phone can't reach that address without
// Tailscale, so following it as sent would leave the tailnet.
func keepRedirectsHere(res *http.Response, upstream *url.URL) {
	location := res.Header.Get("Location")
	target, err := url.Parse(location)
	if location == "" || err != nil || !target.IsAbs() {
		return
	}
	if !strings.EqualFold(target.Scheme, upstream.Scheme) || !strings.EqualFold(target.Host, upstream.Host) {
		return
	}
	// The gateway serves upstream's base path at its own root.
	path := target.EscapedPath()
	if base := strings.TrimSuffix(upstream.EscapedPath(), "/"); base != "" {
		if path != base && !strings.HasPrefix(path, base+"/") {
			return
		}
		path = strings.TrimPrefix(path, base)
	}
	if path == "" {
		path = "/"
	}
	if target.RawQuery != "" {
		path += "?" + target.RawQuery
	}
	if target.Fragment != "" {
		path += "#" + target.EscapedFragment()
	}
	res.Header.Set("Location", path)
}

// dropSecureFromCookies lets a WebView on http://127.0.0.1 store the server's
// Secure cookies; that hop never leaves the phone. __Secure-, __Host- and
// SameSite=None cookies keep the flag, which browsers require of them.
func dropSecureFromCookies(res *http.Response) {
	cookies := res.Header.Values("Set-Cookie")
	if len(cookies) == 0 {
		return
	}
	res.Header.Del("Set-Cookie")
	for _, cookie := range cookies {
		res.Header.Add("Set-Cookie", withoutSecure(cookie))
	}
}

func withoutSecure(cookie string) string {
	parts := strings.Split(cookie, ";")
	name := strings.TrimSpace(parts[0])
	if strings.HasPrefix(name, "__Secure-") || strings.HasPrefix(name, "__Host-") {
		return cookie
	}
	kept := parts[:1]
	for _, attribute := range parts[1:] {
		trimmed := strings.TrimSpace(attribute)
		if strings.EqualFold(strings.ReplaceAll(trimmed, " ", ""), "SameSite=None") {
			return cookie
		}
		if strings.EqualFold(trimmed, "Secure") {
			continue
		}
		kept = append(kept, attribute)
	}
	return strings.Join(kept, ";")
}

// logRequests logs the path only. Stream and artwork URLs carry the session
// token in the query string.
func logRequests(next http.Handler, logf logFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logf("%s %s %d %dB %s", r.Method, r.URL.Path, rec.status, rec.bytes,
			time.Since(start).Round(time.Millisecond))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	n, err := r.ResponseWriter.Write(b)
	r.bytes += int64(n)
	return n, err
}

// Unwrap lets http.ResponseController reach the real writer, which the
// reverse proxy needs to flush streams and to hijack WebSocket upgrades.
func (r *statusRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }
