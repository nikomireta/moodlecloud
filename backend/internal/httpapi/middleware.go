package httpapi

import (
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// maxRequestBodySize limits the size of incoming request bodies (1 MB).
const maxRequestBodySize = 1 * 1024 * 1024

// limitRequestBody is a middleware that limits the size of incoming
// request bodies to prevent denial-of-service via large payloads.
func limitRequestBody(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body != nil {
				r.Body = http.MaxBytesReader(w, r.Body, limit)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ipRateLimiter is an IP-based rate limiter using a token bucket per IP.
type ipRateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitorEntry
	rate     rate.Limit
	burst    int
}

type visitorEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

func newIPRateLimiter(r rate.Limit, burst int) *ipRateLimiter {
	rl := &ipRateLimiter{
		visitors: make(map[string]*visitorEntry),
		rate:     r,
		burst:    burst,
	}
	go rl.cleanup()
	return rl
}

func (rl *ipRateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		limiter := rate.NewLimiter(rl.rate, rl.burst)
		rl.visitors[ip] = &visitorEntry{limiter: limiter, lastSeen: time.Now()}
		return limiter
	}
	v.lastSeen = time.Now()
	return v.limiter
}

// cleanup removes stale entries every 3 minutes.
func (rl *ipRateLimiter) cleanup() {
	for {
		time.Sleep(3 * time.Minute)
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > 5*time.Minute {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// rateLimitByIP returns a middleware that rate-limits requests by client IP.
// requestsPerSecond is the sustained rate; burst is the maximum burst size.
func rateLimitByIP(requestsPerSecond float64, burst int) func(http.Handler) http.Handler {
	limiter := newIPRateLimiter(rate.Limit(requestsPerSecond), burst)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := extractIP(r)
			if !limiter.getLimiter(ip).Allow() {
				writeError(w, http.StatusTooManyRequests, "Terlalu banyak permintaan, coba lagi nanti")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func extractIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
