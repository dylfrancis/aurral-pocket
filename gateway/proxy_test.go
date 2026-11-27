package gateway

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

func directDial(ctx context.Context, network, address string) (net.Conn, error) {
	var d net.Dialer
	return d.DialContext(ctx, network, address)
}

type logBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (l *logBuffer) logf(format string, args ...any) {
	l.mu.Lock()
	defer l.mu.Unlock()
	fmt.Fprintf(&l.buf, format+"\n", args...)
}

func (l *logBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.buf.String()
}

// startGateway serves upstream on loopback the way the app sees it, and returns
// the loopback server's base URL.
func startGateway(t *testing.T, upstream http.Handler, dial dialFunc) (string, *loopbackServer, *logBuffer) {
	t.Helper()
	server := httptest.NewServer(upstream)
	t.Cleanup(server.Close)
	target, _ := url.Parse(server.URL)
	logs := &logBuffer{}
	loopback, err := openLoopbackServer(0, newProxy(target, dial, logs.logf), logs.logf)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(loopback.close)
	return fmt.Sprintf("http://127.0.0.1:%d", loopback.currentPort()), loopback, logs
}

func TestForwardsToUpstreamUnderItsHost(t *testing.T) {
	var gotHost, gotURI string
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHost, gotURI = r.Host, r.URL.RequestURI()
		io.WriteString(w, "ok")
	})
	base, _, _ := startGateway(t, upstream, directDial)

	res, err := http.Get(base + "/api/health?token=abc")
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()

	if res.StatusCode != 200 || string(body) != "ok" {
		t.Fatalf("got %d %q", res.StatusCode, body)
	}
	if gotHost == strings.TrimPrefix(base, "http://") {
		t.Errorf("upstream saw the gateway's host %q", gotHost)
	}
	if gotURI != "/api/health?token=abc" {
		t.Errorf("upstream saw %q", gotURI)
	}
}

func TestPassesRangeRequests(t *testing.T) {
	audio := bytes.Repeat([]byte("0123456789"), 100)
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeContent(w, r, "track.flac", time.Time{}, bytes.NewReader(audio))
	})
	base, _, _ := startGateway(t, upstream, directDial)

	req, _ := http.NewRequest("GET", base+"/api/stream/1", nil)
	req.Header.Set("Range", "bytes=10-19")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(res.Body)
	res.Body.Close()

	if res.StatusCode != http.StatusPartialContent {
		t.Fatalf("status %d", res.StatusCode)
	}
	if got := res.Header.Get("Content-Range"); got != "bytes 10-19/1000" {
		t.Errorf("Content-Range %q", got)
	}
	if !bytes.Equal(body, audio[10:20]) {
		t.Errorf("body %q", body)
	}
}

func TestStreamsWithoutWaitingForTheEnd(t *testing.T) {
	release := make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "first")
		w.(http.Flusher).Flush()
		<-release
		io.WriteString(w, "second")
	})
	base, _, _ := startGateway(t, upstream, directDial)
	t.Cleanup(unblock)

	res, err := http.Get(base + "/api/stream/1")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	got := make(chan string, 1)
	go func() {
		buf := make([]byte, len("first"))
		io.ReadFull(res.Body, buf)
		got <- string(buf)
	}()
	select {
	case first := <-got:
		if first != "first" {
			t.Fatalf("read %q", first)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("the first chunk sat in a buffer")
	}
	unblock()
	rest, _ := io.ReadAll(res.Body)
	if string(rest) != "second" {
		t.Errorf("rest %q", rest)
	}
}

func TestTunnelsWebSocketUpgrades(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") != "websocket" {
			http.Error(w, "no upgrade", http.StatusBadRequest)
			return
		}
		conn, rw, err := http.NewResponseController(w).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		rw.WriteString("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
		rw.Flush()
		buf := make([]byte, 4)
		if _, err := io.ReadFull(rw, buf); err == nil {
			rw.Write(buf)
			rw.Flush()
		}
	})
	base, _, _ := startGateway(t, upstream, directDial)

	conn, err := net.Dial("tcp", strings.TrimPrefix(base, "http://"))
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(3 * time.Second))
	fmt.Fprintf(conn, "GET /ws HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n")

	reader := bufio.NewReader(conn)
	res, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("status %d", res.StatusCode)
	}
	conn.Write([]byte("ping"))
	echo := make([]byte, 4)
	if _, err := io.ReadFull(reader, echo); err != nil || string(echo) != "ping" {
		t.Fatalf("echo %q, %v", echo, err)
	}
}

