// Package gateway joins a tailnet with tsnet and serves a loopback HTTP proxy
// to one Aurral server on it. gomobile binds every exported name, so only the
// mobile API is exported.
package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"sync"
	"time"

	"tailscale.com/client/local"
	"tailscale.com/envknob"
	"tailscale.com/ipn"
	"tailscale.com/tsnet"
)

type Config struct {
	// StateDir holds the node's keys. Keep it out of backups: a key restored on
	// a second phone would fight the first for the same node.
	StateDir string
	Hostname string
	// ControlURL is empty for Tailscale, or a Headscale server's URL.
	ControlURL string
	// AuthKey is only read the first time. Leave it empty to sign in in the
	// browser instead.
	AuthKey string
	// Upstream is the server's tailnet URL.
	Upstream string
	// Port is the loopback port to try first. URLs the app already handed the
	// player stay valid while it doesn't change.
	Port int
	// Verbose adds tsnet's backend logs, which are long.
	Verbose bool
}

type StatusListener interface {
	OnStatus(statusJSON string)
}

type status struct {
	// State is "Off" or a tailscale backend state: NoState, NeedsLogin,
	// NeedsMachineAuth, Starting, Running or Stopped.
	State      string   `json:"state"`
	LoginURL   string   `json:"loginURL,omitempty"`
	Port       int      `json:"port,omitempty"`
	TailnetIPs []string `json:"tailnetIPs,omitempty"`
	DNSName    string   `json:"dnsName,omitempty"`
	Error      string   `json:"error,omitempty"`
}

var (
	mu       sync.Mutex
	current  *gateway
	upstream string

	listenerMu sync.Mutex
	listener   StatusListener
)

var logger = log.New(os.Stderr, "[gateway] ", log.LstdFlags|log.Lmicroseconds)

func logf(format string, args ...any) { logger.Printf(format, args...) }

type gateway struct {
	ts       *tsnet.Server
	loopback *loopbackServer
	cancel   context.CancelFunc
	stateDir string

	mu       sync.Mutex
	status   status
	lastSent string
}

func SetStatusListener(l StatusListener) {
	listenerMu.Lock()
	listener = l
	listenerMu.Unlock()
}

// Start joins the tailnet and opens the loopback proxy, returning its port.
// It returns as soon as the port is open: requests wait there until the node
// is connected. Calling it again for the same upstream returns the same port.
func Start(config *Config) (int, error) {
	mu.Lock()
	defer mu.Unlock()
	if config == nil || config.Upstream == "" || config.StateDir == "" {
		return 0, errors.New("gateway: Upstream and StateDir are required")
	}
	if current != nil {
		if config.Upstream != upstream {
			return 0, fmt.Errorf("gateway: already running for another server")
		}
		return current.loopback.currentPort(), nil
	}
	target, err := url.Parse(config.Upstream)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") || target.Host == "" {
		return 0, fmt.Errorf("gateway: %q is not an http or https URL", config.Upstream)
	}

	// Nothing about the phone goes to log.tailscale.com.
	envknob.SetNoLogsNoSupport()
	ts := &tsnet.Server{
		Dir:        config.StateDir,
		Hostname:   config.Hostname,
		ControlURL: config.ControlURL,
		AuthKey:    config.AuthKey,
		UserLogf:   logf,
	}
	if config.Verbose {
		ts.Logf = logf
	}
	if err := ts.Start(); err != nil {
		return 0, fmt.Errorf("gateway: starting tailscale: %w", err)
	}
	loopback, err := openLoopbackServer(config.Port, newProxy(target, ts.Dial, logf), logf)
	if err != nil {
		ts.Close()
		return 0, fmt.Errorf("gateway: opening the loopback port: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	g := &gateway{
		ts:       ts,
		loopback: loopback,
		cancel:   cancel,
		stateDir: config.StateDir,
		status:   status{State: "NoState"},
	}
	current, upstream = g, config.Upstream
	go g.watch(ctx)
	go g.watchdog(ctx)
	logf("listening on 127.0.0.1:%d for %s", loopback.currentPort(), target.Redacted())
	return loopback.currentPort(), nil
}

// Stop closes the proxy and leaves the tailnet until the next Start. The node
// stays registered.
func Stop() error {
	g := take()
	if g == nil {
		return nil
	}
	err := g.close()
	notify(status{State: "Off"})
	return err
}

