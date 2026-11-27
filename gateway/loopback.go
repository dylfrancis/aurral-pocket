package gateway

import (
	"errors"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"
)

var errClosed = errors.New("gateway: closed")

// loopbackServer serves the app's own clients. iOS can take a listening socket
// back from a suspended app, so check reopens it, on the same port when it can.
type loopbackServer struct {
	srv  *http.Server
	logf logFunc

	mu          sync.Mutex
	port        int
	ln          net.Listener
	closed      bool
	slowAnswers int
}

// slowAnswersToReopen is how many slow answers in a row mean the port is gone.
// A busy phone can be slow even on loopback; a refusal says gone at once.
const slowAnswersToReopen = 3

func openLoopbackServer(port int, handler http.Handler, logf logFunc) (*loopbackServer, error) {
	s := &loopbackServer{
		srv:  &http.Server{Handler: handler, ReadHeaderTimeout: 15 * time.Second},
		logf: logf,
		port: port,
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.bindLocked(); err != nil {
		return nil, err
	}
	return s, nil
}

// bindLocked listens on the current port, or on any free one when that's
// taken. A new port leaves every URL the app already built pointing at the old
// one, so the caller has to report it.
func (s *loopbackServer) bindLocked() error {
	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(s.port)))
	if err != nil && s.port != 0 {
		s.logf("port %d is taken (%v); using another", s.port, err)
		ln, err = net.Listen("tcp", "127.0.0.1:0")
	}
	if err != nil {
		return err
	}
	s.ln = ln
	s.port = ln.Addr().(*net.TCPAddr).Port
	go s.serve(ln)
	return nil
}

func (s *loopbackServer) serve(ln net.Listener) {
	err := s.srv.Serve(ln)
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.ln != ln {
		return
	}
	s.logf("listener on port %d stopped: %v", s.port, err)
	ln.Close()
	s.ln = nil
}

func (s *loopbackServer) currentPort() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.port
}

// check dials the listener the way the player would and reopens it when
// nothing answers. The dial runs outside the lock, so a slow answer doesn't
// hold up the status.
func (s *loopbackServer) check() (reopened bool, port int, err error) {
	s.mu.Lock()
	if s.closed {
		defer s.mu.Unlock()
		return false, s.port, errClosed
	}
	ln := s.ln
	s.mu.Unlock()

	var dialErr error
	if ln != nil {
		conn, err := net.DialTimeout("tcp", ln.Addr().String(), time.Second)
		if err == nil {
			conn.Close()
		}
		dialErr = err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return false, s.port, errClosed
	}
	if s.ln != nil && s.ln != ln {
		// Another check reopened it meanwhile.
		return false, s.port, nil
	}
	if s.ln != nil {
		if dialErr == nil {
			s.slowAnswers = 0
			return false, s.port, nil
		}
		var netErr net.Error
		if errors.As(dialErr, &netErr) && netErr.Timeout() {
			s.slowAnswers++
			if s.slowAnswers < slowAnswersToReopen {
				return false, s.port, nil
			}
		}
		s.slowAnswers = 0
		s.logf("listener on port %d doesn't answer (%v); reopening", s.port, dialErr)
		ln.Close()
		s.ln = nil
	}
	if err := s.bindLocked(); err != nil {
		return false, s.port, err
	}
	return true, s.port, nil
}

func (s *loopbackServer) close() {
	s.mu.Lock()
	s.closed = true
	s.ln = nil
	s.mu.Unlock()
	s.srv.Close()
}