func TestMarksAServerTailscaleCantReach(t *testing.T) {
	refuse := func(context.Context, string, string) (net.Conn, error) {
		return nil, errors.New("no route to host")
	}
	base, _, _ := startGateway(t, http.NotFoundHandler(), refuse)

	res, err := http.Get(base + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusBadGateway || res.Header.Get(GatewayHeader) != "unreachable" {
		t.Fatalf("got %d with %s %q", res.StatusCode, GatewayHeader, res.Header.Get(GatewayHeader))
	}
}

func TestLogsLeaveOutTheQuery(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	base, _, logs := startGateway(t, upstream, directDial)

	res, err := http.Get(base + "/api/stream/1?token=secret-session-token")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if strings.Contains(logs.String(), "secret-session-token") {
		t.Fatalf("token in logs: %s", logs)
	}
	if !strings.Contains(logs.String(), "/api/stream/1") {
		t.Fatalf("path missing from logs: %s", logs)
	}
}

func TestReopensTheSamePortAfterTheListenerDies(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "ok") })
	base, loopback, _ := startGateway(t, upstream, directDial)
	port := loopback.currentPort()

	// What iOS does to a suspended app's listener, as near as macOS gets.
	loopback.mu.Lock()
	loopback.ln.Close()
	loopback.mu.Unlock()

	reopened, newPort, err := loopback.check()
	if err != nil || !reopened || newPort != port {
		t.Fatalf("reopened=%v port=%d (was %d) err=%v", reopened, newPort, port, err)
	}
	res, err := http.Get(base + "/")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}

	reopened, _, err = loopback.check()
	if reopened || err != nil {
		t.Fatalf("a live listener was reopened: %v %v", reopened, err)
	}
}

func TestTakesAnotherPortWhenItsOwnIsTaken(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()
	port := taken.Addr().(*net.TCPAddr).Port

	logs := &logBuffer{}
	loopback, err := openLoopbackServer(port, http.NotFoundHandler(), logs.logf)
	if err != nil {
		t.Fatal(err)
	}
	defer loopback.close()
	if loopback.currentPort() == port || loopback.currentPort() == 0 {
		t.Fatalf("port %d", loopback.currentPort())
	}
}

func TestKeepsRedirectsToTheServerOnTheGateway(t *testing.T) {
	var upstreamURL string
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/own":
			http.Redirect(w, r, upstreamURL+"/sso/complete?x=1#code=abc", http.StatusFound)
		case "/path":
			http.Redirect(w, r, "/sso/complete#code=abc", http.StatusFound)
		default:
			http.Redirect(w, r, "https://idp.example.com/authorize?state=s", http.StatusFound)
		}
	})
	server := httptest.NewServer(upstream)
	t.Cleanup(server.Close)
	upstreamURL = server.URL
	target, _ := url.Parse(server.URL)
	logs := &logBuffer{}
	loopback, err := openLoopbackServer(0, newProxy(target, directDial, logs.logf), logs.logf)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(loopback.close)
	base := fmt.Sprintf("http://127.0.0.1:%d", loopback.currentPort())

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	for path, want := range map[string]string{
		"/own":      "/sso/complete?x=1#code=abc",
		"/path":     "/sso/complete#code=abc",
		"/provider": "https://idp.example.com/authorize?state=s",
	} {
		res, err := client.Get(base + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if got := res.Header.Get("Location"); got != want {
			t.Errorf("%s: Location %q, want %q", path, got, want)
		}
	}
}

func TestStripsTheServersBasePathFromRedirects(t *testing.T) {
	res := &http.Response{Header: http.Header{"Location": {"https://host.example.ts.net/aurral/sso/complete#code=abc"}}}
	keepRedirectsHere(res, &url.URL{Scheme: "https", Host: "host.example.ts.net", Path: "/aurral"})
	if got := res.Header.Get("Location"); got != "/sso/complete#code=abc" {
		t.Errorf("Location %q", got)
	}

	outside := &http.Response{Header: http.Header{"Location": {"https://host.example.ts.net/other/page"}}}
	keepRedirectsHere(outside, &url.URL{Scheme: "https", Host: "host.example.ts.net", Path: "/aurral"})
	if got := outside.Header.Get("Location"); got != "https://host.example.ts.net/other/page" {
		t.Errorf("a redirect outside the base path changed to %q", got)
	}
}

func TestKeepsSecureCookiesOnLoopback(t *testing.T) {
	upstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Add("Set-Cookie", "aurral_oidc=tx; Path=/; HttpOnly; SameSite=Lax; Secure")
		w.Header().Add("Set-Cookie", "plain=1; Path=/")
		// A browser refuses these without Secure.
		w.Header().Add("Set-Cookie", "__Host-session=1; Path=/; Secure")
		w.Header().Add("Set-Cookie", "cross=1; Path=/; SameSite=None; Secure")
	})
	base, _, _ := startGateway(t, upstream, directDial)

	res, err := http.Get(base + "/api/auth/oidc/login")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	cookies := res.Header.Values("Set-Cookie")
	if len(cookies) != 4 {
		t.Fatalf("cookies %q", cookies)
	}
	if strings.Contains(strings.ToLower(cookies[0]), "secure") || !strings.Contains(cookies[0], "HttpOnly") {
		t.Errorf("first cookie %q", cookies[0])
	}
	if cookies[1] != "plain=1; Path=/" {
		t.Errorf("second cookie %q", cookies[1])
	}
	for _, kept := range cookies[2:] {
		if !strings.HasSuffix(kept, "; Secure") {
			t.Errorf("cookie %q lost Secure", kept)
		}
	}
}