// Forget logs this phone's node out of the tailnet, bringing it up briefly if
// the gateway isn't running, then deletes its keys in stateDir either way.
func Forget(stateDir, controlURL string) error {
	if stateDir == "" {
		return errors.New("gateway: StateDir is required")
	}
	g := take()
	var ts *tsnet.Server
	if g != nil {
		ts = g.ts
	} else if _, err := os.Stat(filepath.Join(stateDir, "tailscaled.state")); err == nil {
		envknob.SetNoLogsNoSupport()
		ts = &tsnet.Server{Dir: stateDir, ControlURL: controlURL, UserLogf: logf}
		if err := ts.Start(); err != nil {
			ts = nil
		}
	}

	var err error
	if ts != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if lc, lcErr := ts.LocalClient(); lcErr == nil {
			err = lc.Logout(ctx)
		} else {
			err = lcErr
		}
	}
	if g != nil {
		err = errors.Join(err, g.close())
	} else if ts != nil {
		ts.Close()
	}
	err = errors.Join(err, os.RemoveAll(stateDir))
	notify(status{State: "Off"})
	return err
}

// Status is the current status as JSON.
func Status() string {
	mu.Lock()
	g := current
	mu.Unlock()
	if g == nil {
		return `{"state":"Off"}`
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	b, _ := json.Marshal(g.status)
	return string(b)
}

// CheckListener reopens the loopback port if iOS took it while the app was
// suspended. The app calls it on the way back to the foreground.
func CheckListener() {
	mu.Lock()
	g := current
	mu.Unlock()
	if g != nil {
		g.checkLoopback("foreground")
	}
}

func take() *gateway {
	mu.Lock()
	defer mu.Unlock()
	g := current
	current, upstream = nil, ""
	return g
}

func (g *gateway) close() error {
	g.cancel()
	g.loopback.close()
	return g.ts.Close()
}

func (g *gateway) watch(ctx context.Context) {
	lc, err := g.ts.LocalClient()
	if err != nil {
		g.update(func(s *status) { s.Error = err.Error() })
		return
	}
	for ctx.Err() == nil {
		w, err := lc.WatchIPNBus(ctx, ipn.NotifyInitialState)
		if err != nil {
			sleep(ctx, time.Second)
			continue
		}
		for {
			n, err := w.Next()
			if err != nil {
				break
			}
			if n.ErrMessage != nil {
				msg := *n.ErrMessage
				g.update(func(s *status) { s.Error = msg })
			}
			g.refresh(ctx, lc)
		}
		w.Close()
	}
}

func (g *gateway) refresh(ctx context.Context, lc *local.Client) {
	node, err := lc.StatusWithoutPeers(ctx)
	if err != nil {
		return
	}
	g.update(func(s *status) {
		s.State = node.BackendState
		s.LoginURL = ""
		if node.BackendState == ipn.NeedsLogin.String() {
			s.LoginURL = node.AuthURL
		}
		s.TailnetIPs = s.TailnetIPs[:0]
		for _, ip := range node.TailscaleIPs {
			s.TailnetIPs = append(s.TailnetIPs, ip.String())
		}
		if node.Self != nil {
			s.DNSName = node.Self.DNSName
		}
		if node.BackendState == ipn.Running.String() {
			s.Error = ""
		}
	})
}

// watchdog checks the loopback port every second. It also notes how long the
// process was suspended, which is when iOS takes listeners back.
func (g *gateway) watchdog(ctx context.Context) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	last := time.Now().Round(0)
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			now = now.Round(0)
			if gap := now.Sub(last); gap > 5*time.Second {
				logf("woke after %s", gap.Round(time.Second))
			}
			last = now
			g.checkLoopback("watchdog")
		}
	}
}

func (g *gateway) checkLoopback(caller string) {
	reopened, port, err := g.loopback.check()
	switch {
	case errors.Is(err, errClosed):
	case err != nil:
		logf("%s: can't reopen the loopback port: %v", caller, err)
		g.update(func(s *status) { s.Error = err.Error() })
	case reopened:
		logf("%s: reopened the loopback port on %d", caller, port)
		g.update(func(*status) {})
	}
}

// update changes the status and tells the listener when the JSON changed.
func (g *gateway) update(change func(*status)) {
	g.mu.Lock()
	change(&g.status)
	g.status.Port = g.loopback.currentPort()
	b, _ := json.Marshal(g.status)
	changed := string(b) != g.lastSent
	g.lastSent = string(b)
	g.mu.Unlock()
	if changed {
		send(string(b))
	}
}

func notify(s status) {
	b, _ := json.Marshal(s)
	send(string(b))
}

func send(statusJSON string) {
	listenerMu.Lock()
	l := listener
	listenerMu.Unlock()
	if l != nil {
		l.OnStatus(statusJSON)
	}
}

func sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
